/**
 * A discreet corner badge identifying the framework this hostee is built
 * with, so visitors recognise the stage as an embedded page of a different
 * framework than its host. Rendered by the feature — the badge travels with
 * the page wherever it is embedded.
 *
 * @returns The badge markup with the React mark and label.
 */
export function FrameworkBadge() {
  return (
    <p className="framework-badge" title="This heart is a React app running in its own embedded page">
      <svg viewBox="-11.5 -10.23 23 20.46" role="img" aria-label="React logo" focusable="false">
        <circle r="2.05" fill="#61dafb" />
        <g stroke="#61dafb" strokeWidth="1" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
      <span>React</span>
    </p>
  )
}
