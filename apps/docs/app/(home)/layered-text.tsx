interface LayeredTextProps {
  text: string
  layers?: number
  className?: string
}

export function LayeredText({
  text,
  layers = 10,
  className = '',
}: LayeredTextProps) {
  return (
    <span className={`flex flex-col leading-[0.8] ${className}`}>
      {/* Outline layers with background fill */}
      {new Array(layers).fill(0).map((_, index) => (
        <span
          key={index}
          className="select-none"
          style={{
            WebkitTextStroke: '0.5px currentColor',
            WebkitTextFillColor: 'transparent',
            marginTop: index === 0 ? 0 : '-0.7em',
          }}
        >
          {text}
        </span>
      ))}
      {/* Solid text layer */}
      <span style={{ marginTop: '-0.7em' }}>{text}</span>
    </span>
  )
}
