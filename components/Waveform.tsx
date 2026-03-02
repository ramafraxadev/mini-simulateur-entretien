const heights = [40, 70, 100, 60, 85, 50, 75]

export function Waveform({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="flex items-center gap-0.5 h-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </div>
  )
}