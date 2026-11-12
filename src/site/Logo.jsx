import React from 'react';

// LottoTrack Pro mark: one bold yellow tick on a black tile — "every ticket accounted for".
// Two shapes only, so it stays crisp down to a 16px browser tab. On dark panels the tile
// steps up to a raised charcoal so it doesn't disappear into the background.
export const BRAND_INK = '#0A0A0A';
export const BRAND_GOLD = '#FFC21A';

export function LogoMark({ size = 32, onDark = false, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={onDark ? '#262626' : BRAND_INK} />
      <path d="M18 33.5l9.5 9.5L46.5 22.5" fill="none" stroke={BRAND_GOLD} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ inverse = false, size = 32 }) {
  return (
    <span className={`ltp-wordmark${inverse ? ' is-inverse' : ''}`}>
      <LogoMark size={size} onDark={inverse} />
      <span className="ltp-wordmark-text">
        LottoTrack<span className="ltp-wordmark-pro">Pro</span>
      </span>
    </span>
  );
}
