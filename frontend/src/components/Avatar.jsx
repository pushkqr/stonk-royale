import { ARCHETYPES } from "../lib/avatars";

export default function Avatar({
  archetypeId = "banker",
  mood = "neutral",
  size = 36,
  className = "",
}) {
  const archetype = ARCHETYPES.find((a) => a.id === archetypeId) || ARCHETYPES[0];

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`avatar-svg avatar-${archetype.id} mood-${mood} ${className}`}
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <defs>
        <radialGradient id={`glow-${archetype.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={archetype.accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={archetype.bg} stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Outer Ring & Background */}
      <circle cx="32" cy="32" r="30" fill={`url(#glow-${archetype.id})`} stroke={archetype.accent} strokeWidth="2" />

      {/* Head / Body Base */}
      <circle cx="32" cy="36" r="18" fill="#facc15" />

      {/* Archetype Accessories */}
      {archetype.accessory === "tophat" && (
        <g>
          <rect x="22" y="10" width="20" height="15" rx="2" fill="#0f172a" />
          <rect x="16" y="23" width="32" height="4" rx="2" fill="#0f172a" />
          <rect x="22" y="21" width="20" height="3" fill="#f59e0b" />
        </g>
      )}

      {archetype.accessory === "headband" && (
        <g>
          <rect x="14" y="25" width="36" height="5" rx="2" fill="#ef4444" />
          <polygon points="12,27 6,32 12,35" fill="#ef4444" />
        </g>
      )}

      {archetype.accessory === "helmet" && (
        <g>
          <circle cx="32" cy="36" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <ellipse cx="32" cy="36" rx="14" ry="10" fill="#0284c7" opacity="0.6" />
        </g>
      )}

      {archetype.accessory === "fedora" && (
        <g>
          <path d="M18 24 Q32 14 46 24 Z" fill="#1e293b" />
          <ellipse cx="32" cy="24" rx="20" ry="3" fill="#0f172a" />
        </g>
      )}

      {archetype.accessory === "glasses" && (
        <g>
          <rect x="20" y="31" width="10" height="6" rx="1" fill="#00e699" opacity="0.85" />
          <rect x="34" y="31" width="10" height="6" rx="1" fill="#00e699" opacity="0.85" />
          <line x1="30" y1="34" x2="34" y2="34" stroke="#00e699" strokeWidth="2" />
        </g>
      )}

      {archetype.accessory === "horns" && (
        <g>
          <path d="M16 30 Q12 18 8 16 Q14 22 18 26 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
          <path d="M48 30 Q52 18 56 16 Q50 22 46 26 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
        </g>
      )}

      {archetype.accessory === "ears" && (
        <g>
          <circle cx="16" cy="20" r="7" fill="#7f1d1d" />
          <circle cx="16" cy="20" r="4" fill="#f87171" />
          <circle cx="48" cy="20" r="7" fill="#7f1d1d" />
          <circle cx="48" cy="20" r="4" fill="#f87171" />
        </g>
      )}

      {archetype.accessory === "beanie" && (
        <g>
          <path d="M16 26 Q32 12 48 26 Z" fill="#ec4899" />
          <rect x="15" y="24" width="34" height="4" rx="1" fill="#be185d" />
        </g>
      )}

      {/* Eyes & Mood Overlays */}
      {mood === "laser" ? (
        <g>
          {/* Laser Beams */}
          <polygon points="25,35 0,16 0,22" fill="#00e699" opacity="0.8" />
          <polygon points="39,35 64,16 64,22" fill="#00e699" opacity="0.8" />
          <circle cx="25" cy="35" r="4" fill="#ffffff" />
          <circle cx="39" cy="35" r="4" fill="#ffffff" />
          <circle cx="25" cy="35" r="2" fill="#00e699" />
          <circle cx="39" cy="35" r="2" fill="#00e699" />
          {/* Confident Grin */}
          <path d="M26 44 Q32 50 38 44" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ) : mood === "rekt" ? (
        <g>
          {/* X_X Dead Eyes */}
          <g stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
            <line x1="22" y1="32" x2="28" y2="38" />
            <line x1="28" y1="32" x2="22" y2="38" />
            <line x1="36" y1="32" x2="42" y2="38" />
            <line x1="42" y1="32" x2="36" y2="38" />
          </g>
          {/* Wavy Mouth */}
          <path d="M24 46 Q28 42 32 46 T40 46" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : mood === "liar" ? (
        <g>
          {/* Shifty Eyes */}
          <ellipse cx="26" cy="34" rx="3.5" ry="2" fill="#1e293b" />
          <ellipse cx="40" cy="34" rx="3.5" ry="2" fill="#1e293b" />
          <circle cx="28" cy="34" r="1.5" fill="#ffffff" />
          <circle cx="42" cy="34" r="1.5" fill="#ffffff" />
          {/* Smug Smirk */}
          <path d="M26 44 Q34 46 39 40" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          {/* Normal Eyes */}
          <circle cx="26" cy="35" r="2.5" fill="#0f172a" />
          <circle cx="38" cy="35" r="2.5" fill="#0f172a" />
          <circle cx="25" cy="34" r="0.8" fill="#ffffff" />
          <circle cx="37" cy="34" r="0.8" fill="#ffffff" />
          {/* Normal Smile */}
          <path d="M27 43 Q32 47 37 43" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
