/**
 * Token mirror for pdfmake runtime.
 *
 * pdfmake renders in a worker/blob context that cannot read CSS custom
 * properties. These constants duplicate the semantic tokens defined in
 * `src/styles/tokens.css` so the PDF output stays visually aligned with
 * the in-app light theme.
 *
 * Rules:
 * - Keep keys named identically to the CSS semantic tokens.
 * - When `tokens.css` changes, update THIS file in the same commit.
 * - Dark-theme PDF output is out of scope (PDFs are print-oriented).
 */

export const pdfColors = {
  // Surfaces & text (light theme hex approximations — see DESIGN_TOKENS §2)
  bgDefault: "#F9F7F3",        // --stone-50
  bgSubtle: "#F0EDE6",         // --stone-100
  borderDefault: "#E2DED3",    // --stone-200
  borderStrong: "#CBC5B4",     // --stone-300 / K680 Stone Beige
  textDefault: "#25231E",      // --stone-900
  textMuted: "#4B483F",        // --stone-700
  textSubtle: "#85806E",       // --stone-500/600 meta
  tag: "#4B483F",              // --stone-700 (tag body)
  accent: "#5E5D3F",           // --olive-700 (link, brand on print)
  accentVisual: "#727045",     // --olive-600 ≈ RAL 6013
  ruleLine: "#CFCBBF",         // --stone-300 subtler variant
  ruleLineThin: "#E2DED3",     // --stone-200 separator
  successFg: "#2B5A34",        // --color-status-success-fg (light)
} as const;

export const pdfTypography = {
  fontTitle: 18,
  fontSubtitle: 11,
  fontMeta: 9,
  fontBody: 10,
  fontTag: 9,
  lineHeight: 1.35,
} as const;

export const pdfLayout = {
  pageSize: "A4" as const,
  pageMargins: [40, 60, 40, 60] as [number, number, number, number],
  contentWidth: 515, // A4 width 595 - 2×40 margin
} as const;
