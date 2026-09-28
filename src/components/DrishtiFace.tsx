import React, { useEffect, useState } from 'react';

export type DrishtiFaceState = 'idle' | 'thinking' | 'offline';

interface DrishtiFaceProps {
  state?: DrishtiFaceState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function DrishtiFace({
  state = 'idle',
  size = 'md',
  className = '',
}: DrishtiFaceProps) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Eye blinking cycle for idle state (blinks twice every ~5s)
  useEffect(() => {
    if (state !== 'idle') {
      setIsBlinking(false);
      return;
    }

    const interval = setInterval(() => {
      // First blink
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        // Second quick blink
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => {
            setIsBlinking(false);
          }, 140);
        }, 180);
      }, 140);
    }, 5000);

    return () => clearInterval(interval);
  }, [state]);

  const sizePixels = {
    sm: 34,
    md: 48,
    lg: 76,
    xl: 96,
  }[size];

  // Colors & styling based on state
  const isOffline = state === 'offline';
  const isThinking = state === 'thinking';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: sizePixels,
        height: sizePixels,
        filter: isOffline ? 'grayscale(0.95) opacity(0.7)' : 'none',
      }}
      title={
        isOffline
          ? 'Drishti (Offline Rule Engine)'
          : isThinking
          ? 'Drishti is synthesizing records...'
          : 'Drishti AI Partner'
      }
    >
      {/* Soft Ambient Halo */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 pointer-events-none ${
          isOffline
            ? 'opacity-0'
            : isThinking
            ? 'bg-gradient-to-tr from-indigo-500/40 via-violet-500/40 to-cyan-400/40 blur-md scale-110 animate-pulse'
            : 'bg-gradient-to-tr from-indigo-500/25 via-violet-500/20 to-cyan-400/20 blur-sm scale-105'
        }`}
      />

      <svg
        viewBox="0 0 100 100"
        className={`relative z-10 w-full h-full transition-transform duration-300 ${
          isOffline
            ? ''
            : isThinking
            ? 'animate-[bounce_1.2s_infinite_cubic-bezier(.16,1,.3,1)]'
            : 'animate-[bounce_4.5s_infinite_ease-in-out]'
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main Gradient */}
          <linearGradient id="faceGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Cheeks Glow */}
          <radialGradient id="cheekGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
          </radialGradient>

          {/* Antenna Glow */}
          <radialGradient id="antennaBulb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </radialGradient>
        </defs>

        {/* Antenna Stem */}
        <path
          d="M50 24V14"
          stroke={isOffline ? '#64748b' : '#a78bfa'}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Antenna Bulb */}
        <circle
          cx="50"
          cy="11"
          r="5"
          fill={isOffline ? '#94a3b8' : 'url(#antennaBulb)'}
          className={!isOffline ? (isThinking ? 'animate-ping' : 'animate-pulse') : ''}
        />
        <circle
          cx="50"
          cy="11"
          r="4.5"
          fill={isOffline ? '#cbd5e1' : '#e0f2fe'}
        />

        {/* Rounded Head */}
        <rect
          x="16"
          y="23"
          width="68"
          height="64"
          rx="22"
          fill="url(#faceGrad)"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.5"
        />

        {/* Inner Glass Highlight / Visor */}
        <rect
          x="20"
          y="27"
          width="60"
          height="32"
          rx="14"
          fill="rgba(255, 255, 255, 0.08)"
        />

        {/* Cheeks */}
        {!isOffline && (
          <>
            <circle cx="28" cy="62" r="7" fill="url(#cheekGlow)" />
            <circle cx="72" cy="62" r="7" fill="url(#cheekGlow)" />
          </>
        )}

        {/* Left Eye */}
        {isBlinking ? (
          <path
            d="M31 49Q38 52 45 49"
            stroke="#0f172a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          <g>
            <circle cx="38" cy="48" r="7.5" fill="#0f172a" />
            <circle cx="36" cy="46" r="2.8" fill="#ffffff" />
            <circle cx="41" cy="50" r="1.3" fill="#ffffff" opacity="0.9" />
          </g>
        )}

        {/* Right Eye */}
        {isBlinking ? (
          <path
            d="M55 49Q62 52 69 49"
            stroke="#0f172a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          <g>
            <circle cx="62" cy="48" r="7.5" fill="#0f172a" />
            <circle cx="60" cy="46" r="2.8" fill="#ffffff" />
            <circle cx="65" cy="50" r="1.3" fill="#ffffff" opacity="0.9" />
          </g>
        )}

        {/* Mouth */}
        {isOffline ? (
          /* Offline: Flat line */
          <path
            d="M44 68H56"
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : isThinking ? (
          /* Thinking: Animated speaking mouth */
          <ellipse
            cx="50"
            cy="68"
            rx="5"
            ry="4"
            fill="#0f172a"
            className="animate-pulse"
          />
        ) : (
          /* Idle: Warm gentle smile */
          <path
            d="M42 66Q50 74 58 66"
            stroke="#0f172a"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}
