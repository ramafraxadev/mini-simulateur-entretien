import { useRef, useCallback, useState, useEffect } from 'react'

export interface STTHook {
  start: () => void
  stop: () => string
  transcript: string
  isListening: boolean
  isSupported: boolean
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
  }
  interface SpeechRecognitionEvent extends Event {
    resultIndex: number
    results: SpeechRecognitionResultList
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string
    message: string
  }
}

export function useSTT(
  lang = 'fr-FR',
  onDone?: (transcript: string) => void
): STTHook {
  const recogRef = useRef<SpeechRecognition | null>(null)
  const finalRef = useRef('')
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualStop = useRef(false)

  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  const clearTimer = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
  }, [])

  const submit = useCallback(() => {
    clearTimer()
    manualStop.current = true
    recogRef.current?.stop()
    setIsListening(false)
    const text = finalRef.current.trim()
    finalRef.current = ''
    if (text) onDone?.(text)
    return text
  }, [clearTimer, onDone])

  const start = useCallback(() => {
    if (!isSupported) return

    const API = window.SpeechRecognition || window.webkitSpeechRecognition
    const recog = new API()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = lang

    recogRef.current = recog
    finalRef.current = ''
    manualStop.current = false
    setTranscript('')
    setIsListening(true)

    recog.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }

      if (final) finalRef.current += final + ' '
      setTranscript((finalRef.current + interim).trim())

      // reset du timer a chaque mot detecte, soumet apres 2s de silence
      if (finalRef.current.trim() || interim.trim()) {
        clearTimer()
        silenceTimer.current = setTimeout(() => {
          if (!manualStop.current) submit()
        }, 2000)
      }
    }

    recog.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('STT error:', e.error)
      }
      clearTimer()
      setIsListening(false)
    }

    recog.onend = () => {
      // si c'est pas un stop manuel et qu'il reste du texte, on soumet
      if (!manualStop.current && finalRef.current.trim()) {
        const text = finalRef.current.trim()
        finalRef.current = ''
        onDone?.(text)
      }
      clearTimer()
      setIsListening(false)
    }

    recog.start()
  }, [isSupported, lang, clearTimer, submit, onDone])

  const stop = useCallback((): string => {
    manualStop.current = true
    return submit()
  }, [submit])

  return { start, stop, transcript, isListening, isSupported }
}