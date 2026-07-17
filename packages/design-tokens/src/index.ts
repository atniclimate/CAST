/**
 * ATNI Climate Design System tokens.
 *
 * Source of truth: the design system handoff (README + rendered spec),
 * foundations release. Values are final and exact; reproduce, do not adjust.
 * The one deliberate deviation: the handoff's "Grey Element" names two
 * different colors (core #141414 and program #98A1B4). Per the handoff's own
 * recommendation the core value is exposed here as `surfaceRaised` /
 * `ruleHeavy` and the program value as `programGrey`.
 */

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/** Core brand palette. */
export const color = {
  /** Accent, emphasis, large/bold display, primary buttons. Never a page background. */
  atniRed: '#E13D33',
  /** Links and small red text on light grounds. */
  redAlt: '#B02821',
  /** Link hover on light grounds. */
  redAltHover: '#8C1F19',
  /** Default web page ground (rich near-black, never #000000); heading ink on light. */
  blackBg: '#010B13',
  /** Body text on light. */
  grey: '#636363',
  /** Secondary text, Heading 3, minor labels. */
  greyAlt: '#3B3B3B',
  /** Default light surface / card. */
  surface: '#FFFFFF',
  /** Page tint / recessed light surface. */
  surfaceTint: '#F4F7FB',
  /** Body text on dark (not pure white). */
  textOnDark: '#E8ECF0',
  /** Links and small red text on dark grounds. */
  redOnDark: '#F26B5E',
} as const;

/**
 * Dark-ground surface ladder. Depth on dark comes from luminance, not shadow:
 * surfaces lighten as they rise.
 */
export const surfaceDark = {
  /** Page ground. */
  base: '#010B13',
  /** Cards, grouped content. (Handoff core "Grey Element".) */
  raised: '#141414',
  /** Menus, dialogs, hover. */
  overlay: '#1E242C',
} as const;

/** Heavy rules and dividers on light grounds. Same value as surfaceDark.raised. */
export const ruleHeavy = '#141414';

/** Climate program palette. */
export const program = {
  /** Climate program tooling accent. */
  redElement: '#C30101',
  /** Program UI grey. (Handoff program "Grey Element", renamed per its own note.) */
  programGrey: '#98A1B4',
  /**
   * RESERVED: land, Treaty, and sovereignty content only.
   * Never decorates a chart, button, or severity scale.
   */
  tribalMagenta: '#9732B4',
} as const;

/** Semantic / component colors used by the system's components. */
export const semantic = {
  mutedText: '#8A94A6',
  deemphasizedText: '#C6CBD4',
  hairline: '#E7ECF3',
  hairlineAlt: '#EEF1F6',
  statusActiveText: '#1C8A5E',
  statusActiveTagBg: '#E6F9F1',
  statusActiveCalloutBg: '#EAF7F0',
  statusReviewText: '#B4740E',
  statusReviewBg: '#FDF3E2',
  calloutNoteBg: '#FBEEED',
  /** Sovereignty / reserved callout box (pairs with program.tribalMagenta). */
  calloutSovereigntyBg: '#F9EDFB',
  tagSovereigntyBg: '#F6E6F8',
  tagNeutralBg: '#EEF1F6',
} as const;

// ---------------------------------------------------------------------------
// Severity bands (DS-003 / DS-008)
// ---------------------------------------------------------------------------

/**
 * The four ranked impact bands plus the unranked Unstated state (DS-003),
 * colored per the ratified alert-convention warm ramp (DS-008), evolved from
 * the shipped prototype's families. PROVISIONAL: the DS-008 color-vision and
 * contrast audit gates final values. Badges pair each background with its
 * ink, and band text always renders; color never carries meaning alone.
 * Regulatory scales (USDM, AQI, AQHI) keep their own canonical colors and
 * never use these tokens.
 */
export const severityBand = {
  extreme: { bg: '#7C2D12', ink: '#FFFFFF' },
  severe: { bg: '#EF4444', ink: '#FFFFFF' },
  moderate: { bg: '#F97316', ink: '#010B13' },
  minor: { bg: '#FBBF24', ink: '#010B13' },
  unstated: { bg: '#98A1B4', ink: '#010B13' },
} as const;

export type SeverityBandName = keyof typeof severityBand;

