'use client'

import { useRef, useCallback, useState, useEffect } from 'react'

export interface TTSHook {
  enqueue: (chunk: string) => void
  flush: () => void
  stop: () => void
  isSpeaking: boolean
  unlock: () => void
}

export function useTTS(lang = 'fr-FR'): TTSHook {
  const buf = useRef('')
  const speaking = useRef(false)
  const unlocked = useRef(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  }, [])

  // a appeler depuis un evenement utilisateur pour debloquer chrome
  const unlock = useCallback(() => {
    if (unlocked.current || typeof window === 'undefined') return
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
    unlocked.current = true
  }, [])

  const speak = useCallback((text: string) => {
    if (!text.trim() || typeof window === 'undefined') return

    // strip markdown llama peut en envoyer
    let clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .trim()

    // fix encodage si le texte a l'air corrompu
    if (clean.includes('Ã') || clean.includes('Å')) {
      try {
        clean = decodeURIComponent(escape(clean))
      } catch {
        clean = clean
          .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ãª/g, 'ê')
          .replace(/Ã«/g, 'ë').replace(/Ã /g, 'à').replace(/Ã¢/g, 'â')
          .replace(/Ã®/g, 'î').replace(/Ã´/g, 'ô').replace(/Ã¹/g, 'ù')
          .replace(/Ã»/g, 'û').replace(/Ã§/g, 'ç').replace(/Å"/g, 'œ')
          .replace(/Ã¦/g, 'æ').replace(/Ã/g, 'À')
      }
    }

    if (!clean) return

    const u = new SpeechSynthesisUtterance(clean)
    u.lang = lang
    u.rate = 1.0
    u.pitch = 1.0
    u.volume = 1.0

    const voices = window.speechSynthesis.getVoices()
    u.voice =
      voices.find(v => v.lang === lang) ||
      voices.find(v => v.lang.startsWith('fr')) ||
      voices[0] ||
      null

    u.onstart = () => { speaking.current = true; setIsSpeaking(true) }
    u.onend   = () => { speaking.current = false; setIsSpeaking(false) }
    u.onerror = () => { speaking.current = false; setIsSpeaking(false) }

    window.speechSynthesis.speak(u)
  }, [lang])

  const enqueue = useCallback((chunk: string) => {
    buf.current += chunk
  }, [])

  const flush = useCallback(() => {
    const text = buf.current.trim()
    buf.current = ''
    if (text) speak(text)
  }, [speak])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis.cancel()
    buf.current = ''
    speaking.current = false
    setIsSpeaking(false)
  }, [])

  return { enqueue, flush, stop, isSpeaking, unlock }
}