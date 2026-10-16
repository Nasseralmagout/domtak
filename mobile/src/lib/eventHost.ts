import type { Booking, CostSharing, EventItem, GuestInvite, Invitation } from '../data/types';
import { activeWorkspace, type User } from '../store/useApp';
import { bookingLabel, providerOf, STATUS_LABEL, type Tone } from './booking';
import type { Readiness } from './events';
import { euro, isoDay, parse, TODAY } from './format';

/**
 * Event hosting helpers for the events and guests screens (blueprint F11–F13, F20).
 * Pure functions: callers select raw store slices and derive with these outside the selector.
 */

/** Sample organizers that count as "you" in an approved organizer workspace (demo data). */
export const DEMO_ORGANIZERS = ['mobolosa', 'og'];

/** Whether the signed-in user manages this event: their own, or a demo organizer event in an approved organizer workspace. */
export function hostsEvent(event: Pick<EventItem, 'organizerId' | 'hostId'>, user: User) {
  if (event.organizerId === 'me' || event.hostId === 'me') return true;
  return activeWorkspace(user) === 'organizer' && DEMO_ORGANIZERS.includes(event.organizerId);
}

const WAITING_ON: Partial<Record<Booking['status'], string>> = {
  requested: 'awaiting reply',
  pending: 'awaiting reply',
  accepted: 'finalizing payment',
  payment_failed: 'payment failed',
  change_requested: 'change requested',
};

/** What an outstanding booking is waiting for, in lower case: "awaiting reply", "quote received"… */
export function waitingOn(b: Booking) {
  if (b.pricing === 'quote' && b.status === 'requested') return bookingLabel(b).toLowerCase();
  return WAITING_ON[b.status] ?? STATUS_LABEL[b.status].toLowerCase();
}

/**
 * Partial event readiness in one line (blueprint section 13):
 * "1 of 2 providers confirmed; Moon Club awaiting reply". Never claims more than is confirmed.
 */
export function readinessLine(r: Readiness) {
  if (r.total === 0 && r.closed.length === 0) return 'No provider bookings yet';
  const parts: string[] = [];
  if (r.total > 0) parts.push(`${r.confirmed} of ${r.total} provider${r.total === 1 ? '' : 's'} confirmed`);
  if (r.outstanding.length) parts.push(r.outstanding.map((b) => `${providerOf(b).name} ${waitingOn(b)}`).join(', '));
  if (r.closed.length) parts.push(`${r.closed.map((b) => providerOf(b).name).join(', ')} ${r.closed.length === 1 ? 'needs' : 'need'} replacing`);
  return parts.join('; ');
}

/** Host-side label for one invited guest. */
export function invitationLabel(inv: Invitation, cs?: CostSharing): { label: string; tone: Tone } {
  if (inv.status === 'declined') return { label: 'Declined', tone: 'danger' };
  if (inv.status === 'invited') return { label: 'No answer yet', tone: 'neutral' };
  if (cs?.enabled && cs.perGuest > 0) return inv.paid ? { label: 'Paid · ticket issued', tone: 'success' } : { label: `Accepted · ${euro(cs.perGuest)} due`, tone: 'warning' };
  return { label: 'Accepted · ticket issued', tone: 'success' };
}

/** Guest-side label for an invitation you received. */
export function guestInviteLabel(g: GuestInvite): { label: string; tone: Tone } {
  if (g.status === 'declined') return { label: 'You declined', tone: 'neutral' };
  if (g.status === 'invited') return { label: 'Invitation · no answer yet', tone: 'brand' };
  if (g.ticketId) return { label: 'Going · ticket ready', tone: 'success' };
  if (g.payment === 'failed') return { label: 'Payment failed · no ticket', tone: 'danger' };
  return { label: g.contribution ? `Accepted · ${euro(g.contribution)} to pay` : 'Accepted', tone: 'warning' };
}

/** Cost-sharing deadline choices before the event (ISO days after the demo today). */
export function deadlineChoices(eventStart: string, now: Date = TODAY): { label: string; day: string }[] {
  const start = parse(eventStart);
  const day = (daysBefore: number) => isoDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() - daysBefore, 12));
  return [
    { label: '1 week before', day: day(7) },
    { label: '3 days before', day: day(3) },
    { label: '1 day before', day: day(1) },
  ].filter((c) => parse(c.day).getTime() > now.getTime());
}
