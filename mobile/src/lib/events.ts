import { venueById } from '../data/mock';
import type { Booking, EventItem, EventState } from '../data/types';
import { chargeItems, isClosed, isConfirmed, providerOf, type Tone } from './booking';
import { parse, TODAY } from './format';

export const EVENT_STATE_LABEL: Record<EventState, string> = {
  draft: 'Draft',
  planning: 'Planning',
  published: 'Published',
  ready: 'Ready',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const EVENT_STATE_TONE: Record<EventState, Tone> = {
  draft: 'neutral',
  planning: 'warning',
  published: 'brand',
  ready: 'success',
  in_progress: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};

/** Next actions per state (blueprint section 06). */
export const EVENT_STATE_NEXT: Record<EventState, string> = {
  draft: 'Complete the details and arrange providers',
  planning: 'Resolve outstanding bookings',
  published: 'Invite guests or share the event',
  ready: 'Send reminders and prepare entry',
  in_progress: 'Check in guests and handle issues',
  completed: 'Reconcile records and support cases',
  cancelled: 'Notify participants and resolve each affected payment',
};

/** "Invitations open" for a published private event, else the plain state label. */
export function eventStateLabel(state: EventState, isPrivate?: boolean) {
  if (state === 'published' && isPrivate) return 'Invitations open';
  return EVENT_STATE_LABEL[state];
}

/** Bookings attached to the event, by booking.eventId or the event's bookingIds. */
export function linkedBookings(event: Pick<EventItem, 'id' | 'bookingIds'>, bookings: Booking[]) {
  const ids = event.bookingIds ?? [];
  return bookings.filter((b) => b.eventId === event.id || ids.includes(b.id));
}

export interface Readiness {
  /** Confirmed (or completed) provider bookings. */
  confirmed: number;
  /** Provider bookings still in play (not declined, expired or cancelled). */
  total: number;
  /** Bookings waiting on a provider, a payment, a quote or a change. */
  outstanding: Booking[];
  /** Declined, expired or cancelled: these providers need replacing. */
  closed: Booking[];
  /** All active bookings confirmed and at least one booking. */
  ready: boolean;
}

/** Which providers are confirmed and which are outstanding ("partial event readiness"). */
export function readiness(event: Pick<EventItem, 'id' | 'bookingIds'>, bookings: Booking[]): Readiness {
  const linked = linkedBookings(event, bookings);
  const closed = linked.filter((b) => isClosed(b.status));
  const active = linked.filter((b) => !isClosed(b.status));
  const confirmed = active.filter((b) => isConfirmed(b.status)).length;
  const outstanding = active.filter((b) => !isConfirmed(b.status));
  return { confirmed, total: active.length, outstanding, closed, ready: active.length > 0 && outstanding.length === 0 };
}

/**
 * The live state of an event. Stored draft/cancelled win; then the clock (in progress, completed);
 * then linked bookings: 'planning' while any provider booking is outstanding, 'ready' once all are confirmed.
 * Otherwise the stored state (sample events without one read as 'published').
 * Visibility is separate: it follows the stored state and isPrivate (see isDiscoverable in store/filters),
 * so a public event can be visible while it is still 'planning'.
 */
export function eventState(event: EventItem, bookings: Booking[], now: Date = TODAY): EventState {
  if (event.state === 'draft' || event.state === 'cancelled') return event.state;
  if (event.state === 'completed' || parse(event.end).getTime() < now.getTime()) return 'completed';
  if (parse(event.start).getTime() <= now.getTime()) return 'in_progress';
  const r = readiness(event, bookings);
  if (r.total > 0) return r.ready ? 'ready' : 'planning';
  return event.state ?? 'published';
}

export interface BudgetLine {
  label: string;
  amount: number;
  /** agreed = confirmed booking, pending = not yet confirmed, quote = waiting for a price. */
  status: 'agreed' | 'pending' | 'quote';
  bookingId?: string;
  provider?: string;
}

export interface Budget {
  items: BudgetLine[];
  /** Sum of confirmed provider costs. */
  agreed: number;
  /** Sum of costs not yet confirmed. */
  pending: number;
  total: number;
  /** Cost-sharing contributions expected from accepted guests. */
  contributions: number;
  /** Contributions already paid. */
  contributionsPaid: number;
}

/** Event budget: each provider booking as separate line items (base, travel, equipment, catering, security…). */
export function budget(event: EventItem, bookings: Booking[]): Budget {
  const items: BudgetLine[] = [];
  linkedBookings(event, bookings)
    .filter((b) => !isClosed(b.status))
    .forEach((b) => {
      const provider = providerOf(b).name;
      const awaitingQuote = b.pricing === 'quote' && (!b.quote || b.quote.items.length === 0);
      if (awaitingQuote) {
        items.push({ label: `${provider} · quote requested`, amount: 0, status: 'quote', bookingId: b.id, provider });
        return;
      }
      const status: BudgetLine['status'] = isConfirmed(b.status) ? 'agreed' : 'pending';
      chargeItems(b).forEach((c) => items.push({ label: `${provider} · ${c.label}`, amount: c.amount, status, bookingId: b.id, provider }));
    });
  const agreed = items.filter((i) => i.status === 'agreed').reduce((n, i) => n + i.amount, 0);
  const pending = items.filter((i) => i.status !== 'agreed').reduce((n, i) => n + i.amount, 0);
  const g = guestSummary(event);
  const per = event.costSharing?.enabled ? event.costSharing.perGuest : 0;
  return { items, agreed, pending, total: agreed + pending, contributions: per * g.accepted, contributionsPaid: per * g.paid };
}

export interface GuestSummary {
  invited: number;
  accepted: number;
  declined: number;
  /** Invited but not answered yet. */
  waiting: number;
  paid: number;
}

export function guestSummary(event: Pick<EventItem, 'invitations'>): GuestSummary {
  const list = event.invitations ?? [];
  return {
    invited: list.length,
    accepted: list.filter((i) => i.status === 'accepted').length,
    declined: list.filter((i) => i.status === 'declined').length,
    waiting: list.filter((i) => i.status === 'invited').length,
    paid: list.filter((i) => i.paid).length,
  };
}

/**
 * Draft validation (F11): missing or conflicting details. Empty = ready to save as more than a draft.
 * Pass `now` to flag dates in the past.
 */
export function draftIssues(e: Partial<EventItem>, now: Date = TODAY): string[] {
  const issues: string[] = [];
  if (!e.title?.trim()) issues.push('Add a title');
  if (!e.start) issues.push('Pick a date and start time');
  if (e.start && e.end && parse(e.end).getTime() <= parse(e.start).getTime()) issues.push('The end time is before the start');
  if (e.start && parse(e.start).getTime() < now.getTime()) issues.push('The date is in the past');
  if (!e.venueId) issues.push('Choose a venue or location');
  const venue = e.venueId ? venueById(e.venueId) : undefined;
  if (venue && e.expectedGuests && e.expectedGuests > venue.capacity) issues.push(`${venue.name} holds ${venue.capacity} guests; you expect ${e.expectedGuests}`);
  if (e.costSharing?.enabled && !(e.costSharing.perGuest > 0)) issues.push('Set the cost-sharing amount per guest');
  return issues;
}
