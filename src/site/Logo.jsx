import React from 'react';

// LottoTrack Pro mark: one bold white tick on a blue tile ("every ticket accounted for").
// Two shapes only, so it stays crisp down to a 16px browser tab. Same art as /public/favicon.svg.
export const BRAND_BLUE = '#1D4ED8';

export function LogoMark({ size = 32, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={BRAND_BLUE} />
      <path d="M18 33.5l9.5 9.5L46.5 22.5" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ inverse = false, size = 32 }) {
  return (
    <span className={`ltp-wordmark${inverse ? ' is-inverse' : ''}`}>
      <LogoMark size={size} />
      <span className="ltp-wordmark-text">
        LottoTrack<span className="ltp-wordmark-pro">Pro</span>
      </span>
    </span>
  );
}
