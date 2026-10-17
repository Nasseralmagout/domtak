import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { IconName } from '../components/Icon';
import type { ImgKey } from '../data/images';
import {
  applicationQueue as seedApplicationQueue,
  conversations as seedConversations,
  events as seedEvents,
  incomingRequests,
  initialBookings,
  initialFriendRequests,
  initialFriends,
  initialGuestInvites,
  initialReports,
  initialSupportCases,
  posts as seedPosts,
  privateEvents as seedPrivateEvents,
  profileById,
  ratingFor,
  reviewCountFor,
  venueById,
  venues as seedVenues,
} from '../data/mock';
import type {
  Application,
  ApplicationStatus,
  AuditEntry,
  Booking,
  BookingStatus,
  Comment,
  Conversation,
  CostSharing,
  EventItem,
  EventState,
  ExtraCharge,
  FriendRequest,
  GuestInvite,
  IncomingRequest,
  Invitation,
  Message,
  PaymentState,
  Post,
  PostVisibility,
  PricingMode,
  ProfessionalRole,
  QueuedApplication,
  QuoteItem,
  Report,
  ReportKind,
  ReportStatus,
  Role,
  SupportCase,
  Ticket,
  Venue,
  VenueCatering,
  VenueGarden,
  VenueParking,
  VenueSecurity,
} from '../data/types';
import { isClosed, isOutstanding, isOverdue, paymentAfter, PAYMENT_PROVIDER_LABEL, providerOf, quoteState, quoteTotal, RESPONSE_HOURS, REMINDER_HOURS, type Tone } from '../lib/booking';
import { addHours, euro, isoDay, nowIso, ticketCode, TODAY, uid } from '../lib/format';
import { artistScore as artistScoreOf } from '../lib/ratings';

export interface User {
  name: string;
  handle: string;
  email: string;
  phone: string;
  bio: string;
  city: string;
  avatar?: ImgKey;
  /** The ACTIVE workspace. Switch with switchWorkspace(); only approved roles are allowed. */
  role: Role;
  genres: string[];
  pro: 'none' | 'review' | 'verified';
  /** Workspaces this account may use. Always includes 'fan' (the member workspace). */
  approvedRoles: Role[];
  /** The latest professional application and its review outcome (F02). */
  application?: Application;
}

export interface PaymentMethod {
  id: string;
  label: string;
  sub: string;
  badge: string;
}

export type CheckoutDraft =
  | { kind: 'ticket'; eventId: string; typeId: string; qty: number }
  | { kind: 'booking'; bookingId: string };

export interface Review {
  /** Stars for venues and events. For musician bookings pass 0: the score comes from recommend + tags. */
  rating: number;
  text: string;
  tags: string[];
  /** Musician bookings: would you book them again? */
  recommend?: boolean;
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Availability {
  days: Record<Weekday, boolean>;
  blockedDates: string[]; // ISO days (YYYY-MM-DD)
  feePerHour: number;
  minHours: number;
  radiusKm: number;
  instantBook: boolean;
}

export interface Promotion {
  id: string;
  eventId: string;
  budget: number;
  days: number;
  radiusKm: number;
  audience: string[];
  createdAt: string;
}

export interface Payout {
  id: string;
  amount: number;
  date: string;
  status: 'paid' | 'processing';
}

export interface VenueListing {
  name: string;
  area: string;
  type: 'Club' | 'Open air' | 'Hall' | 'Loft' | 'Garden' | 'Bar';
  capacity: number;
  rooms: number;
  stages: number;
  pricePerNight: number;
  /** Parking available (yes/no). Details live in parkingDetails; the two are kept in sync. */
  parking: boolean;
  equipment: string;
  occasions: string[];
  description: string;
  photos: ImgKey[];
  parkingDetails?: VenueParking;
  /** Garden / outdoor space, separate from parking. */
  garden?: VenueGarden;
  facilities?: string[];
  requirements?: string[];
  pricing?: PricingMode;
  catering?: VenueCatering;
  security?: VenueSecurity;
  extraCharges?: ExtraCharge[];
}

export interface Prefs {
  bookings: boolean;
  messages: boolean;
  nearby: boolean;
  privateAccount: boolean;
  language: 'English' | 'Deutsch';
  /** Stay signed in after the app restarts. When false, a reload signs you out. */
  rememberMe: boolean;
  /** Ask for a code from the phone at every new sign-in. */
  twoFactor: boolean;
}

/** Input for requestQuote: a booking request without a price. */
export type QuoteRequestInput = Omit<Booking, 'id' | 'status' | 'createdAt' | 'amount' | 'pricing' | 'quote' | 'payment' | 'deadline' | 'reminderAt'> & { amount?: number };

/** Event fields addEvent / saveEventDraft accept. */
export type NewEvent = Omit<EventItem, 'id' | 'going' | 'rating' | 'distanceKm' | 'organizerId'>;

interface State {
  onboarded: boolean;
  authed: boolean;
  user: User;
  prefs: Prefs;

  likes: Record<string, boolean>;
  saves: Record<string, boolean>;
  following: Record<string, boolean>;
  going: Record<string, boolean>;
  wishlist: { events: string[]; artists: string[]; venues: string[] };

  myPosts: Post[];
  extraComments: Record<string, Comment[]>;
  /** Comment hearts (post and event discussion comments), keyed by comment id. */
  likedComments: Record<string, boolean>;
  myEvents: EventItem[];
  /** Organizer edits to sample events the demo organizer runs (your own events are edited in myEvents). */
  eventEdits: Record<string, Partial<EventItem>>;
  tickets: Ticket[];
  bookings: Booking[];
  requests: IncomingRequest[];
  conversations: Conversation[];
  reviews: Record<string, Review>;
  readNotifications: boolean;

  paymentMethods: PaymentMethod[];
  selectedPayment: string;
  checkout?: CheckoutDraft;

  blocked: string[];
  /** Door check-ins per event: ticket codes scanned at the entrance. */
  checkIns: Record<string, string[]>;
  /** When each code was first checked in: eventId -> code -> ISO time (scanner shows the previous check-in). */
  checkInLog: Record<string, Record<string, string>>;
  availability: Availability;
  promotions: Promotion[];
  plan: 'free' | 'monthly' | 'yearly';
  venueListing: VenueListing;
  payouts: Payout[];
  balance: number;

  /** Profile ids of your friends (F10). */
  friends: string[];
  friendRequests: FriendRequest[];
  /** Platform communities you joined (F09). */
  joinedCommunities: string[];
  /** Invitations you received as a guest (F20). */
  guestInvites: GuestInvite[];
  supportCases: SupportCase[];
  /** Reports you filed plus the moderation queue (F25). */
  reports: Report[];
  /** Ids of posts, comments, events or profiles removed by moderation. */
  removedContent: string[];
  /** Other people's professional applications (admin review queue, F03). */
  applicationQueue: QueuedApplication[];
  auditLog: AuditEntry[];
  /** Demo switch that opens the admin console. Not a Role. */
  adminMode: boolean;

  // actions
  completeOnboarding: () => void;
  /** Pass `remember` to also set prefs.rememberMe (false: signed out again after a reload). */
  signIn: (email: string, remember?: boolean) => void;
  /** Registers a member: role 'fan', approvedRoles ['fan'], no application. */
  register: (u: Partial<User>) => void;
  signOut: () => void;
  updateUser: (u: Partial<User>) => void;
  setPref: <K extends keyof State['prefs']>(k: K, v: State['prefs'][K]) => void;

  /** Submits (or resubmits) a professional application. It never grants access by itself. */
  submitApplication: (role: ProfessionalRole, details: Record<string, string>) => void;
  /** Decides your own application (admin console or the labelled demo shortcut). Approving adds the role to approvedRoles. */
  decideApplication: (status: Exclude<ApplicationStatus, 'pending'>, opts?: { reason?: string; missing?: string[] }) => void;
  /** Decides an application in the admin queue. */
  reviewApplication: (id: string, status: Exclude<ApplicationStatus, 'pending'>, opts?: { reason?: string; missing?: string[] }) => void;
  /** Switches the active workspace. Returns false (and changes nothing) for a role that is not approved. */
  switchWorkspace: (role: Role) => boolean;

  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleFollow: (profileId: string) => void;
  toggleGoing: (eventId: string) => void;
  toggleWish: (kind: keyof State['wishlist'], id: string) => void;

