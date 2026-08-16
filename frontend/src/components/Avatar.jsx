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
          <stop offset="0%" stopColor={archetype.accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={archetype.bg} stopOpacity="1" />
        </radialGradient>
        <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="visor-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>

      {/* Outer Ring & Frame */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill={`url(#glow-${archetype.id})`}
        stroke={archetype.accent}
        strokeWidth="2.5"
      />

      {/* --- ARCHETYPE SPECIFIC ARTWORK --- */}

      {/* 1. THE SUIT (Banker) */}
      {archetype.id === "banker" && (
        <g>
          {/* Collar & Tie */}
          <polygon points="26,50 32,58 38,50 32,46" fill="#ffffff" />
          <polygon points="30,52 34,52 33,62 31,62" fill="#d97706" />
          {/* Angular Face */}
          <polygon points="22,30 42,30 38,48 26,48" fill="#fde68a" stroke="#d97706" strokeWidth="0.8" />
          {/* Top Hat */}
          <rect x="22" y="10" width="20" height="17" rx="1" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.8" />
          <rect x="14" y="24" width="36" height="4" rx="2" fill="#0f172a" />
          <rect x="22" y="22" width="20" height="2.5" fill="#f59e0b" />
          {/* Gold Monocle (Right Eye) */}
          <circle cx="36" cy="36" r="5" fill="none" stroke="#f59e0b" strokeWidth="1.8" />
          <line x1="36" y1="41" x2="40" y2="48" stroke="#f59e0b" strokeWidth="1" />
          <ellipse cx="37" cy="35" rx="2" ry="1" fill="#ffffff" opacity="0.6" />
          {/* Left Eye */}
          <circle cx="27" cy="36" r="2" fill="#0f172a" />
          {/* Mustache */}
          <path d="M26 43 Q32 41 38 43 Q35 46 32 44 Q29 46 26 43 Z" fill="#0f172a" />
        </g>
      )}

      {/* 2. DIAMOND APE */}
      {archetype.id === "ape" && (
        <g>
          {/* Ape Head & Jaw */}
          <ellipse cx="32" cy="34" rx="17" ry="15" fill="#78350f" />
          <ellipse cx="32" cy="42" rx="13" ry="9" fill="#92400e" />
          {/* Ears */}
          <circle cx="15" cy="34" r="5" fill="#78350f" />
          <circle cx="15" cy="34" r="3" fill="#b45309" />
          <circle cx="49" cy="34" r="5" fill="#78350f" />
          <circle cx="49" cy="34" r="3" fill="#b45309" />
          {/* Nostrils */}
          <circle cx="30" cy="41" r="1.2" fill="#451a03" />
          <circle cx="34" cy="41" r="1.2" fill="#451a03" />
          {/* Red Karate Headband */}
          <rect x="14" y="23" width="36" height="5" rx="1.5" fill="#ef4444" />
          <polygon points="12,25 4,31 11,34" fill="#ef4444" />
          <polygon points="12,26 6,36 12,38" fill="#dc2626" />
          {/* Diamond Cyan Sunglasses */}
          <polygon points="20,30 29,30 27,37 22,37" fill="#00e699" stroke="#0f172a" strokeWidth="1.2" />
          <polygon points="35,30 44,30 42,37 37,37" fill="#00e699" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="29" y1="32" x2="35" y2="32" stroke="#0f172a" strokeWidth="1.5" />
          {/* Smirk */}
          <path d="M27 46 Q32 50 37 46" fill="none" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {/* 3. MOON CADET (Astronaut) */}
      {archetype.id === "moon" && (
        <g>
          {/* Suit Collar */}
          <rect x="20" y="48" width="24" height="10" rx="3" fill="#e2e8f0" stroke="#0284c7" strokeWidth="1.5" />
          {/* Helmet Ring */}
          <circle cx="32" cy="32" r="19" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
          {/* Curved Cosmic Visor */}
          <ellipse cx="32" cy="33" rx="14" ry="11" fill="url(#visor-grad)" stroke="#0284c7" strokeWidth="1.5" />
          {/* Reflection Glint */}
          <path d="M23 27 Q32 23 41 27" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          <circle cx="26" cy="33" r="1.5" fill="#ffffff" opacity="0.9" />
          {/* Antenna */}
          <line x1="44" y1="18" x2="50" y2="10" stroke="#94a3b8" strokeWidth="2" />
          <circle cx="50" cy="10" r="2.5" fill="#ffde59" />
        </g>
      )}

      {/* 4. SHADOW FED (Insider) */}
      {archetype.id === "insider" && (
        <g>
          {/* Trenchcoat Lapels */}
          <polygon points="18,60 28,46 32,56" fill="#0f172a" />
          <polygon points="46,60 36,46 32,56" fill="#0f172a" />
          {/* Noir Shadow Face */}
          <ellipse cx="32" cy="36" rx="13" ry="14" fill="#090d16" />
          {/* Slanted Fedora Hat */}
          <path d="M16 26 Q32 14 48 26 Z" fill="#1e293b" />
          <ellipse cx="32" cy="26" rx="22" ry="4" fill="#0f172a" />
          <rect x="18" y="24" width="28" height="2.5" fill="#ff3b54" />
          {/* Glowing Crimson Slit Eyes */}
          <rect x="23" y="34" width="7" height="2.5" rx="1" fill="#ff3b54" />
          <rect x="34" y="34" width="7" height="2.5" rx="1" fill="#ff3b54" />
          {/* Glowing Cigar */}
          <line x1="33" y1="44" x2="42" y2="46" stroke="#d97706" strokeWidth="2" />
          <circle cx="43" cy="46" r="1.5" fill="#ff3b54" />
          <path d="M43 45 Q45 41 43 38" fill="none" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        </g>
      )}

      {/* 5. QUANT WIZARD (Cyber Android) */}
      {archetype.id === "quant" && (
        <g>
          {/* Metallic Skull */}
          <polygon points="20,24 44,24 46,42 38,50 26,50 18,42" fill="#0f766e" stroke="#00e699" strokeWidth="1.2" />
          {/* Circuit Traces */}
          <line x1="22" y1="44" x2="26" y2="48" stroke="#34d399" strokeWidth="1.5" />
          <line x1="42" y1="44" x2="38" y2="48" stroke="#34d399" strokeWidth="1.5" />
          {/* Antenna Nodes */}
          <rect x="15" y="30" width="3" height="8" rx="1" fill="#00e699" />
          <rect x="46" y="30" width="3" height="8" rx="1" fill="#00e699" />
          {/* Glowing HUD Visor */}
          <rect x="19" y="30" width="26" height="8" rx="2" fill="#00e699" opacity="0.9" />
          <line x1="20" y1="34" x2="44" y2="34" stroke="#ffffff" strokeWidth="1" strokeDasharray="2,2" />
          {/* Grid Mouth */}
          <line x1="28" y1="44" x2="36" y2="44" stroke="#00e699" strokeWidth="2" />
        </g>
      )}

      {/* 6. GIGA BULL */}
      {archetype.id === "bull" && (
        <g>
          {/* Golden Horns */}
          <path d="M18 30 Q8 16 4 10 Q14 16 22 24 Z" fill="url(#gold-grad)" stroke="#b45309" strokeWidth="1" />
          <path d="M46 30 Q56 16 60 10 Q50 16 42 24 Z" fill="url(#gold-grad)" stroke="#b45309" strokeWidth="1" />
          {/* Bull Head */}
          <polygon points="20,24 44,24 46,40 38,50 26,50 18,40" fill="#047857" />
          <ellipse cx="32" cy="42" rx="10" ry="7" fill="#065f46" />
          {/* Septum Gold Ring */}
          <circle cx="32" cy="46" r="4" fill="none" stroke="#fbbf24" strokeWidth="2" />
          {/* Nostrils */}
          <circle cx="29" cy="42" r="1.5" fill="#022c22" />
          <circle cx="35" cy="42" r="1.5" fill="#022c22" />
          {/* Fierce Eyes */}
          <polygon points="22,30 28,33 24,35" fill="#fbbf24" />
          <polygon points="42,30 36,33 40,35" fill="#fbbf24" />
        </g>
      )}

      {/* 7. DOOM BEAR */}
      {archetype.id === "bear" && (
        <g>
          {/* Bear Ears */}
          <circle cx="19" cy="22" r="7" fill="#7f1d1d" />
          <circle cx="19" cy="22" r="4" fill="#f87171" />
          <circle cx="45" cy="22" r="7" fill="#7f1d1d" />
          <circle cx="45" cy="22" r="4" fill="#f87171" />
          {/* Bear Head */}
          <circle cx="32" cy="36" r="16" fill="#991b1b" />
          {/* Snout */}
          <ellipse cx="32" cy="42" rx="9" ry="6" fill="#7f1d1d" />
          <polygon points="30,39 34,39 32,42" fill="#0f172a" />
          {/* Angry Brow & Eyes */}
          <line x1="20" y1="30" x2="28" y2="33" stroke="#450a0a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="44" y1="30" x2="36" y2="33" stroke="#450a0a" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="25" cy="35" r="2.2" fill="#ef4444" />
          <circle cx="39" cy="35" r="2.2" fill="#ef4444" />
          {/* Grimace */}
          <path d="M27 45 Q32 42 37 45" fill="none" stroke="#450a0a" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {/* 8. TURBO DEGEN */}
      {archetype.id === "degen" && (
        <g>
          {/* Electric Lavender Punk Head */}
          <circle cx="32" cy="36" r="16" fill="#a855f7" />
          {/* Spiked Neon Mohawk */}
          <polygon points="26,24 32,8 38,24" fill="#f43f5e" />
          <polygon points="20,26 24,14 28,24" fill="#fb7185" />
          <polygon points="44,26 40,14 36,24" fill="#fb7185" />
          {/* Cyberpunk Ski Goggles */}
          <rect x="18" y="30" width="28" height="9" rx="3" fill="#f43f5e" stroke="#00e699" strokeWidth="1.5" />
          <line x1="20" y1="34" x2="44" y2="34" stroke="#fde047" strokeWidth="1.5" />
          {/* Wide Grin */}
          <path d="M25 45 Q32 52 39 45" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {/* --- MOOD OVERLAYS (Dynamically react across all archetypes) --- */}
      {mood === "laser" && (
        <g>
          {/* Twin High-Intensity Laser Beams */}
          <polygon points="26,34 0,10 0,18" fill="#00e699" opacity="0.85" />
          <polygon points="38,34 64,10 64,18" fill="#00e699" opacity="0.85" />
          <circle cx="26" cy="34" r="3.5" fill="#ffffff" />
          <circle cx="38" cy="34" r="3.5" fill="#ffffff" />
          <circle cx="26" cy="34" r="2" fill="#00e699" />
          <circle cx="38" cy="34" r="2" fill="#00e699" />
        </g>
      )}

      {mood === "rekt" && (
        <g>
          {/* Red X_X Eyes */}
          <line x1="22" y1="31" x2="28" y2="37" stroke="#ff3b54" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="31" x2="22" y2="37" stroke="#ff3b54" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="36" y1="31" x2="42" y2="37" stroke="#ff3b54" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="42" y1="31" x2="36" y2="37" stroke="#ff3b54" strokeWidth="2.5" strokeLinecap="round" />
          {/* Teardrop */}
          <ellipse cx="21" cy="42" rx="2" ry="3" fill="#38bdf8" />
        </g>
      )}

      {mood === "liar" && (
        <g>
          {/* Shifty Eyes */}
          <ellipse cx="25" cy="34" rx="4" ry="2" fill="#ffffff" stroke="#ff3b54" strokeWidth="1" />
          <ellipse cx="39" cy="34" rx="4" ry="2" fill="#ffffff" stroke="#ff3b54" strokeWidth="1" />
          <circle cx="27" cy="34" r="1.5" fill="#ff3b54" />
          <circle cx="41" cy="34" r="1.5" fill="#ff3b54" />
        </g>
      )}
    </svg>
  );
}
