interface BrandMarkProps {
  size?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Default brand mark: an abstract AI neural-node icon on a
 * Quantum Blue -> Cyan gradient. Used as the site logo until
 * an admin uploads a custom logo via Branding settings.
 */
const BrandMark = ({ size = 40, className = "", "aria-label": ariaLabel = "Logo" }: BrandMarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    className={className}
    role="img"
    aria-label={ariaLabel}
  >
    <defs>
      <linearGradient id="brandMarkGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#brandMarkGradient)" />
    <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.95">
      <path d="M14 32 L14 22 L24 16 L34 22 L34 32" />
      <path d="M14 26 L34 26" />
    </g>
    <circle cx="14" cy="32" r="2.4" fill="#ffffff" />
    <circle cx="24" cy="16" r="2.4" fill="#ffffff" />
    <circle cx="34" cy="32" r="2.4" fill="#ffffff" />
    <circle cx="24" cy="26" r="2.6" fill="#ffffff" />
  </svg>
);

export default BrandMark;
