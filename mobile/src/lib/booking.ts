import type { ImgKey } from '../data/images';
import { profileById, venueById } from '../data/mock';
import type { Booking, BookingStatus, IncomingRequest, Lesson, PaymentState, Quote, QuoteItem, QuoteStatus } from '../data/types';
import { parse, TODAY } from './format';

export type Tone = 'success' | 'warning' | 'danger' | 'brand' | 'neutral';

/** Provider response window and reminder (blueprint section 07). */
export const RESPONSE_HOURS = 24;
export const REMINDER_HOURS = 12;

/** Booking states as the blueprint names them. 'paid' is a legacy step kept for older saved bookings. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Request sent',
  pending: 'Awaiting provider',
  accepted: 'Accepted · finalizing payment',
  paid: 'Payment verified',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
  disputed: 'In dispute',
  change_requested: 'Change requested',
  payment_failed: 'Payment failed',
};

export const STATUS_TONE: Record<BookingStatus, Tone> = {
  requested: 'brand',
  pending: 'warning',
  accepted: 'warning',
  paid: 'success',
  confirmed: 'success',
  completed: 'success',
  declined: 'danger',
  expired: 'warning',
  cancelled: 'danger',
  disputed: 'warning',
  change_requested: 'warning',
  payment_failed: 'danger',
};

/** Who owns the next action in each state (blueprint booking state table). */
export const STATUS_NEXT_OWNER: Record<BookingStatus, string> = {
  requested: 'Provider',
  pending: 'Provider',
  accepted: 'Payment system or customer',
  paid: 'System',
  confirmed: 'Customer and provider',
  completed: 'System',
  declined: 'System',
  expired: 'System',
  cancelled: 'Support',
  disputed: 'Support',
  change_requested: 'Both parties',
  payment_failed: 'Customer',
};

/** The happy-path lifecycle shown on the status tracker (listed price). */
export const LIFECYCLE: { status: BookingStatus; name: string; note: string }[] = [
  { status: 'requested', name: 'Request sent', note: 'Your details and payment step reach the provider' },
  { status: 'pending', name: 'Awaiting provider', note: `They have ${RESPONSE_HOURS} h to accept or decline · reminder after ${REMINDER_HOURS} h` },
  { status: 'accepted', name: 'Accepted · finalizing payment', note: 'Confirmed only once the payment is verified' },
  { status: 'confirmed', name: 'Confirmed', note: 'Agreed terms are kept · chat and calendar ready' },
  { status: 'completed', name: 'Completed', note: 'Records are reconciled · leave a review' },
];

/** Lifecycle of a quote-based booking (F15). */
export const QUOTE_LIFECYCLE: { key: 'requested' | 'sent' | 'accepted' | 'confirmed' | 'completed'; name: string; note: string }[] = [
  { key: 'requested', name: 'Quote requested', note: 'The provider reviews your event details' },
  { key: 'sent', name: 'Quote received', note: 'Check the itemised price and ask questions in chat' },
  { key: 'accepted', name: 'Quote accepted · payment', note: 'Confirmed only once the payment is verified' },
  { key: 'confirmed', name: 'Confirmed', note: 'Agreed terms are kept · chat and calendar ready' },
  { key: 'completed', name: 'Completed', note: 'Records are reconciled · leave a review' },
];

/** States that have their own exception screen (booking/issue). */
export const isException = (s: BookingStatus) => s === 'declined' || s === 'expired' || s === 'cancelled' || s === 'disputed';

/** Closed without a booking: the provider slot is free again and money is released or refunded. */
export const isClosed = (s: BookingStatus) => s === 'declined' || s === 'expired' || s === 'cancelled';

/** Confirmed work (or done). */
export const isConfirmed = (s: BookingStatus) => s === 'confirmed' || s === 'paid' || s === 'completed';

/** Still open: waiting on the provider, the payment, a quote or a change. */
export const isOutstanding = (s: BookingStatus) => s === 'requested' || s === 'pending' || s === 'accepted' || s === 'change_requested' || s === 'payment_failed';

