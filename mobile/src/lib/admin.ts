import type { IconName } from '../components/Icon';
import type { ImgKey } from '../data/images';
import type { Application, ApplicationStatus, Booking, IncomingRequest, PaymentState, ProfessionalRole, QueuedApplication, Report, SupportCase } from '../data/types';
import type { Payout, User } from '../store/useApp';
import { APPLY_FIELDS } from './access';
import { bookingRef, isClosed, isOverdue, PAYMENT_PROVIDER_LABEL, providerOf, quoteState, requestConflict, type Tone } from './booking';
import { euro, parse, plural, shortDate, TODAY } from './format';

/**
 * Admin console (blueprint section 11 "Admin" and section 12, F03 and F24–F26). Proposed and demo only.
 * Every queue and number here is derived from records in the store; nothing is invented, so an
 * account with no activity shows zero and empty states.
 */

// ---------- Applications (F03) ----------

export interface ApplicationEntry {
  /** 'me' for the signed-in user's own application, else the queue id. */
  id: string;
  mine: boolean;
  name: string;
  handle: string;
  avatar?: ImgKey;
  city: string;
  app: Application;
  reviewer?: string;
}

/** Your own application (if any) plus the review queue, oldest submission first. */
export function applicationEntries(user: User, queue: QueuedApplication[]): ApplicationEntry[] {
  const out: ApplicationEntry[] = queue.map((a) => ({ id: a.id, mine: false, name: a.applicantName, handle: a.handle, avatar: a.avatar, city: a.city, app: a, reviewer: a.reviewer }));
  const own = user.application;
  if (own) {
    // decideApplication always records the demo reviewer in the audit log.
    out.push({ id: 'me', mine: true, name: user.name, handle: user.handle, avatar: user.avatar, city: user.city, app: own, reviewer: own.decidedAt ? 'You' : undefined });
  }
  return out.sort((a, b) => a.app.submittedAt.localeCompare(b.app.submittedAt));
}

export const APPLICATION_GROUP: Record<'review' | 'info' | 'decided', ApplicationStatus[]> = {
  review: ['pending'],
  info: ['info'],
  decided: ['approved', 'rejected'],
};

/** Required answers of the role's application form that are missing or empty. */
export function missingRequired(role: ProfessionalRole, details: Record<string, string>): string[] {
  return APPLY_FIELDS[role].filter((f) => f.required && !(details[f.label] ?? '').trim()).map((f) => f.label);
}

/** Every field of the role's form (what a reviewer can ask for). */
export const requestableItems = (role: ProfessionalRole) => APPLY_FIELDS[role].map((f) => f.label);

// ---------- Booking exceptions (F24) ----------

export type ExceptionKind = 'overdue' | 'expired' | 'payment_failed' | 'disputed' | 'change' | 'event_cancelled' | 'quote_expired' | 'conflict';

export const EXCEPTION_LABEL: Record<ExceptionKind, string> = {
  overdue: 'Past the 24-hour deadline',
  expired: 'Expired request',
  payment_failed: 'Payment failed',
  disputed: 'In dispute',
  change: 'Change requested',
  event_cancelled: 'Event cancelled',
  quote_expired: 'Quote expired',
  conflict: 'Date conflict',
};

export const EXCEPTION_ICON: Record<ExceptionKind, IconName> = {
  overdue: 'timer-sand-complete',
  expired: 'calendar-remove-outline',
  payment_failed: 'credit-card-off-outline',
  disputed: 'scale-balance',
  change: 'swap-horizontal',
  event_cancelled: 'calendar-alert',
  quote_expired: 'file-document-remove-outline',
  conflict: 'calendar-alert',
};

export const EXCEPTION_TONE: Record<ExceptionKind, Tone> = {
  overdue: 'danger',
  expired: 'warning',
  payment_failed: 'danger',
  disputed: 'warning',
  change: 'warning',
  event_cancelled: 'warning',
  quote_expired: 'neutral',
  conflict: 'danger',
};

