// 網站標誌：山景上插著一支紅色地圖圖釘，代表「把旅程釘在地圖上」
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="我的旅遊遊記標誌">
      <rect width="64" height="64" rx="16" fill="#2e6b45" />
      <path d="M4 52 L20 30 L30 42 L40 26 L60 52 Z" fill="#9fd08a" />
      <path d="M36 32 L40 26 L44 32 Z" fill="#ffffff" opacity="0.9" />
      <rect x="4" y="50" width="56" height="10" fill="#7fbf6a" />
      <path d="M32 40 C29 34 22 30 22 22 A10 10 0 1 1 42 22 C42 30 35 34 32 40 Z" fill="#d63a2b" stroke="#ffffff" strokeWidth="2.5" />
      <circle cx="32" cy="22" r="4" fill="#ffffff" />
    </svg>
  );
}
