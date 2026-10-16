import { transactions } from '../data/mock';
import type { Booking, EventItem, IncomingRequest, PaymentState } from '../data/types';
import type { Availability, Payout, Weekday } from '../store/useApp';
import { isClosed } from './booking';
import { linkedBookings } from './events';
import { isoDay, MONTHS_LONG, parse, TODAY } from './format';
import { PLATFORM_COMMISSION_RATE } from './pricing';

/**
 * Pure derivations for the role dashboards (blueprint section 11): earnings totals that keep
 * booking value, commission, refunds and payouts apart, and the two-week availability strip.
 * Callers select raw store slices and derive with these outside the selector.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

/** Recorded sample income is stored net of the platform commission. */
const grossOf = (net: number) => Math.round(net / (1 - PLATFORM_COMMISSION_RATE));
const KNOWN_TITLES = new Set(transactions.map((t) => t.title));
const VERIFIED: PaymentState[] = ['paid', 'payout_pending', 'paid_out'];

/** The agreed price of a request: the quote total for quote requests, else the request total. */
export function requestGross(r: Pick<IncomingRequest, 'pricing' | 'quote' | 'offer'>) {
  return r.pricing === 'quote' && r.quote ? r.quote.total : r.offer;
}

/**
 * ISO day (YYYY-MM-DD) of a request: its isoDate, else parsed from the date label
 * ("Thu 24 Dec 2026"). Undefined when neither can be read, so callers never fall back to today.
 */
export function requestDay(r: Pick<IncomingRequest, 'isoDate' | 'date'>): string | undefined {
  if (r.isoDate) return r.isoDate;
  const [, d, mon, y] = r.date.split(' ');
  const m = mon ? MONTHS_LONG.findIndex((x) => x.startsWith(mon)) : -1;
  if (m < 0 || !Number(d) || !Number(y)) return undefined;
  return isoDay(new Date(Number(y), m, Number(d), 12));
}

export interface EarningsSummary {
  /** Booking value of verified payments (before commission). */
  gross: number;
  /** Platform commission on that value. */
  commission: number;
  /** Refunds pending or completed (net amounts taken back). */
  refunds: number;
  /** gross − commission − refunds. */
  net: number;
  /** Accepted work whose customer payment is not verified yet: never counted as earnings. */
  awaiting: number;
  awaitingCount: number;
  /** Verified, not paid out yet. */
  payoutPending: number;
  /** Available to pay out now (account balance). */
  available: number;
  /** Bank transfers completed. */
  paidOut: number;
  /** Bank transfers on their way. */
  processing: number;
  /** Number of verified booking payments behind gross. */
  count: number;
}

/**
 * Same settlement rules as Pro → Earnings: recorded sample income (artists) plus every accepted
 * or completed request that is not recorded yet. Unverified payments are listed as awaiting and
 * never counted; refunds are subtracted separately.
 * `recorded: false` uses the requests only (e.g. the venue workspace, whose sample ledger is empty).
 */
