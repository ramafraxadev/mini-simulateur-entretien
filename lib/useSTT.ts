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
    onerror: ((event: SpeechRecognitionErrorEventCompat) => void) | null
    onend: (() => void) | null
  }
  interface SpeechRecognitionEvent extends Event {
    resultIndex: number
    results: SpeechRecognitionResultList
  }
  interface SpeechRecognitionErrorEventCompat extends Event {
    error: string
    message: string
  }
}

export function useSTT(
  lang: string = 'fr-FR',
  onFinalTranscript?: (transcript: string) => void
): STTHook {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)  
  const manualStopRef = useRef<boolean>(false)                                 
  const [transcript, setTranscript] = useState<string>('')
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isSupported, setIsSupported] = useState<boolean>(false)

  useEffect(() => {
    setIsSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  // Helper - vide le timer silence
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  // Helper - soumet le transcript accumulé
  const submitTranscript = useCallback(() => {
    clearSilenceTimer()
    manualStopRef.current = true        
    recognitionRef.current?.stop()
    setIsListening(false)
    const result = finalTranscriptRef.current.trim()
    finalTranscriptRef.current = ''     
    if (result && onFinalTranscript) {
      onFinalTranscript(result)
    }
    return result
  }, [clearSilenceTimer, onFinalTranscript])

  const start = useCallback(() => {
    if (!isSupported) return

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognitionRef.current = recognition
    finalTranscriptRef.current = ''
    manualStopRef.current = false
    setTranscript('')
    setIsListening(true)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += text
        } else {
          interim += text
        }
      }

      if (final) {
        finalTranscriptRef.current += final + ' '
      }

      setTranscript((finalTranscriptRef.current + interim).trim())

      //  Détection silence 2s 
      // Chaque fois qu'on reçoit un résultat (parole détectée), on remet le timer à zéro
      if (finalTranscriptRef.current.trim() || interim.trim()) {
        clearSilenceTimer()
        silenceTimerRef.current = setTimeout(() => {
          // 2s sans nouvelle parole alors soumettre automatiquement
          if (!manualStopRef.current) {
            submitTranscript()
          }
        }, 2000)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEventCompat) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('[STT] Error:', event.error)
      }
      clearSilenceTimer()
      setIsListening(false)
    }

    recognition.onend = () => {
      // onend se déclenche après stop() - si ce n'est PAS un stop manuel,
      // c'est la fin naturelle (silence long) alors soumettre
      if (!manualStopRef.current && finalTranscriptRef.current.trim()) {
        const result = finalTranscriptRef.current.trim()
        finalTranscriptRef.current = ''
        onFinalTranscript?.(result)
      }
      clearSilenceTimer()
      setIsListening(false)
    }

    recognition.start()
  }, [isSupported, lang, clearSilenceTimer, submitTranscript, onFinalTranscript])

  // stop() manuel - bouton "Envoyer maintenant"
  const stop = useCallback((): string => {
    manualStopRef.current = true   //  marque stop manuel pour éviter double soumission dans onend
    return submitTranscript()
  }, [submitTranscript])

  return { start, stop, transcript, isListening, isSupported }
}