  /** Followers-only posts appear in the Following feed only; Public (default) posts in every feed. Gate the UI with canPostToFeed(user). */
  addPost: (p: Omit<Post, 'id' | 'likes' | 'comments' | 'shares' | 'time' | 'feed' | 'authorId'>, visibility?: PostVisibility) => string;
  /** Comments may carry photos (the only place members can share photos). */
  addComment: (postId: string, text: string, photos?: ImgKey[]) => void;
  toggleCommentLike: (commentId: string) => void;
  /** Public events by an account that cannot publish (see canPublishPublicEvents) are saved as drafts. */
  addEvent: (e: NewEvent) => string;
  /** Saves changes to an event you organise (ticket sales and going counts are kept). */
  updateEvent: (id: string, patch: Partial<Omit<EventItem, 'id' | 'organizerId'>>) => void;
  /** addEvent with state 'draft'. */
  saveEventDraft: (e: NewEvent) => string;
  /** Returns false when publishing a public event without organizer approval. */
  setEventState: (id: string, state: EventState) => boolean;
  /** Attaches a booking to an event (sets booking.eventId and event.bookingIds). */
  linkBooking: (eventId: string, bookingId: string) => void;
  /** Invites profiles to an event you host (already invited ones are skipped). */
  inviteGuests: (eventId: string, profileIds: string[]) => void;
  /** Records a guest's answer on an event you host (demo control for guest responses). */
  setInvitationStatus: (eventId: string, profileId: string, status: Invitation['status'], paid?: boolean) => void;
  setCostSharing: (eventId: string, cs: CostSharing | undefined) => void;
  /** Cancels the event. Linked bookings are NOT cancelled: they are flagged for the cancellation process. */
  cancelEvent: (id: string, reason: string) => void;
  /** Answers an invitation you received. Accepting a free invitation issues the ticket immediately. */
  respondInvite: (id: string, status: 'accepted' | 'declined') => void;
  /** Pays the cost-sharing contribution and issues a ticket with a QR code. A failed payment never issues a ticket. */
  payContribution: (id: string, opts?: { fail?: boolean }) => { ok: boolean; ticketId?: string };

  startTicketCheckout: (eventId: string, typeId: string, qty: number) => void;
  startBookingCheckout: (bookingId: string) => void;
  /** Bookings: a verified payment confirms the booking (status 'confirmed', payment 'paid'). */
  completeCheckout: () => { kind: 'ticket'; ids: string[] } | { kind: 'booking'; id: string } | undefined;

  /** Listed-price request: payment 'authorized' (pending the provider's decision), 24 h deadline, 12 h reminder. */
  createBooking: (b: Omit<Booking, 'id' | 'status' | 'createdAt'>) => string;
  /** Changes status and moves the payment state with it (see paymentAfter in lib/booking). */
  setBookingStatus: (id: string, status: BookingStatus) => void;
  /** Quote request (F15): pricing 'quote', quote.status 'requested', nothing charged. */
  requestQuote: (input: QuoteRequestInput) => string;
  /** Provider sends (or revises) an itemised quote. A revision needs the customer's acceptance again. */
  sendQuote: (bookingId: string, items: QuoteItem[], validUntil: string, note?: string) => void;
  /** Accepts a valid quote: the booking moves to 'accepted' and waits for payment. False if expired or not sent. */
  acceptQuote: (bookingId: string) => boolean;
  /** Declines the quote: the offer ends without a paid booking. */
  rejectQuote: (bookingId: string) => void;
  setPayment: (bookingId: string, payment: PaymentState) => void;
  /** Payment step failed: status 'payment_failed', payment 'failed', nothing charged. */
  failPayment: (bookingId: string) => void;
  /** Retries on the SAME booking (never creates a second booking or charge). */
  retryPayment: (bookingId: string) => void;
  /** Verified successful payment: status 'confirmed', payment 'paid'. */
  verifyPayment: (bookingId: string) => void;
  /** Asks for changed terms; agreed terms stay until the other side accepts (resolveChange). */
  requestChange: (bookingId: string, note: string) => void;
  resolveChange: (bookingId: string, accept: boolean) => void;
  /** Cancels with a reason; an authorization is released, a captured payment goes to refund pending. */
  cancelBooking: (bookingId: string, reason: string) => void;
  /** Expires requests still awaiting the provider after their deadline. Returns how many expired. */
  expireOverdue: (now?: Date) => number;

  setRequestStatus: (id: string, status: IncomingRequest['status']) => void;
  /** Sends a counter offer: stores amount and note on the request and leaves its status unchanged ('new' stays 'new'). */
  counterRequest: (id: string, amount: number, note?: string) => void;
  /** Provider side: sends (or revises) an itemised quote on an incoming quote request. */
  quoteRequest: (id: string, items: QuoteItem[], validUntil: string, note?: string) => void;
  setRequestPayment: (id: string, payment: PaymentState) => void;

  sendMessage: (conversationId: string, msg: Omit<Message, 'id' | 'time' | 'from'>) => void;
  toggleMessageLike: (conversationId: string, messageId: string) => void;
  ensureConversation: (withId: string) => string;
  markConversationRead: (id: string) => void;
  markNotificationsRead: () => void;

  submitReview: (eventId: string, r: Review) => void;
  setSelectedPayment: (id: string) => void;
  addPaymentMethod: (m: Omit<PaymentMethod, 'id'>) => void;
  resetDemo: () => void;

  /** Blocking also ends a friendship and declines pending friend requests with that account. */
  toggleBlock: (profileId: string) => void;
  /** Records a door check-in; a matching ticket of the user becomes 'used'. Returns false if the code was already in. */
  checkIn: (eventId: string, code: string) => boolean;
  refundTicket: (ticketId: string) => void;
  /** Adds one evidence item (file name or statement) to a disputed booking. */
  addBookingEvidence: (bookingId: string, item: string) => void;
  setAvailability: (a: Partial<Availability>) => void;
  promoteEvent: (p: Omit<Promotion, 'id' | 'createdAt'>) => string;
  setPlan: (plan: State['plan']) => void;
  updateVenueListing: (v: Partial<VenueListing>) => void;
  requestPayout: () => number;

  /** False when blocked, already friends or a request is already pending. An incoming request from them is accepted instead. */
  sendFriendRequest: (toId: string) => boolean;
  respondFriendRequest: (id: string, accept: boolean) => void;
  cancelFriendRequest: (id: string) => void;
  removeFriend: (profileId: string) => void;
  toggleCommunity: (id: string) => void;