export interface BookingException {
  id: string;
  kind: ExceptionKind;
  ref: string;
  title: string;
  sub: string;
  bookingId?: string;
  requestId?: string;
}

const unresolvedMoney = (p?: PaymentState) => p === 'release_pending' || p === 'refund_pending' || p === 'capture_pending' || p === 'disputed';

/** The exceptions of one customer booking (a booking can have more than one). */
export function exceptionsOf(b: Booking, now: Date = TODAY): ExceptionKind[] {
  const out: ExceptionKind[] = [];
  if (isOverdue(b, now)) out.push('overdue');
  if (b.status === 'expired' && unresolvedMoney(b.payment)) out.push('expired');
  if (b.status === 'payment_failed' || b.payment === 'failed') out.push('payment_failed');
  if (b.status === 'disputed' || b.payment === 'disputed') out.push('disputed');
  if (b.status === 'change_requested') out.push('change');
  if (b.pendingCancellation && !isClosed(b.status) && b.status !== 'completed') out.push('event_cancelled');
  if (b.pricing === 'quote' && b.quote && b.status === 'requested' && quoteState(b.quote, now) === 'expired') out.push('quote_expired');
  return out;
}

/** Expired requests, payment failures, disputes, conflicts and other cases that need a look. */
export function bookingExceptions(bookings: Booking[], requests: IncomingRequest[], now: Date = TODAY): BookingException[] {
  const out: BookingException[] = [];
  bookings.forEach((b) => {
    const name = providerOf(b).name;
    exceptionsOf(b, now).forEach((kind) => {
      out.push({ id: `${b.id}-${kind}`, kind, ref: bookingRef(b), title: `${name} · ${b.eventTitle}`, sub: `${shortDate(b.date)} · ${euro(b.amount)}`, bookingId: b.id });
    });
  });
  requests.forEach((r) => {
    const base = { ref: requestRef(r), title: `${r.requester} · ${r.title}`, sub: `${r.date} · ${euro(requestAmount(r))}`, requestId: r.id };
    if (isOverdue(r, now)) out.push({ id: `${r.id}-overdue`, kind: 'overdue', ...base });
    if (r.status === 'expired' && unresolvedMoney(r.payment)) out.push({ id: `${r.id}-expired`, kind: 'expired', ...base });
    if (r.status === 'new' && requestConflict(r, requests)) out.push({ id: `${r.id}-conflict`, kind: 'conflict', ...base });
  });
  return out;
}

export const requestRef = (r: Pick<IncomingRequest, 'id'>) => `#${r.id.slice(-4).toUpperCase()}`;

/** Agreed or offered amount of an incoming request: the sent quote, else the offer. */
export const requestAmount = (r: IncomingRequest) => (r.quote && r.quote.version > 0 ? r.quote.total : r.offer);

/** Finds bookings by reference (#B7 or B7), event title or provider name. */
export function matchesBooking(b: Booking, query: string) {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return true;
  return bookingRef(b).toLowerCase().replace('#', '').includes(q) || b.id.toLowerCase() === q || b.eventTitle.toLowerCase().includes(q) || providerOf(b).name.toLowerCase().includes(q);
}

// ---------- Finance queue (section 08, F17–F19) ----------

export type FinanceState = PaymentState | 'processing';

export interface FinanceItem {
  id: string;
  source: 'booking' | 'request' | 'payout';
  ref: string;
  title: string;
  sub: string;
  amount: number;
  state: FinanceState;
  bookingId?: string;
  requestId?: string;
  /** Support cases linked to the booking (a resolved case never removes the item from this queue). */
  cases: SupportCase[];
}

const FINANCE_STATES: PaymentState[] = ['capture_pending', 'release_pending', 'refund_pending', 'payout_pending', 'disputed'];

export const FINANCE_STATE_LABEL: Record<FinanceState, string> = { ...PAYMENT_PROVIDER_LABEL, processing: 'Payout processing' };

