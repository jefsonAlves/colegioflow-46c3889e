// Sanitize a free-typed grade string: coerce ", " → ".", clamp 0..max, one decimal.
export function sanitizeGrade(
  raw: string,
  max = 10,
): { value: number | null; corrected: boolean; display: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, corrected: false, display: "" };
  // Take the first numeric token to survive "8,5,9" pastes.
  const firstToken = trimmed.replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0] ?? "";
  const n = Number(firstToken);
  if (!Number.isFinite(n)) return { value: null, corrected: true, display: "" };
  const upper = Number.isFinite(max) && max > 0 ? max : 10;
  const clamped = Math.max(0, Math.min(upper, n));
  const rounded = Math.round(clamped * 10) / 10;
  const display = String(rounded);
  const corrected = display !== trimmed;
  return { value: rounded, corrected, display };
}