  /** Opens a support case and returns its id (the reference is case.ref). */
  openCase: (topic: string, text: string, linked?: SupportCase['linked']) => string;
  /** Your reply on a case (it goes back to support: status 'open'). */
  replyCase: (id: string, text: string) => void;
  /** Support's reply (admin console / demo). resolve = true closes it. */
  answerCase: (id: string, text: string, resolve?: boolean) => void;
  /** Returns false while a linked booking still has a refund or release pending (a closure cannot hide it). */
  closeCase: (id: string) => boolean;
  /** Files a report (one open report per target). Returns the report id. */
  reportContent: (kind: ReportKind, targetId: string, reason: string, details?: string) => string;
  moderateReport: (id: string, status: Exclude<ReportStatus, 'open'>, note?: string) => void;
  setAdminMode: (on: boolean) => void;
}

const defaultUser: User = {
  name: 'Sara M.',
  handle: '@saranights',
  email: 'sara@domtak.de',
  phone: '+49 151 2345 4821',
  bio: 'Techno lover, Kreuzberg regular.',
  city: 'Berlin, Germany',
  avatar: 'av_leyla',
  role: 'fan',
  genres: ['Techno', 'House'],
  pro: 'none',
  approvedRoles: ['fan'],
};

const initialData = () => ({
  onboarded: false,
  authed: false,
  user: defaultUser,
  prefs: { bookings: true, messages: true, nearby: false, privateAccount: false, language: 'English', rememberMe: true, twoFactor: false } as Prefs,
  likes: {},
  saves: {},
  following: { adam: true, nightowls: true, soso: true, sara: true } as Record<string, boolean>,
  going: {},
  wishlist: { events: ['danceworld', 'summerfest', 'youngtalent'], artists: ['adam', 'soso'], venues: ['moonclub'] },
  myPosts: [],
  extraComments: {},
  likedComments: {} as Record<string, boolean>,
  myEvents: [],
  eventEdits: {} as Record<string, Partial<EventItem>>,
  tickets: [
    { id: 't_seed1', eventId: 'danceworld', typeId: 'ga', holder: 'Sara M.', code: 'DW7K2QXA', status: 'valid' as const, purchasedAt: '2026-10-10' },
    { id: 't_seed2', eventId: 'listening', typeId: 'ga', holder: 'Sara M.', code: 'LS3M8PZB', status: 'cancelled' as const, purchasedAt: '2026-10-02' },
  ] as Ticket[],
  bookings: initialBookings,
  requests: incomingRequests,
  conversations: seedConversations,
  reviews: {},
  readNotifications: false,
  paymentMethods: [
    { id: 'visa', label: 'Visa •••• 2154', sub: 'Expires 08/28', badge: 'VISA' },
    { id: 'gpay', label: 'Google Pay', sub: 'sara@domtak.de', badge: 'GPay' },
    { id: 'paypal', label: 'PayPal', sub: 'Linked account', badge: 'PP' },
    { id: 'sepa', label: 'SEPA direct debit', sub: 'DE•• •••• 0391', badge: 'SEPA' },
  ],
  selectedPayment: 'visa',
  checkout: undefined,
  blocked: [] as string[],
  checkIns: {} as Record<string, string[]>,
  checkInLog: {} as Record<string, Record<string, string>>,
  availability: {
    days: { Mon: false, Tue: false, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false },
    blockedDates: ['2026-10-31', '2026-11-14'],
    feePerHour: 300,
    minHours: 2,
    radiusKm: 50,
    instantBook: false,
  } as Availability,
  promotions: [] as Promotion[],
  plan: 'free' as 'free' | 'monthly' | 'yearly',
  venueListing: {
    name: 'Moon Club',
    area: 'Kreuzberg',
    type: 'Club',
    capacity: 350,
    rooms: 3,
    stages: 2,
    pricePerNight: 800,
    parking: true,
    equipment: 'Full equipment',
    occasions: ['Club night', 'Concert / Musical', 'Birthday', 'Corporate event'],
    description: 'Two dark rooms, a Funktion-One main floor and a beach garden for chill-out sets.',
    photos: ['ven_neon', 'ev_club_dark', 'ev_lasers2', 'feed_club'],
    // Same details as the public Moon Club page (data/mock), so the owner edits what guests see.
    parkingDetails: { available: true, spaces: 12, kind: 'on-site', notes: 'Courtyard spaces, reserve with your booking' },
    garden: { available: true, capacity: 120, covered: false, notes: 'Beach garden by the Spree, music outside until 22:00' },
    facilities: ['Funktion-One sound', 'Two dance floors', 'Green room', 'Cloakroom', 'Two bars', 'Step-free entrance'],
    requirements: ['Guests 18+', 'Damage deposit €500', 'Security required from 150 guests'],
    pricing: 'listed',
    catering: { available: true, pricePerGuest: 22, minGuests: 50, notes: 'Finger food and a drinks package' },
    security: { available: true, guestsPerGuard: 75, pricePerGuard: 190, requiredFrom: 150, notes: 'Licensed door staff' },
    extraCharges: [{ label: 'Sound engineer', amount: 180 }, { label: 'Cleaning', amount: 150 }],
  } as VenueListing,
  payouts: [
    { id: 'po3', amount: 1080, date: '2026-10-01', status: 'paid' },
    { id: 'po2', amount: 2160, date: '2026-09-15', status: 'paid' },
    { id: 'po1', amount: 900, date: '2026-09-01', status: 'paid' },
  ] as Payout[],
  balance: 2040,

  friends: initialFriends,
  friendRequests: initialFriendRequests,
  joinedCommunities: ['techno-berlin'],
  guestInvites: initialGuestInvites,
  supportCases: initialSupportCases,
  reports: initialReports,
  removedContent: [] as string[],
  applicationQueue: seedApplicationQueue,
  auditLog: [] as AuditEntry[],
  adminMode: false,
});

const toggleIn = (rec: Record<string, boolean>, id: string) => {
  const next = { ...rec };
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
};

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Demo date with the wall-clock time of day (door check-ins show a real time). Only called in actions. */
const demoClock = () => {
  const real = new Date();
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), real.getHours(), real.getMinutes(), real.getSeconds());
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const unique = <T,>(list: T[]) => [...new Set(list)];

const log = (b: Booking, label: string) => [...(b.timeline ?? []), { at: nowIso(), label }];

const payRef = (prefix: string) => `${prefix}-${ticketCode().slice(0, 4)}`;

/** Timeline wording when a booking changes status. */
function statusNote(b: Booking, status: BookingStatus) {
  const name = providerOf(b).name;
  switch (status) {
    case 'pending':
      return 'Request sent · payment pending the provider’s decision';
    case 'accepted':
      return `${name} accepted · finalizing payment`;
    case 'paid':
    case 'confirmed':
      return 'Payment verified · booking confirmed';
    case 'declined':
      return `${name} declined · payment authorization released`;
    case 'expired':
      return `No response within ${RESPONSE_HOURS} h · request expired, release started`;
    case 'cancelled':
      return 'Booking cancelled';
    case 'completed':
      return 'Event done · booking completed';
    case 'disputed':
      return 'Problem reported · case opened with support';
    case 'payment_failed':
      return 'Payment failed · no charge recorded';
    case 'change_requested':
      return 'Change requested';
    default:
      return 'Request sent';
  }
}

/** The booking after a status change, with its payment state and deadline kept consistent. */
function withStatus(b: Booking, status: BookingStatus): Booking {
  const reopened = status === 'pending' && b.status !== 'pending';
  return {
    ...b,
    status,
    payment: paymentAfter(status, b.payment),
    ...(reopened ? { deadline: addHours(TODAY, RESPONSE_HOURS), reminderAt: addHours(TODAY, REMINDER_HOURS) } : null),
    timeline: log(b, statusNote(b, status)),
  };
}

const withEdits = (e: EventItem, edits: Record<string, Partial<EventItem>>) => (edits[e.id] ? { ...e, ...edits[e.id] } : e);

/** An event as the store sees it: your own, or a sample (public or private) with saved edits. */
function findEvent(s: Pick<State, 'myEvents' | 'eventEdits'>, id: string): EventItem | undefined {
  const own = s.myEvents.find((e) => e.id === id);
  if (own) return own;
  const seed = seedEvents.find((e) => e.id === id) ?? seedPrivateEvents.find((e) => e.id === id);
  return seed ? withEdits(seed, s.eventEdits) : undefined;
}

