'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSTT } from '@/lib/useSTT'
import { useTTS } from '@/lib/useTTS'
import { Waveform } from './Waveform'
import { MessageBubble } from './MessageBubble'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type InterviewPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function VoiceInterview() {
  const [messages, setMessages] = useState<Message[]>([])
  const [phase, setPhase] = useState<InterviewPhase>('idle')
  const [streamingText, setStreamingText] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isStarted, setIsStarted] = useState(false)
  const [duration, setDuration] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tts = useTTS('fr-FR')

  useEffect(() => {
    if (phase === 'speaking' && !tts.isSpeaking) {
      setPhase('idle')
    }
  }, [tts.isSpeaking, phase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    if (isStarted) {
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isStarted])

  const handleFinalTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: transcript,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setPhase('thinking')
    setStreamingText('')

    const history = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }))

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''
      setPhase('speaking')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') { tts.flush(); break }
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.token) {
              accumulatedText += parsed.token
              setStreamingText(accumulatedText)
              tts.enqueue(parsed.token)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      if (accumulatedText.trim()) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulatedText.trim(),
          timestamp: new Date(),
        }])
        setStreamingText('')
      }

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Erreur de connexion'
      setErrorMessage(message)
      setPhase('error')
      setTimeout(() => setPhase('idle'), 4000)
    }
  }, [messages, tts])

  const stt = useSTT('fr-FR', handleFinalTranscript)

  const startInterview = useCallback(async () => {
    tts.unlock()
    setIsStarted(true)
    setPhase('thinking')
    await handleFinalTranscript('[DÉBUT DE L\'ENTRETIEN - présente-toi et pose la première question]')
  }, [handleFinalTranscript, tts])

  const handleMicToggle = useCallback(() => {
    if (phase === 'listening') {
      stt.stop()
    } else if (phase === 'idle') {
      // Uniquement depuis idle : l'IA a fini de parler
      setPhase('listening')
      stt.start()
    }
    // phase === 'speaking' | 'thinking' > bouton disabled, rien ne se passe
  }, [phase, stt])

  const resetInterview = useCallback(() => {
    abortControllerRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
    tts.stop()
    stt.stop()
    setMessages([])
    setPhase('idle')
    setStreamingText('')
    setIsStarted(false)
    setErrorMessage('')
    setDuration(0)
  }, [stt, tts])

  //  Règles de désactivation
  // Micro : bloqué pendant thinking ET pendant que l'IA parle 
  const micDisabled = phase === 'thinking' || tts.isSpeaking
  // "Envoyer maintenant" : bloqué pendant que l'IA parle
  const sendDisabled = tts.isSpeaking

  if (!isStarted) {
    return <LandingScreen onStart={startInterview} sttSupported={stt.isSupported} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: phase === 'idle' ? 'var(--text-muted)' : 'var(--accent)',
            boxShadow: phase !== 'idle' ? '0 0 8px var(--accent)' : 'none',
          }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            ENTRETIEN EN COURS
          </span>
          <span style={{ color: 'var(--border-strong)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>·</span>
          <span style={{
            color: duration >= 1800 ? 'var(--error)' : duration >= 900 ? '#f59e0b' : 'var(--text-muted)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em',
          }}>
            {formatDuration(duration)}
          </span>
        </div>

        <button onClick={resetInterview} style={{ color: 'var(--error)', background: 'transparent', border: '1px solid var(--error)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
          X Terminer
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streamingText && (
            <div style={{ background: 'var(--ai-bubble)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '16px', padding: '16px 20px', maxWidth: '85%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>IA</span>
                <Waveform active={tts.isSpeaking} />
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{streamingText}</p>
            </div>
          )}

          {phase === 'thinking' && !streamingText && (
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 20px', width: 'fit-content' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>IA réfléchit...</span>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '12px', padding: '12px 16px', color: 'var(--error)', fontSize: '14px' }}>
              ⚠ {errorMessage}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Contrôles */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '20px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>

          {/* Transcript en direct */}
          {phase === 'listening' && stt.transcript && (
            <div style={{ width: '100%', background: 'var(--user-bubble)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', boxSizing: 'border-box' }}>
              <div style={{ color: 'var(--accent)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                ... En écoute — envoi auto après 2s de silence
              </div>
              {stt.transcript}
            </div>
          )}

          {/* Bouton "Envoyer maintenant" — désactivé si l'IA parle encore */}
          {phase === 'listening' && (
            <button
              onClick={handleMicToggle}
              disabled={sendDisabled}
              title={sendDisabled ? "Attendez que l'IA finisse de parler" : undefined}
              style={{
                width: '100%',
                padding: '16px',
                background: sendDisabled ? 'var(--surface-raised)' : 'var(--accent)',
                color: sendDisabled ? 'var(--text-muted)' : '#0a0c0f',
                border: sendDisabled ? '1px solid var(--border)' : 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: sendDisabled ? 'not-allowed' : 'pointer',
                opacity: sendDisabled ? 0.5 : 1,
                fontFamily: 'var(--font-display)',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
            >
              {sendDisabled ? '.. IA en cours…' : ' Envoyer maintenant'}
            </button>
          )}

          {/* Bouton micro — désactivé si thinking OU si l'IA parle */}
          {phase !== 'listening' && (
            <button
              onClick={handleMicToggle}
              disabled={micDisabled}
              title={
                phase === 'thinking'  ? "L'IA réfléchit…" :
                tts.isSpeaking        ? "Attendez que l'IA finisse de parler" :
                'Parler'
              }
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: micDisabled ? 'var(--surface)' : 'var(--surface-raised)',
                border: `2px solid ${micDisabled ? 'var(--border)' : 'var(--border-strong)'}`,
                cursor: micDisabled ? 'not-allowed' : 'pointer',
                opacity: micDisabled ? 0.35 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}

          {/* Instructions contextuelles */}
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', textAlign: 'center', margin: 0 }}>
            {phase === 'idle'      && ' Cliquez le micro pour parler'}
            {phase === 'listening' && (sendDisabled
              ? ' Attendez que l\'IA finisse de parler…'
              : ' Envoi automatique après 2s de silence — ou cliquez "Envoyer"'
            )}
            {phase === 'thinking'  && ' L\'IA réfléchit…'}
            {phase === 'speaking'  && (tts.isSpeaking
              ? ' L\'IA parle — micro disponible dès qu\'elle a fini'
              : ' Cliquez le micro pour parler'
            )}
          </p>

        </div>
      </div>
    </div>
  )
}

// Landing Screen
function LandingScreen({ onStart, sttSupported }: { onStart: () => void; sttSupported: boolean }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
        </div>

        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '12px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          Super<span style={{ color: 'var(--accent)' }}>Interview</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          Simulateur d'entretien vocal par IA
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '40px', fontFamily: 'var(--font-mono)' }}>
          STT + détection silence  Llama 3.3 (Groq) + TTS · 100% gratuit
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {['Web Speech API', 'Silence Detection', 'Llama 3.3 70B', 'Groq (gratuit)'].map(label => (
            <span key={label} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(74,222,128,0.2)' }}>
              {label}
            </span>
          ))}
        </div>

        {!sttSupported && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '12px', padding: '12px 16px', color: 'var(--error)', fontSize: '12px', marginBottom: '16px', fontFamily: 'var(--font-mono)' }}>
             Utilisez Chrome ou Edge pour la reconnaissance vocale.
          </div>
        )}

        <button onClick={onStart} style={{ width: '100%', padding: '16px', background: 'var(--accent)', color: '#0a0c0f', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'var(--font-display)', boxShadow: '0 0 30px rgba(74,222,128,0.3)' }}>
          Démarrer l'entretien 
        </button>

        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '16px', fontFamily: 'var(--font-mono)' }}>
          Poste Lead Dev IA · EdTech · Freelance
        </p>
      </div>
    </div>
  )
}