import { Message } from './VoiceInterview'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const time = message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`message-enter flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="rounded-2xl px-5 py-4 max-w-[85%]"
        style={{
          background: isUser ? 'var(--user-bubble)' : 'var(--ai-bubble)',
          border: `1px solid ${isUser ? 'rgba(255,255,255,0.06)' : 'rgba(74,222,128,0.12)'}`,
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ color: isUser ? 'rgba(255,255,255,0.3)' : 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {isUser ? 'Vous' : 'IA'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {time}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {message.content}
        </p>
      </div>
    </div>
  )
}