/** Applies a patch to your own event, or stores it as an edit of a sample event. */
function patchEvent(s: Pick<State, 'myEvents' | 'eventEdits'>, id: string, patch: Partial<EventItem>): Pick<State, 'myEvents'> | Pick<State, 'eventEdits'> {
  return s.myEvents.some((e) => e.id === id)
    ? { myEvents: s.myEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
    : { eventEdits: { ...s.eventEdits, [id]: { ...s.eventEdits[id], ...patch } } };
}

const audit = (actor: string, action: string, target: string, note?: string): AuditEntry => ({ id: uid('au'), at: nowIso(), actor, action, target, note });

/** Keeps the parking flag and parkingDetails.available in step. */
function syncParking<T extends { parking: boolean; parkingDetails?: VenueParking }>(v: T, patch: Partial<T>): T {
  const next = { ...v, ...patch };
  if (patch.parkingDetails && patch.parking === undefined) next.parking = patch.parkingDetails.available;
  if (next.parkingDetails) next.parkingDetails = { ...next.parkingDetails, available: next.parking };
  return next;
}

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initialData(),

      completeOnboarding: () => set({ onboarded: true }),
      signIn: (email, remember) =>
        set((s) => ({
          authed: true,
          onboarded: true,
          user: { ...s.user, email: email || s.user.email },
          prefs: remember === undefined ? s.prefs : { ...s.prefs, rememberMe: remember },
        })),
      register: (u) => set((s) => ({ onboarded: true, user: { ...s.user, ...u, role: 'fan', approvedRoles: ['fan'], application: undefined, pro: 'none' } })),
      signOut: () => set({ authed: false }),
      updateUser: (u) => set((s) => ({ user: { ...s.user, ...u } })),
      setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),

      submitApplication: (role, details) =>
        set((s) => {
          const at = nowIso();
          const prev = s.user.application?.role === role ? (s.user.application.history ?? []) : [];
          const application: Application = { role, status: 'pending', submittedAt: at, details, history: [...prev, { at, status: 'pending', note: prev.length ? 'Resubmitted' : undefined }] };
          const otherPro = s.user.approvedRoles.some((r) => r !== 'fan');
          return { user: { ...s.user, application, pro: otherPro ? s.user.pro : 'review' } };
        }),
      decideApplication: (status, opts) =>
        set((s) => {
          const app = s.user.application;
          if (!app) return {};
          const at = nowIso();
          const note = status === 'info' ? (opts?.missing?.length ? `Missing: ${opts.missing.join(', ')}` : opts?.reason) : opts?.reason;
          const application: Application = {
            ...app,
            status,
            decidedAt: at,
            reason: opts?.reason,
            missing: status === 'info' ? opts?.missing : undefined,
            history: [...(app.history ?? []), { at, status, note }],
          };
          const approvedRoles = status === 'approved' ? unique<Role>([...s.user.approvedRoles, 'fan', app.role]) : s.user.approvedRoles;
          const hasPro = approvedRoles.some((r) => r !== 'fan');
          const pro: User['pro'] = hasPro ? 'verified' : status === 'info' ? 'review' : 'none';
          return {
            user: { ...s.user, application, approvedRoles, pro },
            auditLog: [audit('You (reviewer)', `Application ${status}`, `${s.user.name} · ${ROLE_LABEL[app.role]}`, note), ...s.auditLog],
          };
        }),
      reviewApplication: (id, status, opts) =>
        set((s) => {
          const at = nowIso();
          const note = status === 'info' ? (opts?.missing?.length ? `Missing: ${opts.missing.join(', ')}` : opts?.reason) : opts?.reason;
          const target = s.applicationQueue.find((a) => a.id === id);
          if (!target) return {};
          return {
            applicationQueue: s.applicationQueue.map((a) =>
              a.id === id
                ? { ...a, status, decidedAt: at, reason: opts?.reason, missing: status === 'info' ? opts?.missing : undefined, reviewer: 'You', history: [...(a.history ?? []), { at, status, note }] }
                : a,
            ),
            auditLog: [audit('You (reviewer)', `Application ${status}`, `${target.applicantName} · ${ROLE_LABEL[target.role]}`, note), ...s.auditLog],
          };
        }),
      switchWorkspace: (role) => {
        if (!isApproved(get().user, role)) return false;
        set((s) => ({ user: { ...s.user, role } }));
        return true;
      },

      toggleLike: (id) => set((s) => ({ likes: toggleIn(s.likes, id) })),
      toggleSave: (id) => set((s) => ({ saves: toggleIn(s.saves, id) })),
      toggleFollow: (id) => set((s) => ({ following: toggleIn(s.following, id) })),
      toggleGoing: (id) => set((s) => ({ going: toggleIn(s.going, id) })),
      toggleWish: (kind, id) =>
        set((s) => {
          const list = s.wishlist[kind];
          return { wishlist: { ...s.wishlist, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [id, ...list] } };
        }),

      addPost: (p, visibility) => {
        const id = uid('post');
        const vis: PostVisibility = visibility ?? p.visibility ?? 'Public';
        const feed: Post['feed'] = vis === 'Followers' ? ['following'] : ['forYou', 'following', 'nearby'];
        const post: Post = { ...p, id, authorId: 'me', likes: 0, comments: [], shares: 0, time: 'now', feed, visibility: vis };
        set((s) => ({ myPosts: [post, ...s.myPosts] }));
        return id;
      },
      toggleCommentLike: (id) => set((s) => ({ likedComments: { ...s.likedComments, [id]: !s.likedComments[id] } })),
      addComment: (postId, text, photos) =>
        set((s) => ({
          extraComments: {
            ...s.extraComments,
            [postId]: [...(s.extraComments[postId] ?? []), { id: uid('c'), authorId: 'me', text, time: 'now', likes: 0, ...(photos?.length ? { photos } : null) }],
          },
        })),
      addEvent: (e) => {
        const id = uid('ev');
        const user = get().user;
        const state: EventState = e.state ?? (e.isPrivate || canPublishPublicEvents(user) ? 'published' : 'draft');
        const ev: EventItem = { ...e, id, organizerId: 'me', hostId: 'me', state, bookingIds: e.bookingIds ?? [], going: 0, rating: 0, distanceKm: 0.5 };
        set((s) => ({ myEvents: [ev, ...s.myEvents] }));
        return id;
      },
      updateEvent: (id, patch) => set((s) => patchEvent(s, id, patch)),
      saveEventDraft: (e) => get().addEvent({ ...e, state: 'draft' }),
      setEventState: (id, state) => {
        const s = get();
        const ev = findEvent(s, id);
        if (!ev) return false;
        if (state === 'published' && !ev.isPrivate && !canPublishPublicEvents(s.user)) return false;
        set((st) => patchEvent(st, id, { state }));
        return true;
      },
      linkBooking: (eventId, bookingId) =>
        set((s) => {
          const ev = findEvent(s, eventId);
          if (!ev) return {};
          const ids = ev.bookingIds ?? [];
          return {
            ...patchEvent(s, eventId, { bookingIds: ids.includes(bookingId) ? ids : [...ids, bookingId] }),
            bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, eventId } : b)),
          };
        }),
      inviteGuests: (eventId, profileIds) =>
        set((s) => {
          const ev = findEvent(s, eventId);
          if (!ev) return {};
          const current = ev.invitations ?? [];
          const added = unique(profileIds)
            .filter((pid) => !s.blocked.includes(pid) && !current.some((i) => i.profileId === pid))
            .map((profileId): Invitation => ({ profileId, status: 'invited' }));
          return patchEvent(s, eventId, { invitations: [...current, ...added] });
        }),
      setInvitationStatus: (eventId, profileId, status, paid) =>
        set((s) => {
          const ev = findEvent(s, eventId);
          if (!ev) return {};
          return patchEvent(s, eventId, {
            invitations: (ev.invitations ?? []).map((i) => (i.profileId === profileId ? { ...i, status, paid: status === 'accepted' ? (paid ?? i.paid) : false } : i)),
          });
        }),
      setCostSharing: (eventId, cs) => set((s) => patchEvent(s, eventId, { costSharing: cs })),
      cancelEvent: (id, reason) =>
        set((s) => {
          const ev = findEvent(s, id);
          if (!ev) return {};
          const at = nowIso();
          const linked = new Set(ev.bookingIds ?? []);
          return {
            ...patchEvent(s, id, { state: 'cancelled', cancelReason: reason, cancelledAt: at }),
            bookings: s.bookings.map((b) =>
              (b.eventId === id || linked.has(b.id)) && !isClosed(b.status) && b.status !== 'completed'
                ? { ...b, pendingCancellation: { reason, at, source: 'event' as const }, timeline: log(b, `Event cancelled (${reason}) · booking enters the cancellation process`) }
                : b,
            ),
          };
        }),
      respondInvite: (id, status) =>
        set((s) => {
          const inv = s.guestInvites.find((g) => g.id === id);
          if (!inv) return {};
          if (status === 'declined') {
            return { guestInvites: s.guestInvites.map((g) => (g.id === id ? { ...g, status } : g)), going: { ...s.going, [inv.eventId]: false } };
          }
          const free = !inv.contribution;
          if (!free || inv.ticketId) {
            return { guestInvites: s.guestInvites.map((g) => (g.id === id ? { ...g, status, payment: g.payment ?? (free ? undefined : 'not_started') } : g)) };
          }
          const ticket: Ticket = { id: uid('t'), eventId: inv.eventId, typeId: 'guest', holder: s.user.name, code: ticketCode(), status: 'valid', purchasedAt: nowIso(), inviteId: id, paid: 0 };
          return {
            guestInvites: s.guestInvites.map((g) => (g.id === id ? { ...g, status, ticketId: ticket.id } : g)),
            tickets: [ticket, ...s.tickets],
            going: { ...s.going, [inv.eventId]: true },
          };
        }),
      payContribution: (id, opts) => {
        const inv = get().guestInvites.find((g) => g.id === id);
        if (!inv) return { ok: false };
        // A second tap or a repeated notification never charges twice: the existing ticket is returned.
        if (inv.ticketId && inv.payment === 'paid') return { ok: true, ticketId: inv.ticketId };
        if (opts?.fail) {
          set((s) => ({ guestInvites: s.guestInvites.map((g) => (g.id === id ? { ...g, status: 'accepted', payment: 'failed' } : g)) }));
          return { ok: false };
        }
        const ticket: Ticket = { id: uid('t'), eventId: inv.eventId, typeId: 'guest', holder: get().user.name, code: ticketCode(), status: 'valid', purchasedAt: nowIso(), inviteId: id, paid: inv.contribution ?? 0 };
        set((s) => ({
          guestInvites: s.guestInvites.map((g) => (g.id === id ? { ...g, status: 'accepted', payment: 'paid', ticketId: ticket.id } : g)),
          tickets: [ticket, ...s.tickets],
          going: { ...s.going, [inv.eventId]: true },
        }));
        return { ok: true, ticketId: ticket.id };
      },

      startTicketCheckout: (eventId, typeId, qty) => set({ checkout: { kind: 'ticket', eventId, typeId, qty } }),
      startBookingCheckout: (bookingId) => set({ checkout: { kind: 'booking', bookingId } }),
      completeCheckout: () => {
        const c = get().checkout;
        if (!c) return undefined;
        if (c.kind === 'ticket') {
          const ids: string[] = [];
          const tickets: Ticket[] = Array.from({ length: c.qty }, () => {
            const id = uid('t');
            ids.push(id);
            return { id, eventId: c.eventId, typeId: c.typeId, holder: get().user.name, code: ticketCode(), status: 'valid', purchasedAt: TODAY.toISOString() };
          });
          set((s) => ({ tickets: [...tickets, ...s.tickets], going: { ...s.going, [c.eventId]: true }, checkout: undefined }));
          return { kind: 'ticket', ids };
        }
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === c.bookingId
              ? { ...b, status: 'confirmed' as const, payment: 'paid' as const, paymentAttempts: (b.paymentAttempts ?? 0) + 1, paymentRef: b.paymentRef ?? payRef('PAY'), timeline: log(b, 'Payment verified · booking confirmed') }
              : b,
          ),
          checkout: undefined,
        }));
        return { kind: 'booking', id: c.bookingId };
      },

      createBooking: (b) => {
        const id = uid('b');
        const booking: Booking = {
          pricing: 'listed',
          payment: 'authorized',
          charges: { base: b.amount },
          ...b,
          id,
          status: 'pending',
          createdAt: isoDay(TODAY),
          deadline: addHours(TODAY, RESPONSE_HOURS),
          reminderAt: addHours(TODAY, REMINDER_HOURS),
          timeline: [{ at: nowIso(), label: 'Request sent · payment pending the provider’s decision' }],
        };
        set((s) => ({ bookings: [booking, ...s.bookings] }));
        if (b.eventId) get().linkBooking(b.eventId, id);
        return id;
      },
      setBookingStatus: (id, status) => set((s) => ({ bookings: s.bookings.map((b) => (b.id === id && b.status !== status ? withStatus(b, status) : b)) })),
      requestQuote: (input) => {
        const id = uid('b');
        const booking: Booking = {
          ...input,
          id,
          amount: input.amount ?? 0,
          status: 'requested',
          createdAt: isoDay(TODAY),
          pricing: 'quote',
          payment: 'not_started',
          quote: { version: 0, status: 'requested', items: [], total: 0 },
          deadline: addHours(TODAY, RESPONSE_HOURS),
          reminderAt: addHours(TODAY, REMINDER_HOURS),
          timeline: [{ at: nowIso(), label: 'Quote requested · nothing is charged' }],
        };
        set((s) => ({ bookings: [booking, ...s.bookings] }));
        if (input.eventId) get().linkBooking(input.eventId, id);
        return id;
      },
      sendQuote: (bookingId, items, validUntil, note) =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== bookingId || (b.status !== 'requested' && b.status !== 'accepted')) return b;
            const version = (b.quote?.version ?? 0) + 1;
            const total = quoteTotal(items);
            return {
              ...b,
              pricing: 'quote' as const,
              status: 'requested' as const,
              payment: 'not_started' as const,
              amount: total,
              quote: { version, status: version > 1 ? ('revised' as const) : ('sent' as const), items, total, validUntil, note },
              timeline: log(b, `${providerOf(b).name} sent ${version > 1 ? 'a revised quote' : 'a quote'} (v${version}) · ${euro(total)}`),
            };
          }),
        })),
      acceptQuote: (bookingId) => {
        const b = get().bookings.find((x) => x.id === bookingId);
        if (!b?.quote) return false;
        const q = quoteState(b.quote);
        if (q !== 'sent' && q !== 'revised') return false;
        set((s) => ({
          bookings: s.bookings.map((x) =>
            x.id === bookingId && x.quote
              ? { ...x, status: 'accepted' as const, payment: 'not_started' as const, amount: x.quote.total, quote: { ...x.quote, status: 'accepted' as const }, timeline: log(x, `Quote v${x.quote.version} accepted · continue to payment`) }
              : x,
          ),
        }));
        return true;
      },
      rejectQuote: (bookingId) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId && b.quote
              ? { ...b, status: 'cancelled' as const, cancelReason: 'Quote declined', quote: { ...b.quote, status: 'rejected' as const }, timeline: log(b, 'Quote declined · offer closed, nothing charged') }
              : b,
          ),
        })),
      setPayment: (bookingId, payment) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? { ...b, payment, paymentRef: b.paymentRef ?? (payment === 'released' ? payRef('REL') : payment === 'refunded' ? payRef('REF') : undefined), timeline: log(b, `Payment: ${PAYMENT_PROVIDER_LABEL[payment]}`) }
              : b,
          ),
        })),
      failPayment: (bookingId) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: b.status === 'accepted' || b.status === 'payment_failed' ? ('payment_failed' as const) : b.status,
                  payment: 'failed' as const,
                  paymentAttempts: (b.paymentAttempts ?? 0) + 1,
                  timeline: log(b, 'Payment failed · no charge recorded'),
                }
              : b,
          ),
        })),
      retryPayment: (bookingId) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId && b.payment === 'failed'
              ? { ...b, status: b.status === 'payment_failed' ? ('accepted' as const) : b.status, payment: 'capture_pending' as const, timeline: log(b, 'Payment retried on the same booking') }
              : b,
          ),
        })),
      verifyPayment: (bookingId) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? { ...b, status: 'confirmed' as const, payment: 'paid' as const, paymentAttempts: (b.paymentAttempts ?? 0) + 1, paymentRef: b.paymentRef ?? payRef('PAY'), timeline: log(b, 'Payment verified · booking confirmed') }
              : b,
          ),
        })),
      requestChange: (bookingId, note) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId && b.status !== 'change_requested'
              ? { ...b, status: 'change_requested' as const, change: { note, requestedAt: nowIso(), previous: b.status }, timeline: log(b, `Change requested: ${note}`) }
              : b,
          ),
        })),
      resolveChange: (bookingId, accept) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId && b.change
              ? { ...b, status: b.change.previous, change: undefined, timeline: log(b, accept ? 'Change agreed by both sides' : 'Change declined · the agreed terms stay') }
              : b,
          ),
        })),
      cancelBooking: (bookingId, reason) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? { ...b, status: 'cancelled' as const, payment: paymentAfter('cancelled', b.payment), cancelReason: reason, pendingCancellation: undefined, change: undefined, timeline: log(b, `Cancelled: ${reason}`) }
              : b,
          ),
        })),
      expireOverdue: (now = TODAY) => {
        const s = get();
        const due = s.bookings.filter((b) => isOverdue(b, now)).map((b) => b.id);
        const dueRequests = s.requests.filter((r) => isOverdue(r, now)).map((r) => r.id);
        if (!due.length && !dueRequests.length) return 0;
        set((st) => ({
          bookings: st.bookings.map((b) => (due.includes(b.id) ? withStatus(b, 'expired') : b)),
          requests: st.requests.map((r) => (dueRequests.includes(r.id) ? { ...r, status: 'expired' as const, payment: r.payment === 'authorized' ? ('release_pending' as const) : r.payment } : r)),
        }));
        return due.length + dueRequests.length;
      },

      setRequestStatus: (id, status) =>
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== id) return r;
            let payment = r.payment;
            if (status === 'accepted' && payment === 'authorized') payment = 'capture_pending';
            if ((status === 'declined' || status === 'expired') && (payment === 'authorized' || payment === 'capture_pending')) payment = 'release_pending';
            return { ...r, status, payment };
          }),
        })),
      counterRequest: (id, amount, note) =>
        set((s) => ({
          requests: s.requests.map((r) => (r.id === id ? { ...r, counterOffer: amount, counterNote: note?.trim() || undefined } : r)),
        })),
      quoteRequest: (id, items, validUntil, note) =>
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== id) return r;
            const version = (r.quote?.version ?? 0) + 1;
            const total = quoteTotal(items);
            return { ...r, pricing: 'quote' as const, offer: total, quote: { version, status: version > 1 ? ('revised' as const) : ('sent' as const), items, total, validUntil, note } };
          }),
        })),
      setRequestPayment: (id, payment) => set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, payment } : r)) })),

      sendMessage: (cid, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === cid ? { ...c, messages: [...c.messages, { ...msg, id: uid('m'), from: 'me', time: nowTime() }] } : c,
          ),
        })),
      toggleMessageLike: (cid, mid) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === cid ? { ...c, messages: c.messages.map((m) => (m.id === mid ? { ...m, liked: !m.liked } : m)) } : c,
          ),
        })),
      ensureConversation: (withId) => {
        const existing = get().conversations.find((c) => c.withId === withId);
        if (existing) return existing.id;
        set((s) => ({ conversations: [{ id: withId, withId, messages: [], unread: 0 }, ...s.conversations] }));
        return withId;
      },
      markConversationRead: (id) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) })),
      markNotificationsRead: () => set({ readNotifications: true }),

      submitReview: (eventId, r) => set((s) => ({ reviews: { ...s.reviews, [eventId]: r } })),
      setSelectedPayment: (id) => set({ selectedPayment: id }),
      addPaymentMethod: (m) => {
        const id = uid('pm');
        set((s) => ({ paymentMethods: [...s.paymentMethods, { ...m, id }], selectedPayment: id }));
      },
      resetDemo: () => set({ ...initialData() }),

      toggleBlock: (id) =>
        set((s) => {
          if (s.blocked.includes(id)) return { blocked: s.blocked.filter((x) => x !== id) };
          return {
            blocked: [...s.blocked, id],
            friends: s.friends.filter((f) => f !== id),
            friendRequests: s.friendRequests.map((r) => (r.status === 'pending' && (r.fromId === id || r.toId === id) ? { ...r, status: 'declined' as const } : r)),
          };
        }),
      checkIn: (eventId, code) => {
        if (get().checkIns[eventId]?.includes(code)) return false;
        const at = demoClock();
        set((s) => ({
          checkIns: { ...s.checkIns, [eventId]: [...(s.checkIns[eventId] ?? []), code] },
          checkInLog: { ...s.checkInLog, [eventId]: { ...s.checkInLog[eventId], [code]: at } },
          tickets: s.tickets.map((t) => (t.eventId === eventId && t.code === code && t.status === 'valid' ? { ...t, status: 'used' as const, checkedInAt: at } : t)),
        }));
        return true;
      },
      refundTicket: (ticketId) => set((s) => ({ tickets: s.tickets.map((t) => (t.id === ticketId && t.status !== 'used' ? { ...t, status: 'refunded' as const } : t)) })),
      addBookingEvidence: (bookingId, item) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, evidence: [...(b.evidence ?? []), item] } : b)) })),
      setAvailability: (a) => set((s) => ({ availability: { ...s.availability, ...a } })),
      promoteEvent: (p) => {
        const id = uid('promo');
        // Stamped on the demo clock so boosts line up with TODAY everywhere (see lib/promotions).
        set((s) => ({ promotions: [{ ...p, id, createdAt: TODAY.toISOString() }, ...s.promotions] }));
        return id;
      },
      setPlan: (plan) => set({ plan }),
      updateVenueListing: (v) => set((s) => ({ venueListing: syncParking(s.venueListing, v) })),
      requestPayout: () => {
        const amount = get().balance;
        if (amount <= 0) return 0;
        set((s) => ({ balance: 0, payouts: [{ id: uid('po'), amount, date: isoDay(TODAY), status: 'processing' }, ...s.payouts] }));
        return amount;
      },

      sendFriendRequest: (toId) => {
        const s = get();
        if (toId === 'me' || s.blocked.includes(toId) || s.friends.includes(toId)) return false;
        const incoming = s.friendRequests.find((r) => r.status === 'pending' && r.fromId === toId);
        if (incoming) {
          s.respondFriendRequest(incoming.id, true);
          return true;
        }
        if (s.friendRequests.some((r) => r.status === 'pending' && r.fromId === 'me' && r.toId === toId)) return false;
        set((st) => ({ friendRequests: [{ id: uid('fr'), fromId: 'me', toId, status: 'pending', at: nowIso() }, ...st.friendRequests] }));
        return true;
      },
      respondFriendRequest: (id, accept) =>
        set((s) => {
          const req = s.friendRequests.find((r) => r.id === id);
          if (!req || req.status !== 'pending') return {};
          const other = req.fromId === 'me' ? req.toId : req.fromId;
          return {
            friendRequests: s.friendRequests.map((r) => (r.id === id ? { ...r, status: accept ? ('accepted' as const) : ('declined' as const) } : r)),
            friends: accept && !s.friends.includes(other) ? [...s.friends, other] : s.friends,
          };
        }),
      cancelFriendRequest: (id) => set((s) => ({ friendRequests: s.friendRequests.filter((r) => !(r.id === id && r.fromId === 'me')) })),
      removeFriend: (profileId) => set((s) => ({ friends: s.friends.filter((f) => f !== profileId) })),
      toggleCommunity: (id) => set((s) => ({ joinedCommunities: s.joinedCommunities.includes(id) ? s.joinedCommunities.filter((c) => c !== id) : [...s.joinedCommunities, id] })),

      openCase: (topic, text, linked) => {
        const id = uid('sc');
        const at = nowIso();
        const ref = `DT-${Math.floor(1000 + Math.random() * 9000)}`;
        set((s) => ({ supportCases: [{ id, ref, topic, linked, status: 'open', createdAt: at, messages: [{ from: 'me', text, at }] }, ...s.supportCases] }));
        return id;
      },
      replyCase: (id, text) =>
        set((s) => ({ supportCases: s.supportCases.map((c) => (c.id === id ? { ...c, status: 'open' as const, messages: [...c.messages, { from: 'me' as const, text, at: nowIso() }] } : c)) })),
      answerCase: (id, text, resolve) =>
        set((s) => ({
          supportCases: s.supportCases.map((c) => (c.id === id ? { ...c, status: resolve ? ('resolved' as const) : ('waiting' as const), messages: [...c.messages, { from: 'support' as const, text, at: nowIso() }] } : c)),
          auditLog: [audit('You (support)', resolve ? 'Case resolved' : 'Case answered', s.supportCases.find((c) => c.id === id)?.ref ?? id), ...s.auditLog],
        })),
      closeCase: (id) => {
        const s = get();
        const c = s.supportCases.find((x) => x.id === id);
        if (!c) return false;
        if (c.linked?.kind === 'booking') {
          const b = s.bookings.find((x) => x.id === c.linked?.id);
          if (b && (b.payment === 'refund_pending' || b.payment === 'release_pending')) return false;
        }
        set((st) => ({ supportCases: st.supportCases.map((x) => (x.id === id ? { ...x, status: 'resolved' as const } : x)) }));
        return true;
      },
      reportContent: (kind, targetId, reason, details) => {
        const existing = get().reports.find((r) => r.byMe && r.targetId === targetId && r.status === 'open');
        if (existing) return existing.id;
        const id = uid('rp');
        set((s) => ({ reports: [{ id, kind, targetId, reason, details, at: nowIso(), status: 'open', byMe: true }, ...s.reports] }));
        return id;
      },
      moderateReport: (id, status, note) =>
        set((s) => {
          const r = s.reports.find((x) => x.id === id);
          if (!r) return {};
          return {
            reports: s.reports.map((x) => (x.id === id ? { ...x, status, decision: { note, at: nowIso() } } : x)),
            removedContent: status === 'removed' && !s.removedContent.includes(r.targetId) ? [...s.removedContent, r.targetId] : s.removedContent,
            auditLog: [audit('You (moderator)', `Report ${status}`, `${r.kind} ${r.targetId}`, note), ...s.auditLog],
          };
        }),
      setAdminMode: (on) => set({ adminMode: on }),
    }),
    {
      name: 'domtak-app',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { checkout: _checkout, ...rest } = s;
        // Without "Remember me" the session is not kept: the next launch starts signed out.
        return s.prefs.rememberMe === false ? { ...rest, authed: false } : rest;
      },
      // Older saved state may miss newer nested keys (e.g. prefs.rememberMe): fill them from the defaults.
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<State>;
        const savedUser = p.user as Partial<User> | undefined;
        const savedRoles = savedUser?.approvedRoles;
        // Installs from before professional approval keep the workspace they were using.
        const approvedRoles: Role[] = Array.isArray(savedRoles) ? unique<Role>(['fan', ...savedRoles]) : unique<Role>(['fan', savedUser?.role ?? current.user.role]);
        // Saved sample bookings and requests gain the fields added since (deadlines, payment state…).
        const fillBookings = p.bookings?.map((b) => {
          const seed = initialBookings.find((x) => x.id === b.id);
          return seed ? { ...seed, ...b } : b;
        });
        const fillRequests = p.requests?.map((r) => {
          const seed = incomingRequests.find((x) => x.id === r.id);
          return seed ? { ...seed, ...r } : r;
        });
        return {
          ...current,
          ...p,
          user: { ...current.user, ...p.user, approvedRoles },
          prefs: { ...current.prefs, ...p.prefs },
          wishlist: { ...current.wishlist, ...p.wishlist },
          availability: { ...current.availability, ...p.availability, days: { ...current.availability.days, ...p.availability?.days } },
          venueListing: { ...current.venueListing, ...p.venueListing },
          bookings: fillBookings ?? current.bookings,
          requests: fillRequests ?? current.requests,
        };
      },
    },
  ),
);