/** What the finance step is waiting for, in plain English. */
export const FINANCE_NOTE: Partial<Record<FinanceState, string>> = {
  capture_pending: 'Provider accepted. Waiting for the verified payment result before the booking is confirmed.',
  release_pending: 'Request closed without a booking. The authorization release is not complete yet.',
  refund_pending: 'An authorized refund without verified completion (refund backlog).',
  payout_pending: 'Provider payout due under the settlement policy.',
  disputed: 'A case is open. The payment stays in its current state until support decides.',
  processing: 'Transfer sent to the provider’s bank account, waiting for settlement.',
};

/** Pending releases, refunds, captures, payouts and disputes, from bookings, provider requests and payouts. */
export function financeQueue(bookings: Booking[], requests: IncomingRequest[], payouts: Payout[], cases: SupportCase[]): FinanceItem[] {
  const out: FinanceItem[] = [];
  bookings.forEach((b) => {
    if (!b.payment || !FINANCE_STATES.includes(b.payment)) return;
    out.push({
      id: `b-${b.id}`,
      source: 'booking',
      ref: bookingRef(b),
      title: `${providerOf(b).name} · ${b.eventTitle}`,
      sub: `Customer booking · ${shortDate(b.date)}`,
      amount: b.amount,
      state: b.payment,
      bookingId: b.id,
      cases: cases.filter((c) => c.linked?.kind === 'booking' && c.linked.id === b.id),
    });
  });
  requests.forEach((r) => {
    if (!r.payment || !FINANCE_STATES.includes(r.payment)) return;
    out.push({ id: `r-${r.id}`, source: 'request', ref: requestRef(r), title: `${r.requester} · ${r.title}`, sub: `Provider request · ${r.date}`, amount: requestAmount(r), state: r.payment, requestId: r.id, cases: [] });
  });
  payouts.forEach((p) => {
    if (p.status !== 'processing') return;
    out.push({ id: `p-${p.id}`, source: 'payout', ref: `#${p.id.slice(-4).toUpperCase()}`, title: 'Provider payout', sub: `Requested ${shortDate(p.date)}`, amount: p.amount, state: 'processing', cases: [] });
  });
  return out;
}

export interface FinanceTotals {
  /** Verified captured payments (customer bookings and provider requests). */
  bookingValue: number;
  /** Service fees recorded on those payments. */
  fees: number;
  refundPending: number;
  refunded: number;
  /** Authorizations released without a charge. */
  released: number;
  payoutsPaid: number;
  payoutsProcessing: number;
  counts: { captured: number; refundPending: number; refunded: number; released: number };
}

const CAPTURED: PaymentState[] = ['paid', 'payout_pending', 'paid_out'];

/** Totals that keep booking value, fees, refunds and provider payouts apart (acceptance checklist). */
export function financeTotals(bookings: Booking[], requests: IncomingRequest[], payouts: Payout[]): FinanceTotals {
  const rows = [
    ...bookings.map((b) => ({ amount: b.amount, payment: b.payment, fee: b.charges?.fee ?? 0 })),
    ...requests.map((r) => ({ amount: requestAmount(r), payment: r.payment, fee: r.charges?.fee ?? 0 })),
  ];
  const sum = (states: PaymentState[], key: 'amount' | 'fee' = 'amount') => rows.filter((r) => r.payment && states.includes(r.payment)).reduce((n, r) => n + r[key], 0);
  const count = (states: PaymentState[]) => rows.filter((r) => r.payment && states.includes(r.payment)).length;
  return {
    bookingValue: sum(CAPTURED),
    fees: sum(CAPTURED, 'fee'),
    refundPending: sum(['refund_pending']),
    refunded: sum(['refunded']),
    released: sum(['released']),
    payoutsPaid: payouts.filter((p) => p.status === 'paid').reduce((n, p) => n + p.amount, 0),
    payoutsProcessing: payouts.filter((p) => p.status === 'processing').reduce((n, p) => n + p.amount, 0),
    counts: { captured: count(CAPTURED), refundPending: count(['refund_pending']), refunded: count(['refunded']), released: count(['released']) },
  };
}