/** Ranked order, most severe first; unstated is unranked and sorts last. */
export const severityBandOrder: readonly SeverityBandName[] = [
  'extreme',
  'severe',
  'moderate',
  'minor',
  'unstated',
];

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Self-hosted font stacks (no external font services, ever). */
export const fontFamily = {
  /** Display: Title through Heading 3. */
  display: "'Spartan MB', 'Arial Black', sans-serif",
  /** Body: everything meant to be read. */
  body: "'TeX Gyre Heros', 'Helvetica Neue', Arial, sans-serif",
  /** Subtitles and space-tight labels. */
  condensed: "'TeX Gyre Heros Cn', 'Arial Narrow', sans-serif",
  /** Quote style. */
  quote: "'TeX Gyre Adventor', 'Century Gothic', sans-serif",
  /** Serif body for formal print. */
  serif: "'TeX Gyre Termes', 'Times New Roman', serif",
} as const;

/**
 * Body-size anchors per medium, in the medium's native unit.
 * Every named style is a ratio of Body; only the anchor changes per medium.
 */
export const bodyAnchor = {
  /** px */
  web: 16,
  /** pt */
  document: 12,
  /** px at 1920x1080 */
  deck: 28,
} as const;

export interface TypeStyle {
  /** Multiple of the Body anchor. */
  readonly ratio: number;
  readonly family: keyof typeof fontFamily;
  readonly weight: number;
  /** Letter-spacing in em; 0 means never tracked. */
  readonly tracking: number;
  readonly lineHeight: number;
  readonly case: 'title' | 'sentence';
  readonly italic?: true;
}

/**
 * The named styles. On dark grounds, body weight bumps one step (400 to 500)
 * and light weights are forbidden; that adjustment lives in CSS, not here.
 */
export const typeScale = {
  title: { ratio: 2.55, family: 'display', weight: 800, tracking: -0.025, lineHeight: 1.14, case: 'title' },
  subtitle: { ratio: 1.25, family: 'condensed', weight: 400, tracking: 0.01, lineHeight: 1.3, case: 'sentence' },
  heading1: { ratio: 2.25, family: 'display', weight: 700, tracking: -0.025, lineHeight: 1.1, case: 'title' },
  heading2: { ratio: 1.75, family: 'display', weight: 700, tracking: -0.025, lineHeight: 1.15, case: 'title' },
  heading3: { ratio: 1.17, family: 'display', weight: 700, tracking: -0.01, lineHeight: 1.2, case: 'title' },
  quote: { ratio: 1.3125, family: 'quote', weight: 400, tracking: 0, lineHeight: 1.4, case: 'sentence', italic: true },
  body: { ratio: 1.0, family: 'body', weight: 400, tracking: 0, lineHeight: 1.6, case: 'sentence' },
  caption: { ratio: 0.8125, family: 'body', weight: 400, tracking: 0, lineHeight: 1.4, case: 'sentence' },
} as const satisfies Record<string, TypeStyle>;

export type TypeStyleName = keyof typeof typeScale;

/** Deck slide-text minimum in px; deck Caption is floored here, not the strict ratio. */
export const deckTextFloorPx = 24;

/**
 * Resolve a named style's size for a medium, in that medium's native unit
 * (web px, document pt, deck px). Applies the deck text floor.
 */
export function typeSize(style: TypeStyleName, medium: keyof typeof bodyAnchor): number {
  const raw = typeScale[style].ratio * bodyAnchor[medium];
  if (medium === 'deck' && raw < deckTextFloorPx) return deckTextFloorPx;
  return raw;
}

/** Reading measure in characters per line. */
export const measure = { min: 50, ideal: 66, max: 75, hardCeiling: 80 } as const;

// ---------------------------------------------------------------------------
// Space, shape, and elevation
// ---------------------------------------------------------------------------

/** All edges are square. This token exists so no component invents a radius. */
export const radius = 0;

/** Reference-page spacing rhythm, px at the web anchor. */
export const spacing = {
  sectionTop: 96,
  sectionRulePaddingTop: 64,
  subheadTop: 52,
  contentMaxWidth: 1080,
  readingMeasureMaxWidth: 640,
} as const;

/** Light-ground elevation: document cards only. Dark grounds use no shadow. */
export const shadowLight = '0 1px 3px rgba(11, 18, 32, 0.08)';

export const button = {
  paddingInContent: '11px 20px',
  paddingHero: '13px 22px',
  fontWeight: 600,
} as const;

export const card = { padding: '22px 24px' } as const;