// ---------- Roles and permissions (section 02) ----------

export const ROLE_LABEL: Record<Role, string> = {
  fan: 'Fan',
  musician: 'Musician / DJ',
  venue: 'Venue owner',
  organizer: 'Organizer',
};

export const isPro = (role: Role) => role !== 'fan';

export const PROFESSIONAL_ROLES: ProfessionalRole[] = ['musician', 'venue', 'organizer'];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'In review',
  info: 'More information needed',
  approved: 'Approved',
  rejected: 'Not approved',
};

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  info: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const userOf = (x: User | { user: User }): User => ('user' in x ? x.user : x);

/** True when the account may use `role` ('fan' always). Accepts the user or the store state. */
export function isApproved(x: User | { user: User }, role: Role) {
  if (role === 'fan') return true;
  return (userOf(x).approvedRoles ?? ['fan']).includes(role);
}

/** Only an approved organizer, working in the organizer workspace, can publish public events. */
export function canPublishPublicEvents(user: User) {
  return user.role === 'organizer' && isApproved(user, 'organizer');
}

/** Feed posts and stories are for approved professionals in their professional workspace. Members share photos in comments only. */
export function canPostToFeed(user: User) {
  return isPro(user.role) && isApproved(user, user.role);
}

/** Provider bookings can be accepted only in an approved musician or venue workspace. */
export function canAcceptBookings(user: User) {
  return (user.role === 'musician' || user.role === 'venue') && isApproved(user, user.role);
}