// ---------- Operational metrics (section 12) ----------

export interface Metric {
  label: string;
  value: string;
  definition: string;
  basis: string;
}

/** Hours from submission to the first decision, per decided application. */
function turnaroundHours(app: Application): number | undefined {
  const history = app.history ?? [];
  const first = history.find((h) => h.status === 'pending');
  const decision = history.find((h, i) => i > 0 && h.status !== 'pending');
  if (!first || !decision) return undefined;
  return (parse(decision.at).getTime() - parse(first.at).getTime()) / 3_600_000;
}

export function adminMetrics(entries: ApplicationEntry[], bookings: Booking[], requests: IncomingRequest[], payouts: Payout[]): Metric[] {
  const turnarounds = entries.map((e) => turnaroundHours(e.app)).filter((h): h is number => h != null);
  const avg = turnarounds.length ? turnarounds.reduce((n, h) => n + h, 0) / turnarounds.length : undefined;

  const decided = requests.filter((r) => r.status !== 'new');
  const answered = decided.filter((r) => r.status === 'accepted' || r.status === 'declined' || r.status === 'past');

  const completed = bookings.filter((b) => b.status === 'completed').length;
  const totals = financeTotals(bookings, requests, payouts);

  return [
    {
      label: 'Application turnaround',
      value: avg == null ? '—' : `${Math.round(avg)} h`,
      definition: 'Submission to first substantive decision',
      basis: turnarounds.length ? `Average of ${plural(turnarounds.length, 'decided application')}` : 'No decisions recorded yet',
    },
    {
      label: 'Provider response rate',
      value: decided.length ? `${Math.round((answered.length / decided.length) * 100)}%` : '—',
      definition: 'Requests answered before the deadline ÷ requests whose window has closed',
      basis: decided.length ? `${answered.length} of ${plural(decided.length, 'request')}` : 'No closed requests yet',
    },
    {
      label: 'Booking completion rate',
      value: bookings.length ? `${Math.round((completed / bookings.length) * 100)}%` : '—',
      definition: 'Completed bookings ÷ all bookings made from this account',
      basis: bookings.length ? `${completed} of ${plural(bookings.length, 'booking')}` : 'No bookings yet',
    },
    {
      label: 'Gross transaction value',
      value: euro(totals.bookingValue),
      definition: 'Sum of verified booking payments. Refunds are reported separately',
      basis: `Refunded ${euro(totals.refunded)} · refund pending ${euro(totals.refundPending)}`,
    },
    {
      label: 'Refund backlog',
      value: String(totals.counts.refundPending),
      definition: 'Authorized refunds without verified completion',
      basis: totals.counts.refundPending ? `${euro(totals.refundPending)} waiting for the payment provider` : 'No refunds waiting',
    },
    {
      label: 'Platform contribution',
      value: 'Not defined',
      definition: 'Recognized fees minus defined direct costs',
      basis: 'Direct costs are not defined yet, so gross fees are not reported as profit',
    },
  ];
}

// ---------- Moderation (F25) ----------

export const REPORT_KIND_LABEL: Record<Report['kind'], string> = {
  post: 'Post',
  comment: 'Comment',
  profile: 'Profile',
  message: 'Private message',
  event: 'Event',
};

export const REPORT_STATUS_LABEL: Record<Report['status'], string> = {
  open: 'Open',
  dismissed: 'Dismissed',
  restricted: 'Restricted',
  removed: 'Removed',
};

export const REPORT_STATUS_TONE: Record<Report['status'], Tone> = {
  open: 'warning',
  dismissed: 'neutral',
  restricted: 'warning',
  removed: 'danger',
};
