'use client'

import { useRef, useCallback, useState, useEffect } from 'react'

// Interface exportée — doit correspondre exactement à ce qu'utilise VoiceInterview
export interface TTSHook {
  enqueue: (chunk: string) => void
  flush: () => void
  stop: () => void
  isSpeaking: boolean
  unlock: () => void
}

export function useTTS(lang: string = 'fr-FR'): TTSHook {
  const bufferRef = useRef<string>('')
  const isSpeakingRef = useRef<boolean>(false)
  const unlockedRef = useRef<boolean>(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Charger les voix dès le montage
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  }, [])

  // Débloquer Chrome - doit être appelé dans un clic utilisateur
  const unlock = useCallback(() => {
    if (unlockedRef.current || typeof window === 'undefined') return
    const silent = new SpeechSynthesisUtterance(' ')
    silent.volume = 0
    window.speechSynthesis.speak(silent)
    unlockedRef.current = true
  }, [])

  const speak = useCallback((text: string) => {
    if (!text.trim() || typeof window === 'undefined') return

    // Nettoyer le markdown que Llama/Groq envoie parfois
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .trim()

    if (!clean) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = lang
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Choisir la meilleure voix française disponible
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find(v => v.lang === lang) ||
      voices.find(v => v.lang.startsWith('fr')) ||
      voices[0]
    if (voice) utterance.voice = voice

    utterance.onstart = () => { isSpeakingRef.current = true; setIsSpeaking(true) }
    utterance.onend   = () => { isSpeakingRef.current = false; setIsSpeaking(false) }
    utterance.onerror = () => { isSpeakingRef.current = false; setIsSpeaking(false) }

    window.speechSynthesis.speak(utterance)
  }, [lang])

  // Accumule les tokens pendant le stream LLM
  const enqueue = useCallback((chunk: string) => {
    bufferRef.current += chunk
  }, [])

  // Appelé quand le stream est terminé donc parle tout le texte d'un coup
  const flush = useCallback(() => {
    const text = bufferRef.current.trim()
    bufferRef.current = ''
    if (text) speak(text)
  }, [speak])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis.cancel()
    bufferRef.current = ''
    isSpeakingRef.current = false
    setIsSpeaking(false)
  }, [])

  return { enqueue, flush, stop, isSpeaking, unlock }
}