/** The active workspace when it is approved, else 'fan' (an unapproved role never opens professional tools). */
export function activeWorkspace(user: User): Role {
  return isApproved(user, user.role) ? user.role : 'fan';
}

// ---------- Hooks ----------

/** All events: sample data (with the organizer's saved edits) plus events the user created. Private invitations are not included (see useInvitedEvents). */
export function useAllEvents() {
  const mine = useApp((s) => s.myEvents);
  const edits = useApp((s) => s.eventEdits);
  return useMemo(() => {
    const seed = Object.keys(edits).length ? seedEvents.map((e) => withEdits(e, edits)) : seedEvents;
    return mine.length ? [...mine, ...seed] : seed;
  }, [mine, edits]);
}

/** One event by id: yours, a public sample, or a private event you were invited to. */
export function useEvent(id?: string) {
  const mine = useApp((s) => s.myEvents);
  const edits = useApp((s) => s.eventEdits);
  return useMemo(() => (id ? findEvent({ myEvents: mine, eventEdits: edits }, id) : undefined), [id, mine, edits]);
}

/** Private events you were invited to as a guest, with your invitation. */
export function useInvitedEvents(): { invite: GuestInvite; event: EventItem }[] {
  const invites = useApp((s) => s.guestInvites);
  const mine = useApp((s) => s.myEvents);
  const edits = useApp((s) => s.eventEdits);
  return useMemo(
    () =>
      invites
        .map((invite) => ({ invite, event: findEvent({ myEvents: mine, eventEdits: edits }, invite.eventId) }))
        .filter((x): x is { invite: GuestInvite; event: EventItem } => !!x.event),
    [invites, mine, edits],
  );
}

