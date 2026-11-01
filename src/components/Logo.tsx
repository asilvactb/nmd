/** NMD wordmark: N, M drawn as two peaks between two bars, D. */
export function Logo({ className = "", title = "NMD" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 30 960 420" className={className} role="img" aria-label={title} fill="none"
      stroke="currentColor" strokeWidth={44} strokeLinecap="round" strokeLinejoin="round">
      <path d="M62 330 V150 L235 330 V150" />
      <path d="M300 82 H690 M300 398 H690" />
      <path d="M318 330 L410 150 L497 315 L585 150 L677 330" />
      <path d="M752 150 V330 H835 A90 90 0 0 0 835 150 Z" />
    </svg>
  );
}
