import type { BookingStatus } from '../data/types';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Request sent',
  pending: 'In progress',
  accepted: 'Payment pending',
  paid: 'Paid · escrow',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
  disputed: 'In dispute',
};

export const STATUS_TONE: Record<BookingStatus, 'success' | 'warning' | 'danger' | 'brand' | 'neutral'> = {
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
};

/** The happy-path lifecycle shown on the status tracker. */
export const LIFECYCLE: { status: BookingStatus; name: string; note: string }[] = [
  { status: 'requested', name: 'Request sent', note: 'Your details were sent to the provider' },
  { status: 'pending', name: 'Pending approval', note: 'They have 48 h to respond' },
  { status: 'accepted', name: 'Accepted', note: 'Price & details agreed — pay within 24 h' },
  { status: 'paid', name: 'Paid · held in escrow', note: 'Protected until the gig' },
  { status: 'confirmed', name: 'Confirmed', note: 'Chat unlocked · added to calendar' },
  { status: 'completed', name: 'Completed', note: 'Funds released · leave a review' },
];

export const isException = (s: BookingStatus) => s === 'declined' || s === 'expired' || s === 'cancelled' || s === 'disputed';
