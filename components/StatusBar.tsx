type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

const labels: Record<Phase, { text: string; color: string }> = {
  idle:      { text: 'Pret',        color: 'var(--text-muted)' },
  listening: { text: 'Ecoute',      color: 'var(--accent)' },
  thinking:  { text: 'Traitement',  color: '#60a5fa' },
  speaking:  { text: 'IA parle',    color: '#a78bfa' },
  error:     { text: 'Erreur',      color: 'var(--error)' },
}

export function StatusBar({ phase }: { phase: Phase }) {
  const { text, color } = labels[phase]
  return (
    <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '12px', minWidth: '100px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'color 0.3s' }}>
      {text}
    </span>
  )
}