/** Index into LIFECYCLE for a status (legacy 'paid' and side states map onto the main track). */
export function lifecycleIndex(s: BookingStatus) {
  const key: BookingStatus = s === 'paid' || s === 'change_requested' ? 'confirmed' : s === 'payment_failed' ? 'accepted' : s;
  return LIFECYCLE.findIndex((l) => l.status === key);
}

/** Index into QUOTE_LIFECYCLE for a quote-based booking. */
export function quoteStepIndex(b: Booking, now: Date = TODAY) {
  if (b.status === 'completed') return 4;
  if (isConfirmed(b.status) || b.status === 'change_requested') return 3;
  const q = b.quote ? quoteState(b.quote, now) : 'requested';
  if (q === 'accepted' || b.status === 'accepted' || b.status === 'payment_failed') return 2;
  if (q === 'sent' || q === 'revised') return 1;
  return 0;
}

// ---------- Payment states (section 08) ----------

/** Customer-facing payment label. */
export const PAYMENT_LABEL: Record<PaymentState, string> = {
  not_started: 'Payment needed',
  authorized: 'Pending provider decision',
  capture_pending: 'Finalizing payment',
  paid: 'Payment confirmed',
  release_pending: 'Release pending',
  released: 'Released · not charged',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
  failed: 'Payment failed',
  payout_pending: 'Payment confirmed',
  paid_out: 'Payment confirmed',
  disputed: 'In dispute',
};

/** Provider / admin view of the same state. */
export const PAYMENT_PROVIDER_LABEL: Record<PaymentState, string> = {
  not_started: 'No payable booking',
  authorized: 'Authorized · awaiting your decision',
  capture_pending: 'Waiting for verified payment',
  paid: 'Paid',
  release_pending: 'Release pending',
  released: 'Released',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
  failed: 'No successful charge',
  payout_pending: 'Payout pending',
  paid_out: 'Paid out',
  disputed: 'In dispute',
};

export const PAYMENT_TONE: Record<PaymentState, Tone> = {
  not_started: 'neutral',
  authorized: 'brand',
  capture_pending: 'warning',
  paid: 'success',
  release_pending: 'warning',
  released: 'neutral',
  refund_pending: 'warning',
  refunded: 'neutral',
  failed: 'danger',
  payout_pending: 'warning',
  paid_out: 'success',
  disputed: 'warning',
};

/** Plain-English explanation for the customer. No escrow promise: the payment model is still open. */
export const PAYMENT_NOTE: Record<PaymentState, string> = {
  not_started: 'No payment has been taken yet. Complete the payment step to continue.',
  authorized: 'Payment pending the provider’s decision. Released or refunded if they decline or don’t answer within 24 hours.',
  capture_pending: 'The provider accepted. We’re finalizing your payment; the booking is confirmed only once the payment is verified.',
  paid: 'Payment verified. The booking is confirmed.',
  release_pending: 'This request closed without a booking. The payment authorization is being released.',
  released: 'The payment authorization was released. You were not charged.',
  refund_pending: 'A refund is on its way. It is complete only once the payment provider confirms it.',
  refunded: 'The refund is complete.',
  failed: 'The payment didn’t go through and nothing was charged. Retry on this booking or choose another method.',
  payout_pending: 'Payment verified. The booking is confirmed.',
  paid_out: 'Payment verified. The booking is confirmed.',
  disputed: 'A case is open. The payment state stays visible while support looks into it.',
};

