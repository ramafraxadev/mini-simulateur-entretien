export function Waveform({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 4, 5, 6, 7].map((_, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${[40, 70, 100, 60, 85, 50, 75][i]}%`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}
