import type { BookingCharges, Lesson, Profile, Venue } from '../data/types';

/**
 * Demo rates. The blueprint leaves commission, who pays it and payment fees as open decisions,
 * so screens should label these as service fee / platform commission without promising more.
 */
export const SERVICE_FEE_RATE = 0.05;
/** Provider-side commission, matching the terms page (10% of each booking paid through the app). */
export const PLATFORM_COMMISSION_RATE = 0.1;

export type ChargeKey = 'base' | 'travel' | 'equipment' | 'catering' | 'security' | 'extra' | 'fee';

export interface PriceLine {
  key: ChargeKey;
  label: string;
  amount: number;
  /** Short explanation, e.g. "120 guests × €35". */
  note?: string;
  /** True when the venue requires this charge (e.g. security above a guest count). */
  required?: boolean;
}

export interface Estimate {
  items: PriceLine[];
  total: number;
  /** True when the provider prices on request: there is no base price to show (request a quote instead). */
  quote: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Customer service fee on a booking total (demo rate, see SERVICE_FEE_RATE). */
export function bookingFee(total: number) {
  return round2(total * SERVICE_FEE_RATE);
}

/** What the provider keeps from a gross booking value after the platform commission. */
export function providerNet(gross: number) {
  return round2(gross * (1 - PLATFORM_COMMISSION_RATE));
}

export function commissionOf(gross: number) {
  return round2(gross * PLATFORM_COMMISSION_RATE);
}

/** Guards needed for an attendance: ceil(guests / guestsPerGuard). */
export function guardsFor(guests: number, guestsPerGuard: number) {
  if (guests <= 0 || guestsPerGuard <= 0) return 0;
  return Math.ceil(guests / guestsPerGuard);
}

/** Catering cost: pricePerGuest × max(guests, minGuests). */
export function cateringCost(venue: Pick<Venue, 'catering'>, guests: number) {
  const c = venue.catering;
  if (!c?.available || guests <= 0) return 0;
  return c.pricePerGuest * Math.max(guests, c.minGuests ?? 0);
}

/** Security cost: ceil(guests / guestsPerGuard) × pricePerGuard. */
export function securityCost(venue: Pick<Venue, 'security'>, guests: number) {
  const s = venue.security;
  if (!s?.available) return 0;
  return guardsFor(guests, s.guestsPerGuard) * s.pricePerGuard;
}

/** True when the venue makes security mandatory at this attendance. */
export function securityRequired(venue: Pick<Venue, 'security'>, guests: number) {
  const s = venue.security;
  return !!s?.available && s.requiredFrom != null && guests >= s.requiredFrom;
}

export interface VenueEstimateOptions {
  guests: number;
  /** Shown on the base line ("Venue hire · 6 h"); the venue price is per night. */
  hours?: number;
  catering?: boolean;
  security?: boolean;
  /** Labels of venue.extraCharges to include (e.g. ['Sound engineer']). */
  extras?: string[];
  /** Add the customer service fee as a line. */
  withFee?: boolean;
}

/**
 * Venue price breakdown. Catering and security depend on attendance:
 * catering = pricePerGuest × guests (at least minGuests), security = ceil(guests / guestsPerGuard) × pricePerGuard.
 * Security is included automatically when the venue requires it for this many guests.
 */
export function venueEstimate(venue: Venue, opts: VenueEstimateOptions): Estimate {
  const guests = Math.max(0, Math.round(opts.guests));
  const quote = venue.pricing === 'quote';
  const items: PriceLine[] = [];
  if (!quote) items.push({ key: 'base', label: opts.hours ? `Venue hire · ${opts.hours} h` : 'Venue hire · 1 night', amount: venue.pricePerNight });
  const c = venue.catering;
  if (opts.catering && c?.available && guests > 0) {
    const billed = Math.max(guests, c.minGuests ?? 0);
    items.push({ key: 'catering', label: 'Catering', amount: c.pricePerGuest * billed, note: `${billed} guests × €${c.pricePerGuest}${billed > guests ? ` (minimum ${c.minGuests})` : ''}` });
  }
  const s = venue.security;
  const required = securityRequired(venue, guests);
  if ((opts.security || required) && s?.available && guests > 0) {
    const guards = guardsFor(guests, s.guestsPerGuard);
    items.push({ key: 'security', label: 'Security', amount: guards * s.pricePerGuard, note: `${guards} guard${guards === 1 ? '' : 's'} × €${s.pricePerGuard} (1 per ${s.guestsPerGuard} guests)`, required });
  }
  (venue.extraCharges ?? []).forEach((x) => {
    if (opts.extras?.includes(x.label)) items.push({ key: 'extra', label: x.label, amount: x.amount });
  });
  const subtotal = items.reduce((n, i) => n + i.amount, 0);
  if (opts.withFee && subtotal > 0) items.push({ key: 'fee', label: 'Service fee', amount: bookingFee(subtotal) });
  return { items, total: round2(items.reduce((n, i) => n + i.amount, 0)), quote };
}

export interface ArtistEstimateOptions {
  hours: number;
  /** true = the artist's listed travel charge; a number overrides it. */
  travel?: boolean | number;
  /** true = the artist's listed equipment charge; a number overrides it. */
  equipment?: boolean | number;
  withFee?: boolean;
}

/** Artist price breakdown with travel and equipment as separate charges (F05/F14). */
export function artistEstimate(profile: Profile, opts: ArtistEstimateOptions): Estimate {
  const quote = profile.pricing === 'quote' || !profile.feePerHour;
  const items: PriceLine[] = [];
  if (!quote && profile.feePerHour) items.push({ key: 'base', label: `Performance · ${opts.hours} h`, amount: profile.feePerHour * opts.hours, note: `${opts.hours} h × €${profile.feePerHour}` });
  const travel = typeof opts.travel === 'number' ? opts.travel : opts.travel ? profile.charges?.travel : undefined;
  if (travel) items.push({ key: 'travel', label: 'Travel', amount: travel, note: profile.charges?.travelNote });
  const equipment = typeof opts.equipment === 'number' ? opts.equipment : opts.equipment ? profile.charges?.equipment : undefined;
  if (equipment) items.push({ key: 'equipment', label: 'Equipment', amount: equipment, note: profile.charges?.equipmentNote });
  const subtotal = items.reduce((n, i) => n + i.amount, 0);
  if (opts.withFee && subtotal > 0) items.push({ key: 'fee', label: 'Service fee', amount: bookingFee(subtotal) });
  return { items, total: round2(items.reduce((n, i) => n + i.amount, 0)), quote };
}

/** Lesson price (its own scope, never the performance fee). quote = request a quote. */
export function lessonEstimate(lesson: Lesson, sessions = 1, withFee = false): Estimate {
  if (lesson.quote || lesson.price == null) return { items: [], total: 0, quote: true };
  const items: PriceLine[] = [{ key: 'base', label: `${lesson.title} · ${sessions} × ${lesson.durationMin} min`, amount: lesson.price * sessions, note: `${sessions} × €${lesson.price}` }];
  if (withFee) items.push({ key: 'fee', label: 'Service fee', amount: bookingFee(items[0].amount) });
  return { items, total: round2(items.reduce((n, i) => n + i.amount, 0)), quote: false };
}

/** Store an estimate on a booking: Booking.charges from its lines (extras fold into base). */
export function toCharges(items: PriceLine[]): BookingCharges {
  const c: BookingCharges = { base: 0 };
  items.forEach((i) => {
    if (i.key === 'base' || i.key === 'extra') c.base += i.amount;
    else c[i.key] = (c[i.key] ?? 0) + i.amount;
  });
  return c;
}

/** Simple { label, amount } rows (e.g. for LineItems or a quote). */
export const toLineItems = (items: PriceLine[]) => items.map((i) => ({ label: i.label, amount: i.amount, note: i.note }));
