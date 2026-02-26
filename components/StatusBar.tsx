type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

const STATUS_CONFIG: Record<Phase, { label: string; color: string }> = {
  idle:      { label: '  Prêt',       color: 'var(--text-muted)' },
  listening: { label: '  Écoute',     color: 'var(--accent)' },
  thinking:  { label: '  Traitement..', color: '#60a5fa' },
  speaking:  { label: '  Parole IA',  color: '#a78bfa' },
  error:     { label: '  Erreur',     color: 'var(--error)' },
}

export function StatusBar({ phase }: { phase: Phase }) {
  const { label, color } = STATUS_CONFIG[phase]

  return (
    <span
      className="text-xs font-mono tracking-widest uppercase transition-all duration-300"
      style={{ color, fontFamily: 'var(--font-mono)', minWidth: '110px', textAlign: 'right' }}
    >
      {label}
    </span>
  )
}
