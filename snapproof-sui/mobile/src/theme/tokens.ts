/**
 * SnapProof Design Tokens
 * Ported from template/src/index.css — premium dark glassmorphism system.
 * All colors match the HSL values from the template, converted to hex/rgba for RN.
 */

export const C = {
  // --- Base ---
  bg:           "#050813",   // hsl(230 45% 5%)
  bgDeep:       "#030509",   // even deeper for layering
  card:         "#0f1320",   // hsl(230 40% 9%)

  // --- Surfaces / Glass ---
  surface:      "#131a30",   // hsl(230 30% 14%)
  surfaceRaised: "rgba(20,28,52,0.85)",
  glass:        "rgba(20,28,52,0.55)",  // --gradient-glass base
  glassBorder:  "rgba(185,200,220,0.10)", // hsl(220 30% 70% / 0.10)

  // --- Primary: Coral / Rose ---
  coral:        "#f0566e",   // hsl(354 88% 64%)
  coralGlow:    "#f4697e",   // hsl(350 95% 70%)
  coralDeep:    "#d1435a",   // hsl(348 78% 52%)

  // --- Accent: Cyan / Electric Blue ---
  cyan:         "#3cc8f0",   // hsl(195 90% 60%)
  cyanGlow:     "#55d0f5",   // hsl(200 95% 65%)
  cyanBorder:   "rgba(60,200,240,0.22)",

  // --- Success: Mint ---
  mint:         "#40e0a3",   // hsl(158 75% 55%)
  mintBg:       "rgba(64,224,163,0.10)",
  mintBorder:   "rgba(64,224,163,0.25)",

  // --- Text Scale ---
  textPrimary:  "#f0f2f8",   // hsl(220 25% 96%)
  silver:       "#c5ccd8",   // hsl(220 18% 82%)
  slate:        "#848ea0",   // hsl(222 14% 58%)
  slateDeep:    "#4a5568",

  // --- Semantic ---
  danger:       "#e05555",
  dangerBg:     "rgba(220,60,60,0.12)",
  warning:      "#f0a845",
  warningBg:    "rgba(240,168,69,0.12)",
} as const;

/** Glassmorphism shadow values (approximated for RN elevation/shadow) */
export const SHADOWS = {
  glass: {
    shadowColor: "#030509",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.70,
    shadowRadius: 30,
    elevation: 16,
  },
  coral: {
    shadowColor: "#f0566e",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 10,
  },
  cyan: {
    shadowColor: "#3cc8f0",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

/** Typography */
export const TYPE = {
  eyebrow: {
    fontSize: 10,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    color: C.slate,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: "800" as const,
    letterSpacing: -1.2,
    color: C.textPrimary,
    lineHeight: 44,
  },
  monoSmall: {
    fontSize: 11,
    fontFamily: "monospace" as const,
    letterSpacing: 0.3,
    color: C.silver,
  },
} as const;
