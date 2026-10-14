/** Ticket promo codes: one list shared by checkout and Help → Promo code. */

export interface PromoCode {
  /** Shown next to the code, e.g. "10% off tickets". */
  label: string;
  /** 'percent' takes `value`% off the subtotal; 'amount' takes up to `value` euro off. */
  kind: 'percent' | 'amount';
  value: number;
}

export const PROMO_CODES: Record<string, PromoCode> = {
  BERLIN10: { label: '10% off tickets', kind: 'percent', value: 10 },
  DOMTAK5: { label: '€5 off your order', kind: 'amount', value: 5 },
};

/** "  berlin10 " -> "BERLIN10" */
export function normalizePromoCode(code: string) {
  return code.trim().toUpperCase();
}

/** The promo for a code (any case, surrounding spaces ignored), or null when it is not valid. */
export function findPromo(code: string): (PromoCode & { code: string }) | null {
  const key = normalizePromoCode(code);
  const promo = key ? PROMO_CODES[key] : undefined;
  return promo ? { ...promo, code: key } : null;
}

/**
 * Discount for a code on a subtotal, rounded to cents. Never more than the subtotal and never
 * negative, so the total cannot drop below €0. Returns null for an empty or unknown code; a valid
 * code on a free order returns a discount of 0 (use it to check a code without a basket).
 */
export function applyPromo(code: string, subtotal: number): { code: string; discount: number; label: string } | null {
  const promo = findPromo(code);
  if (!promo) return null;
  const base = Math.max(0, Number.isFinite(subtotal) ? subtotal : 0);
  const raw = promo.kind === 'percent' ? (base * promo.value) / 100 : promo.value;
  const discount = Math.max(0, Math.min(base, Math.round(raw * 100) / 100));
  return { code: promo.code, discount, label: promo.label };
}