/** The payment state a booking moves to when its status changes (keeps status and money consistent). */
export function paymentAfter(status: BookingStatus, current?: PaymentState): PaymentState | undefined {
  switch (status) {
    case 'pending':
      return 'authorized';
    case 'accepted':
      return current === 'authorized' || current === undefined ? 'capture_pending' : current;
    case 'paid':
    case 'confirmed':
      return current === 'payout_pending' || current === 'paid_out' ? current : 'paid';
    case 'completed':
      return current ?? 'paid';
    case 'declined':
    case 'expired':
    case 'cancelled':
      if (current === 'authorized' || current === 'capture_pending') return 'release_pending';
      if (current === 'paid') return 'refund_pending';
      return current;
    case 'payment_failed':
      return 'failed';
    default:
      // requested, change_requested and disputed keep the underlying payment state visible.
      return current;
  }
}

/** The next financial step a pending state resolves to (for demo controls and reconciliation). */
export function nextPaymentStep(state?: PaymentState): PaymentState | undefined {
  switch (state) {
    case 'capture_pending':
      return 'paid';
    case 'release_pending':
      return 'released';
    case 'refund_pending':
      return 'refunded';
    case 'payout_pending':
      return 'paid_out';
    default:
      return undefined;
  }
}

/** What happens to the money if this booking is cancelled now. */
export function cancellationOutcome(b: Pick<Booking, 'payment'>) {
  if (b.payment === 'paid') return 'A refund is requested under the cancellation policy. It is not complete until the payment provider confirms it.';
  if (b.payment === 'authorized' || b.payment === 'capture_pending') return 'The payment authorization is released. You won’t be charged.';
  return 'No payment was taken, so nothing is charged.';
}

// ---------- Quotes (F15) ----------

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  requested: 'Quote requested',
  sent: 'Quote received',
  revised: 'Revised quote',
  accepted: 'Quote accepted',
  rejected: 'Quote declined',
  expired: 'Quote expired',
};

export const QUOTE_STATUS_TONE: Record<QuoteStatus, Tone> = {
  requested: 'brand',
  sent: 'warning',
  revised: 'warning',
  accepted: 'success',
  rejected: 'neutral',
  expired: 'neutral',
};

export const quoteTotal = (items: QuoteItem[]) => items.reduce((n, i) => n + i.amount, 0);

/** A sent quote past its validUntil day reads as 'expired'. */
export function quoteState(q: Quote, now: Date = TODAY): QuoteStatus {
  if ((q.status === 'sent' || q.status === 'revised') && q.validUntil && parse(q.validUntil).getTime() < now.getTime() - 12 * 3_600_000) return 'expired';
  return q.status;
}

export const quoteExpired = (q: Quote, now: Date = TODAY) => quoteState(q, now) === 'expired';

/** Status label that knows about quotes: "Quote received" instead of "Request sent". */
export function bookingLabel(b: Pick<Booking, 'status' | 'pricing' | 'quote'>, now: Date = TODAY) {
  if (b.pricing === 'quote' && b.quote && b.status === 'requested') return QUOTE_STATUS_LABEL[quoteState(b.quote, now)];
  return STATUS_LABEL[b.status];
}

export function bookingTone(b: Pick<Booking, 'status' | 'pricing' | 'quote'>, now: Date = TODAY): Tone {
  if (b.pricing === 'quote' && b.quote && b.status === 'requested') return QUOTE_STATUS_TONE[quoteState(b.quote, now)];
  return STATUS_TONE[b.status];
}

// ---------- Deadlines ----------

/** "23 h left", "45 min left", "3 days left" or "Expired". Empty when there is no deadline. */
export function timeLeft(deadline?: string, now: Date = TODAY) {
  if (!deadline) return '';
  const ms = parse(deadline).getTime() - now.getTime();
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min left`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} h left`;
  return `${Math.floor(h / 24)} days left`;
}

/** Tone for a deadline: danger when expired, warning under 12 h, brand otherwise. */
export function deadlineTone(deadline?: string, now: Date = TODAY): Tone {
  if (!deadline) return 'neutral';
  const h = (parse(deadline).getTime() - now.getTime()) / 3_600_000;
  if (h <= 0) return 'danger';
  if (h < REMINDER_HOURS) return 'warning';
  return 'brand';
}

