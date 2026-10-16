import type { IconName } from '../components/Icon';
import type { Booking, EventItem, SupportCase, SupportCaseStatus, Ticket } from '../data/types';
import { bookingLabel, bookingRef, PAYMENT_LABEL, providerOf, type Tone } from './booking';
import { shortDate } from './format';

/**
 * Customer support (blueprint F27) and the support side of the admin console (F24).
 * Pure helpers: screens select raw store slices and pass them in.
 */

/** Member-facing case status. */
export const CASE_STATUS_LABEL: Record<SupportCaseStatus, string> = {
  open: 'With support',
  waiting: 'Support replied',
  resolved: 'Resolved',
};

export const CASE_STATUS_TONE: Record<SupportCaseStatus, Tone> = {
  open: 'brand',
  waiting: 'warning',
  resolved: 'success',
};

/** Support-side wording of the same status (admin console). */
export const CASE_QUEUE_LABEL: Record<SupportCaseStatus, string> = {
  open: 'Needs a reply',
  waiting: 'Waiting on the member',
  resolved: 'Resolved',
};

export type LinkKind = 'booking' | 'ticket' | 'event';

export interface IssueTopic {
  key: string;
  label: string;
  icon: IconName;
  hint: string;
  /** Records this kind of issue can be linked to. */
  links: LinkKind[];
  /** Account issues link the case to the account instead of a record. */
  account?: boolean;
}

export const ISSUE_TOPICS: IssueTopic[] = [
  { key: 'booking', label: 'A booking or quote', icon: 'calendar-clock', hint: 'Requests, quotes, changes, cancellations or a no-show', links: ['booking'] },
  { key: 'payment', label: 'Payment, refund or release', icon: 'cash-refund', hint: 'A failed payment, a refund or a released authorization', links: ['booking', 'ticket'] },
  { key: 'ticket', label: 'A ticket or entry', icon: 'ticket-confirmation-outline', hint: 'QR code, check-in, a cancelled or refunded ticket', links: ['ticket'] },
  { key: 'event', label: 'An event or invitation', icon: 'party-popper', hint: 'Event changes, cancellations or cost sharing', links: ['event'] },
  { key: 'account', label: 'My account or application', icon: 'account-circle-outline', hint: 'Sign-in, professional application, workspaces or your data', links: [], account: true },
  { key: 'safety', label: 'Safety, a report or an appeal', icon: 'shield-account-outline', hint: 'Harassment, a moderation decision you want to appeal', links: [], account: true },
  { key: 'other', label: 'Something else', icon: 'help-circle-outline', hint: 'Anything that doesn’t fit above', links: [] },
];

export const topicByKey = (key?: string) => ISSUE_TOPICS.find((t) => t.key === key);

export const LINK_KIND_LABEL: Record<LinkKind, string> = { booking: 'Booking', ticket: 'Ticket', event: 'Event' };

export const TICKET_STATUS_LABEL: Record<Ticket['status'], string> = {
  valid: 'Valid',
  used: 'Checked in',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export interface LinkedRecord {
  kind: NonNullable<SupportCase['linked']>['kind'];
  label: string;
  sub: string;
  icon: IconName;
  /** Where the record opens; missing when it no longer exists. */
  href?: string;
  booking?: Booking;
}

export interface RecordContext {
  bookings: Booking[];
  tickets: Ticket[];
  events: EventItem[];
}

const ACCOUNT_RECORD: Record<string, { label: string; sub: string; href: string; icon: IconName }> = {
  earnings: { label: 'Earnings and payouts', sub: 'Professional account', href: '/pro/earnings', icon: 'wallet-outline' },
  application: { label: 'Professional application', sub: 'Account', href: '/application', icon: 'file-document-outline' },
  deletion: { label: 'Data deletion request', sub: 'Account', href: '/account-security', icon: 'shield-account-outline' },
};

/** The record a case is about, as a tappable summary. */
export function linkedRecord(linked: SupportCase['linked'], ctx: RecordContext): LinkedRecord | undefined {
  if (!linked) return undefined;
  if (linked.kind === 'booking') {
    const b = ctx.bookings.find((x) => x.id === linked.id);
    if (!b) return { kind: 'booking', label: 'Booking no longer available', sub: 'The record history is kept by support', icon: 'calendar-remove-outline' };
    return {
      kind: 'booking',
      label: `${providerOf(b).name} · ${b.eventTitle}`,
      sub: `Booking ${bookingRef(b)} · ${bookingLabel(b)}${b.payment ? ` · ${PAYMENT_LABEL[b.payment]}` : ''}`,
      icon: b.type === 'venue' ? 'storefront-outline' : 'account-music-outline',
      href: `/booking/${b.id}`,
      booking: b,
    };
  }
  if (linked.kind === 'ticket') {
    const t = ctx.tickets.find((x) => x.id === linked.id);
    if (!t) return { kind: 'ticket', label: 'Ticket no longer available', sub: 'The record history is kept by support', icon: 'ticket-outline' };
    const e = ctx.events.find((x) => x.id === t.eventId);
    return { kind: 'ticket', label: e?.title ?? 'Ticket', sub: `Ticket ${t.code} · ${TICKET_STATUS_LABEL[t.status]}`, icon: 'ticket-confirmation-outline', href: `/ticket/${t.id}` };
  }
  if (linked.kind === 'event') {
    const e = ctx.events.find((x) => x.id === linked.id);
    if (!e) return { kind: 'event', label: 'Event no longer available', sub: 'The record history is kept by support', icon: 'calendar-remove-outline' };
    return { kind: 'event', label: e.title, sub: `Event · ${shortDate(e.start)}`, icon: 'party-popper', href: `/event/${e.id}` };
  }
  const acc = ACCOUNT_RECORD[linked.id];
  return acc ? { kind: 'account', ...acc } : { kind: 'account', label: 'Your account', sub: 'General account support', icon: 'account-circle-outline', href: '/account-security' };
}

/** A refund or release on the case's booking that is not complete yet. A case closure must not hide it. */
export function pendingMoney(c: Pick<SupportCase, 'linked'>, bookings: Booking[]): Booking | undefined {
  if (c.linked?.kind !== 'booking') return undefined;
  const b = bookings.find((x) => x.id === c.linked?.id);
  return b && (b.payment === 'refund_pending' || b.payment === 'release_pending') ? b : undefined;
}

export const lastMessage = (c: SupportCase) => c.messages[c.messages.length - 1];

/** Time of the latest message (or the creation time). */
export const lastUpdate = (c: SupportCase) => lastMessage(c)?.at ?? c.createdAt;

/** Newest activity first. */
export const byLastUpdate = (a: SupportCase, b: SupportCase) => lastUpdate(b).localeCompare(lastUpdate(a));
