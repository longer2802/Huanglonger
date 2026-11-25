// Hand-drawn decorative art: an angel baby with halo and wings, and small
// hearts and stars. Purely decorative, so hidden from screen readers.

export function AngelBaby({ className }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ab-cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF9EBE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF9EBE" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* wings */}
      <path d="M40 92c-26-4-36-26-30-44 12 6 20 4 30 12-10 0-14 6-10 12 8-2 14 2 16 8-8 2-10 8-6 12z" fill="#FFFFFF" stroke="#F6B6CB" strokeWidth="3" strokeLinejoin="round" />
      <path d="M120 92c26-4 36-26 30-44-12 6-20 4-30 12 10 0 14 6 10 12-8-2-14 2-16 8 8 2 10 8 6 12z" fill="#FFFFFF" stroke="#F6B6CB" strokeWidth="3" strokeLinejoin="round" />
      {/* halo */}
      <ellipse cx="80" cy="30" rx="30" ry="9" fill="none" stroke="#FFD36E" strokeWidth="6" />
      {/* head */}
      <circle cx="80" cy="84" r="42" fill="#FFE3D6" stroke="#F2B9A3" strokeWidth="3" />
      {/* hair curl */}
      <path d="M78 44c-8-6 2-14 8-8 3 3 0 8-4 6" fill="none" stroke="#E39A7E" strokeWidth="4" strokeLinecap="round" />
      {/* eyes */}
      <path d="M62 84c3-5 9-5 12 0" fill="none" stroke="#5A3B3B" strokeWidth="4" strokeLinecap="round" />
      <path d="M86 84c3-5 9-5 12 0" fill="none" stroke="#5A3B3B" strokeWidth="4" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="58" cy="98" r="9" fill="url(#ab-cheek)" />
      <circle cx="102" cy="98" r="9" fill="url(#ab-cheek)" />
      {/* smile */}
      <path d="M72 102c5 6 11 6 16 0" fill="none" stroke="#D9607F" strokeWidth="4" strokeLinecap="round" />
      {/* hearts */}
      <path d="M22 130c-6-5-10-9-6-13 3-3 6-1 6 1 0-2 3-4 6-1 4 4 0 8-6 13z" fill="#FF8FB4" />
      <path d="M138 128c-5-4-8-7-5-10 2-2 5-1 5 1 0-2 3-3 5-1 3 3 0 6-5 10z" fill="#FFB8CF" />
    </svg>
  );
}

export function Sparkle({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" fill="#FFD36E" />
    </svg>
  );
}