/** A request still awaiting the provider after its 24-hour deadline. */
export function isOverdue(b: { status: string; deadline?: string }, now: Date = TODAY) {
  return (b.status === 'pending' || b.status === 'new') && !!b.deadline && parse(b.deadline).getTime() <= now.getTime();
}

/** The 12-hour reminder applies only while the request is still awaiting a response. */
export function reminderDue(b: { status: string; deadline?: string; reminderAt?: string }, now: Date = TODAY) {
  if (b.status !== 'pending' && b.status !== 'new') return false;
  if (!b.reminderAt) return false;
  return parse(b.reminderAt).getTime() <= now.getTime() && !isOverdue(b, now);
}

// ---------- Display helpers ----------

/** "#B1" style booking reference, stable across devices. */
export const bookingRef = (b: Pick<Booking, 'id'>) => `#${b.id.slice(-4).toUpperCase()}`;

export interface ProviderInfo {
  name: string;
  image?: ImgKey;
  kind: 'artist' | 'venue';
  /** Public page of the provider. */
  href: string;
  subtitle: string;
}

/** Who a booking is with: artist (performance or lesson) or venue. */
export function providerOf(b: Pick<Booking, 'type' | 'targetId'>): ProviderInfo {
  if (b.type === 'venue') {
    const v = venueById(b.targetId);
    return { name: v?.name ?? 'Venue', image: v?.cover, kind: 'venue', href: `/venue/${b.targetId}`, subtitle: v ? `${v.type} · ${v.area}` : 'Venue' };
  }
  const p = profileById(b.targetId);
  return { name: p?.name ?? 'Artist', image: p?.avatar, kind: 'artist', href: `/artist/${b.targetId}`, subtitle: b.type === 'lesson' ? 'Lesson' : p?.title ?? 'Artist' };
}

/** The lesson a 'lesson' booking is for. */
export function lessonOf(b: Pick<Booking, 'type' | 'targetId' | 'lessonId'>): Lesson | undefined {
  if (b.type !== 'lesson' || !b.lessonId) return undefined;
  return profileById(b.targetId)?.lessons?.find((l) => l.id === b.lessonId);
}

export const CHARGE_LABEL = {
  travel: 'Travel',
  equipment: 'Equipment',
  catering: 'Catering',
  security: 'Security',
  fee: 'Service fee',
} as const;

const BASE_LABEL: Record<Booking['type'], string> = { musician: 'Performance fee', venue: 'Venue hire', lesson: 'Lesson' };

/** Itemised agreed price: the quote items for quote bookings, else the stored charges, else the total. */
export function chargeItems(b: Pick<Booking, 'type' | 'amount' | 'hours' | 'charges' | 'quote' | 'pricing'>): QuoteItem[] {
  if (b.pricing === 'quote' && b.quote && b.quote.items.length) return b.quote.items;
  const c = b.charges;
  const base = `${BASE_LABEL[b.type]}${b.type === 'musician' ? ` · ${b.hours} h` : ''}`;
  if (!c) return [{ label: base, amount: b.amount }];
  const items: QuoteItem[] = [{ label: base, amount: c.base }];
  (['travel', 'equipment', 'catering', 'security', 'fee'] as const).forEach((k) => {
    const v = c[k];
    if (v) items.push({ label: CHARGE_LABEL[k], amount: v });
  });
  return items;
}

// ---------- Provider side ----------

export const REQUEST_STATUS_LABEL: Record<IncomingRequest['status'], string> = {
  new: 'Awaiting your response',
  accepted: 'Accepted',
  declined: 'Declined',
  past: 'Completed',
  expired: 'Expired',
};

/** An accepted request on the same day, which blocks accidental acceptance (F16). */
export function requestConflict(req: IncomingRequest, all: IncomingRequest[]) {
  if (!req.isoDate) return undefined;
  return all.find((r) => r.id !== req.id && r.status === 'accepted' && r.isoDate === req.isoDate);
}
