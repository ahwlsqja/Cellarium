// Source: contracts/libraries/ColorPalette.sol (exact hex values from on-chain contract)

/** DB32 palette: index 0 = empty/unpainted, indices 1-32 = DawnBringer 32 colors */
export const DB32_COLORS: readonly string[] = [
  '#000000', // 0: empty (transparent/white on canvas)
  '#222034', // 1
  '#45283C', // 2
  '#663931', // 3
  '#8F563B', // 4
  '#DF7126', // 5
  '#D9A066', // 6
  '#EEC39A', // 7
  '#FBF236', // 8
  '#99E550', // 9
  '#6ABE30', // 10
  '#37946E', // 11
  '#4B692F', // 12
  '#524B24', // 13
  '#323C39', // 14
  '#3F3F74', // 15
  '#306082', // 16
  '#5B6EE1', // 17
  '#639BFF', // 18
  '#5FCDE4', // 19
  '#CBDBFC', // 20
  '#FFFFFF', // 21
  '#9BADB7', // 22
  '#847E87', // 23
  '#696A6A', // 24
  '#595652', // 25
  '#76428A', // 26
  '#AC3232', // 27
  '#D95763', // 28
  '#D77BBA', // 29
  '#8F974A', // 30
  '#8A6F30', // 31
  '#000000', // 32 (DB32 last color -- black variant)
] as const;

/** Get hex color for a DB32 color index. Returns null for empty (0) and out-of-range. */
export function getColor(colorIndex: number): string | null {
  if (colorIndex === 0) return null; // empty pixel
  if (colorIndex < 1 || colorIndex > 32) return null;
  return DB32_COLORS[colorIndex];
}

/**
 * Valid paintable color indices (1-31 per server validation).
 * Server validates colorIndex 1-31 (canvas.gateway.ts line 114).
 * Contract validates 1-32 via ColorPalette.isValidColor.
 * Use 1-31 on frontend to match server constraint.
 */
export const PAINTABLE_INDICES = Array.from({ length: 31 }, (_, i) => i + 1);

/** Color to render for unpainted pixels (index 0) on canvas */
export const EMPTY_COLOR = '#FFFFFF';