export function earningsSummary(requests: IncomingRequest[], opts: { recorded: boolean; balance: number; payouts: Payout[] }): EarningsSummary {
  const rows: { gross: number; commission: number; net: number; status: 'pending' | 'available' | 'paid out' | 'refund' }[] = [];
  let refunds = 0;
  let awaiting = 0;
  let awaitingCount = 0;
  if (opts.recorded) {
    transactions.forEach((t) => {
      if (t.status === 'fee' || t.amount < 0) return;
      const gross = grossOf(t.amount);
      const status = t.status === 'escrow' ? 'pending' : t.status === 'available' ? (opts.balance > 0 ? 'available' : 'paid out') : 'paid out';
      rows.push({ gross, commission: round2(gross - t.amount), net: t.amount, status });
    });
  }
  requests
    .filter((r) => !(opts.recorded && KNOWN_TITLES.has(r.title)) && (r.status === 'accepted' || r.status === 'past' || r.payment === 'refund_pending' || r.payment === 'refunded'))
    .forEach((r) => {
      const gross = requestGross(r);
      const commission = round2(gross * PLATFORM_COMMISSION_RATE);
      if (r.payment === 'refund_pending' || r.payment === 'refunded') {
        // Same rule as Pro → Earnings: the booking counts once in gross and commission, and its
        // reversed net amount shows under refunds, so it nets to zero (never subtracted twice).
        rows.push({ gross, commission, net: round2(gross - commission), status: 'refund' });
        refunds += round2(gross - commission);
        return;
      }
      if (!r.payment || !VERIFIED.includes(r.payment)) {
        awaiting += gross;
        awaitingCount += 1;
        return;
      }
      rows.push({ gross, commission, net: round2(gross - commission), status: r.payment === 'paid_out' ? 'paid out' : 'pending' });
    });
  const gross = sum(rows.map((r) => r.gross));
  const commission = round2(sum(rows.map((r) => r.commission)));
  return {
    gross,
    commission,
    refunds: round2(refunds),
    net: round2(gross - commission - refunds),
    awaiting,
    awaitingCount,
    payoutPending: round2(sum(rows.filter((r) => r.status === 'pending').map((r) => r.net))),
    available: opts.recorded ? opts.balance : 0,
    paidOut: opts.recorded ? sum(opts.payouts.filter((p) => p.status === 'paid').map((p) => p.amount)) : 0,
    processing: opts.recorded ? sum(opts.payouts.filter((p) => p.status === 'processing').map((p) => p.amount)) : 0,
    count: rows.length,
  };
}

// ---------- Event providers ----------

/**
 * Closed (declined, expired or cancelled) provider bookings of an event that still need a
 * replacement: one per provider type, and only while no other booking of that type is active.
 * Once the host books another artist or venue, the old closed request stops asking for action.
 */
export function toReplace(event: Pick<EventItem, 'id' | 'bookingIds'>, bookings: Booking[]): Booking[] {
  const linked = linkedBookings(event, bookings);
  const active = new Set(linked.filter((b) => !isClosed(b.status)).map((b) => b.type));
  const byType = new Map<Booking['type'], Booking>();
  linked.forEach((b) => {
    if (isClosed(b.status) && !active.has(b.type)) byType.set(b.type, b);
  });
  return [...byType.values()];
}

// ---------- Availability strip ----------

const WEEKDAYS: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** booked = accepted work, event = an event already on that date, blocked = you blocked it, open = a usual day, closed = not a usual day. */
export type StripKind = 'booked' | 'event' | 'blocked' | 'open' | 'closed';

export interface StripDay {
  iso: string;
  weekday: Weekday;
  day: number;
  kind: StripKind;
  /** What is on that day (gig titles, event names). */
  labels: string[];
}

export const STRIP_LABEL: Record<StripKind, string> = {
  booked: 'Confirmed work',
  event: 'Event at your venue',
  blocked: 'Blocked',
  open: 'Open',
  closed: 'Not a usual day',
};

/**
 * The next `days` days from `from`: confirmed commitments first, then events already on the date,
 * then blocked dates, then the usual weekly days. Availability alone never confirms anything.
 */
export function availabilityStrip(a: Availability, booked: Record<string, string[]>, events: Record<string, string[]> = {}, days = 14, from: Date = TODAY): StripDay[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
    const iso = isoDay(d);
    const weekday = WEEKDAYS[d.getDay()];
    const b = booked[iso] ?? [];
    const e = events[iso] ?? [];
    const kind: StripKind = b.length ? 'booked' : e.length ? 'event' : a.blockedDates.includes(iso) ? 'blocked' : a.days[weekday] ? 'open' : 'closed';
    return { iso, weekday, day: d.getDate(), kind, labels: [...b, ...e] };
  });
}

/** Groups titles by ISO day, e.g. accepted requests by isoDate. */
export function byDay<T>(items: T[], day: (x: T) => string | undefined, label: (x: T) => string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  items.forEach((x) => {
    const k = day(x);
    if (!k) return;
    (out[k] ??= []).push(label(x));
  });
  return out;
}

/** ISO day of an event start. */
export const eventDay = (start: string) => isoDay(parse(start));
