// The animated Drishti mark ("drishti" = sight): an eye that looks around and blinks, over a
// radar that pulses and sweeps (a nod to Renewal Radar). Colours come from the theme tokens, so
// it works in Light and Dark; the reduced-motion rule in index.css stops the animation.
import { useId } from 'react';

/** `radar={false}` drops the rings and sweep: for small places such as the sidebar. */
export function DrishtiEye({ size = 88, radar = true }: { size?: number; radar?: boolean }) {
  // React ids contain characters some browsers reject inside url(#…); keep letters and digits.
  const clipId = `drishti-eye-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const eye = 'M18 60 Q60 20 102 60 Q60 100 18 60 Z';
  return (
    <svg
      width={size}
      height={size}
      // Without the radar, zoom in on the eye so it fills a small box.
      viewBox={radar ? '0 0 120 120' : '14 14 92 92'}
      aria-hidden="true"
      className="overflow-visible"
    >
      {radar &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="60"
            cy="60"
            r="50"
            className="drishti-ring fill-none stroke-primary"
            strokeWidth="1.5"
            style={{ animationDelay: `${i}s` }}
          />
        ))}
      {radar && (
        <g className="drishti-sweep">
          <path d="M60 60 L60 8 A52 52 0 0 1 105 34 Z" className="fill-primary opacity-15" />
        </g>
      )}
      <g className="drishti-lid">
        <path d={eye} className="fill-surface stroke-primary-strong" strokeWidth={radar ? 3 : 5} />
        <clipPath id={clipId}>
          <path d={eye} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <g className="drishti-iris">
            <circle cx="60" cy="60" r="17" className="fill-primary" />
            <circle
              cx="60"
              cy="60"
              r="17"
              className="fill-none stroke-primary-strong"
              strokeWidth="2"
            />
            <circle cx="60" cy="60" r="7.5" className="fill-ink" />
            <circle cx="65" cy="54" r="3.5" className="fill-surface" />
          </g>
        </g>
      </g>
    </svg>
  );
}