/** Feed posts: yours first, then samples. Posts removed by moderation are left out. */
export function useFeedPosts() {
  const mine = useApp((s) => s.myPosts);
  const removed = useApp((s) => s.removedContent);
  return useMemo(() => {
    const all = mine.length ? [...mine, ...seedPosts] : seedPosts;
    return removed.length ? all.filter((p) => !removed.includes(p.id)) : all;
  }, [mine, removed]);
}

/** The venue the demo venue owner manages; its public page shows the owner's listing edits. */
export const OWN_VENUE_ID = 'moonclub';

/** A venue with the owner's listing (Pro → Venue listing) applied when it is their own venue. */
export function overlayVenue(venue: Venue, listing: VenueListing): Venue;
export function overlayVenue(venue: Venue | undefined, listing: VenueListing): Venue | undefined;
export function overlayVenue(venue: Venue | undefined, listing: VenueListing): Venue | undefined {
  if (!venue || venue.id !== OWN_VENUE_ID) return venue;
  const [cover, ...gallery] = listing.photos;
  return {
    ...venue,
    name: listing.name || venue.name,
    area: listing.area || venue.area,
    type: listing.type,
    capacity: listing.capacity,
    rooms: listing.rooms,
    stages: listing.stages,
    pricePerNight: listing.pricePerNight,
    parking: listing.parking,
    equipment: listing.equipment || venue.equipment,
    occasions: listing.occasions,
    description: listing.description || venue.description,
    cover: cover ?? venue.cover,
    gallery: cover ? gallery : venue.gallery,
    parkingDetails: listing.parkingDetails ? { ...listing.parkingDetails, available: listing.parking } : venue.parkingDetails,
    garden: listing.garden ?? venue.garden,
    facilities: listing.facilities ?? venue.facilities,
    requirements: listing.requirements ?? venue.requirements,
    pricing: listing.pricing ?? venue.pricing,
    catering: listing.catering ?? venue.catering,
    security: listing.security ?? venue.security,
    extraCharges: listing.extraCharges ?? venue.extraCharges,
  };
}

/** The venue for `id`, including the owner's listing edits for their own venue. */
export function useVenue(id?: string): Venue | undefined {
  const listing = useApp((s) => s.venueListing);
  return useMemo(() => (id ? overlayVenue(venueById(id), listing) : undefined), [id, listing]);
}

/** All venues, with the owner's listing edits applied. */
export function useVenues(): Venue[] {
  const listing = useApp((s) => s.venueListing);
  return useMemo(() => seedVenues.map((v) => overlayVenue(v, listing)), [listing]);
}

/**
 * Star rating and review count for a venue (or legacy artist stars) as the detail pages and /ratings show them:
 * your own reviews of completed bookings plus sample reviews, without blocked authors.
 * Musicians: use useArtistScore instead.
 */
export function useRating(id: string): { rating: number; count: number } {
  const bookings = useApp((s) => s.bookings);
  const reviews = useApp((s) => s.reviews);
  const blocked = useApp((s) => s.blocked);
  return useMemo(() => {
    const extra = bookings.filter((b) => b.targetId === id && reviews[b.id] && reviews[b.id].rating > 0).map((b) => reviews[b.id].rating);
    const opts = { extra, exclude: blocked };
    return { rating: ratingFor(id, opts), count: reviewCountFor(id, opts) };
  }, [id, bookings, reviews, blocked]);
}

/**
 * "Would book again" score for a musician: verified sample reviews plus your own reviews of
 * completed bookings with them, without blocked authors. Import artistScore types from lib/ratings.
 */
export function useArtistScore(id: string) {
  const bookings = useApp((s) => s.bookings);
  const reviews = useApp((s) => s.reviews);
  const blocked = useApp((s) => s.blocked);
  return useMemo(() => {
    const extra = bookings
      .filter((b) => b.targetId === id && b.type !== 'venue' && b.status === 'completed' && reviews[b.id]?.recommend != null)
      .map((b) => ({ recommend: !!reviews[b.id].recommend, tags: reviews[b.id].tags }));
    return artistScoreOf(id, { extra, exclude: blocked });
  }, [id, bookings, reviews, blocked]);
}

export interface ActionItem {
  id: string;
  kind: 'application' | 'invite' | 'contribution' | 'friend' | 'booking' | 'quote' | 'payment' | 'change' | 'support' | 'request';
  icon: IconName;
  title: string;
  sub: string;
  /** An existing route for the record that needs action. */
  href: string;
  tone: Tone;
}

/**
 * Things waiting for you, derived from real records only (blueprint dashboards and notifications):
 * application outcomes, invitations and contributions, friend requests, quotes, payment problems,
 * change requests, support replies, and (in an approved provider workspace) requests due.
 */
export function useActionQueue(): ActionItem[] {
  const user = useApp((s) => s.user);
  const invites = useApp((s) => s.guestInvites);
  const friendRequests = useApp((s) => s.friendRequests);
  const bookings = useApp((s) => s.bookings);
  const cases = useApp((s) => s.supportCases);
  const requests = useApp((s) => s.requests);
  const blocked = useApp((s) => s.blocked);
  return useMemo(() => {
    const out: ActionItem[] = [];
    const app = user.application;
    if (app?.status === 'info') out.push({ id: 'app', kind: 'application', icon: 'file-document-edit-outline', title: 'Your application needs more information', sub: app.missing?.join(', ') || app.reason || 'Open it to see what is missing', href: '/application', tone: 'warning' });
    if (app?.status === 'approved' && user.role !== app.role) out.push({ id: 'app', kind: 'application', icon: 'check-decagram', title: `You’re approved as ${ROLE_LABEL[app.role]}`, sub: 'Switch to your professional workspace', href: '/application', tone: 'success' });
    if (app?.status === 'rejected') out.push({ id: 'app', kind: 'application', icon: 'file-document-outline', title: 'Your application was not approved', sub: app.reason ?? 'See the reason and how to resubmit', href: '/application', tone: 'danger' });
    invites.forEach((g) => {
      if (blocked.includes(g.fromId)) return;
      const from = profileById(g.fromId)?.name ?? 'A friend';
      if (g.status === 'invited') out.push({ id: g.id, kind: 'invite', icon: 'email-open-outline', title: `${from} invited you`, sub: g.contribution ? `Cost sharing ${euro(g.contribution)} per guest` : 'Free invitation', href: `/invitation/${g.id}`, tone: 'brand' });
      else if (g.status === 'accepted' && g.contribution && g.payment !== 'paid') out.push({ id: g.id, kind: 'contribution', icon: g.payment === 'failed' ? 'alert-circle-outline' : 'cash', title: g.payment === 'failed' ? 'Contribution payment failed' : `Pay your ${euro(g.contribution)} contribution`, sub: 'Your ticket is issued once the payment succeeds', href: `/invitation/${g.id}`, tone: g.payment === 'failed' ? 'danger' : 'warning' });
    });
    friendRequests.forEach((r) => {
      if (r.status !== 'pending' || r.fromId === 'me' || blocked.includes(r.fromId)) return;
      out.push({ id: r.id, kind: 'friend', icon: 'account-plus-outline', title: `${profileById(r.fromId)?.name ?? 'Someone'} wants to be friends`, sub: 'Accept or decline', href: '/friends?tab=requests', tone: 'brand' });
    });
    bookings.forEach((b) => {
      const name = providerOf(b).name;
      if (b.status === 'payment_failed' || b.payment === 'failed') out.push({ id: b.id, kind: 'payment', icon: 'credit-card-off-outline', title: `Payment failed · ${name}`, sub: 'Retry safely on the same booking', href: `/booking/${b.id}`, tone: 'danger' });
      else if (b.pricing === 'quote' && b.quote && b.status === 'requested' && (quoteState(b.quote) === 'sent' || quoteState(b.quote) === 'revised')) out.push({ id: b.id, kind: 'quote', icon: 'file-document-outline', title: `${name} sent a quote`, sub: `${euro(b.quote.total)} · review and accept or decline`, href: `/booking/${b.id}`, tone: 'warning' });
      else if (b.status === 'accepted' && (b.payment === 'not_started' || b.payment === 'capture_pending')) out.push({ id: b.id, kind: 'booking', icon: 'credit-card-clock-outline', title: `${name} accepted · finalize payment`, sub: `${b.eventTitle} · ${euro(b.amount)}`, href: `/booking/${b.id}`, tone: 'warning' });
      else if (b.status === 'change_requested') out.push({ id: b.id, kind: 'change', icon: 'swap-horizontal', title: `Change requested · ${name}`, sub: b.change?.note ?? b.eventTitle, href: `/booking/${b.id}`, tone: 'warning' });
      else if (b.pendingCancellation && isOutstanding(b.status)) out.push({ id: b.id, kind: 'booking', icon: 'calendar-remove-outline', title: `Event cancelled · ${name} booking open`, sub: 'Cancel it or agree new terms with the provider', href: `/booking/${b.id}`, tone: 'warning' });
    });
    cases.forEach((c) => {
      if (c.status === 'waiting') out.push({ id: c.id, kind: 'support', icon: 'lifebuoy', title: `Support replied · ${c.ref}`, sub: c.topic, href: `/support/${c.id}`, tone: 'brand' });
    });
    if (canAcceptBookings(user)) {
      requests.forEach((r) => {
        if (r.status === 'new') out.push({ id: r.id, kind: 'request', icon: 'calendar-clock', title: `${r.requester} · ${r.title}`, sub: r.pricing === 'quote' ? 'Quote requested' : `${euro(r.offer)} · respond before the deadline`, href: `/pro/request/${r.id}`, tone: 'warning' });
      });
    }
    return out;
  }, [user, invites, friendRequests, bookings, cases, requests, blocked]);
}
