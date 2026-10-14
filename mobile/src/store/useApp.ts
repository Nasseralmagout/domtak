import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ImgKey } from '../data/images';
import { conversations as seedConversations, events as seedEvents, incomingRequests, initialBookings, posts as seedPosts } from '../data/mock';
import type { Booking, BookingStatus, Comment, Conversation, EventItem, IncomingRequest, Message, Post, Role, Ticket } from '../data/types';
import { ticketCode, uid } from '../lib/format';

export interface User {
  name: string;
  handle: string;
  email: string;
  phone: string;
  bio: string;
  city: string;
  avatar?: ImgKey;
  role: Role;
  genres: string[];
  pro: 'none' | 'review' | 'verified';
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
  rating: number;
  text: string;
  tags: string[];
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
  parking: boolean;
  equipment: string;
  occasions: string[];
  description: string;
  photos: ImgKey[];
}

interface State {
  onboarded: boolean;
  authed: boolean;
  user: User;
  prefs: { bookings: boolean; messages: boolean; nearby: boolean; privateAccount: boolean; language: 'English' | 'Deutsch' };

  likes: Record<string, boolean>;
  saves: Record<string, boolean>;
  following: Record<string, boolean>;
  going: Record<string, boolean>;
  wishlist: { events: string[]; artists: string[]; venues: string[] };

  myPosts: Post[];
  extraComments: Record<string, Comment[]>;
  myEvents: EventItem[];
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
  availability: Availability;
  promotions: Promotion[];
  plan: 'free' | 'monthly' | 'yearly';
  venueListing: VenueListing;
  payouts: Payout[];
  balance: number;

  // actions
  completeOnboarding: () => void;
  signIn: (email: string) => void;
  register: (u: Partial<User>) => void;
  signOut: () => void;
  updateUser: (u: Partial<User>) => void;
  setPref: <K extends keyof State['prefs']>(k: K, v: State['prefs'][K]) => void;

  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleFollow: (profileId: string) => void;
  toggleGoing: (eventId: string) => void;
  toggleWish: (kind: keyof State['wishlist'], id: string) => void;

  addPost: (p: Omit<Post, 'id' | 'likes' | 'comments' | 'shares' | 'time' | 'feed' | 'authorId'>) => string;
  addComment: (postId: string, text: string) => void;
  addEvent: (e: Omit<EventItem, 'id' | 'going' | 'rating' | 'distanceKm' | 'organizerId'>) => string;

  startTicketCheckout: (eventId: string, typeId: string, qty: number) => void;
  startBookingCheckout: (bookingId: string) => void;
  completeCheckout: () => { kind: 'ticket'; ids: string[] } | { kind: 'booking'; id: string } | undefined;

  createBooking: (b: Omit<Booking, 'id' | 'status' | 'createdAt'>) => string;
  setBookingStatus: (id: string, status: BookingStatus) => void;
  setRequestStatus: (id: string, status: IncomingRequest['status']) => void;

  sendMessage: (conversationId: string, msg: Omit<Message, 'id' | 'time' | 'from'>) => void;
  ensureConversation: (withId: string) => string;
  markConversationRead: (id: string) => void;
  markNotificationsRead: () => void;

  submitReview: (eventId: string, r: Review) => void;
  setSelectedPayment: (id: string) => void;
  addPaymentMethod: (m: Omit<PaymentMethod, 'id'>) => void;
  resetDemo: () => void;

  toggleBlock: (profileId: string) => void;
  setAvailability: (a: Partial<Availability>) => void;
  promoteEvent: (p: Omit<Promotion, 'id' | 'createdAt'>) => string;
  setPlan: (plan: State['plan']) => void;
  updateVenueListing: (v: Partial<VenueListing>) => void;
  requestPayout: () => number;
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
};

const initialData = () => ({
  onboarded: false,
  authed: false,
  user: defaultUser,
  prefs: { bookings: true, messages: true, nearby: false, privateAccount: false, language: 'English' as const },
  likes: {},
  saves: {},
  following: { adam: true, nightowls: true, soso: true, sara: true } as Record<string, boolean>,
  going: {},
  wishlist: { events: ['danceworld', 'summerfest', 'youngtalent'], artists: ['adam', 'soso'], venues: ['moonclub'] },
  myPosts: [],
  extraComments: {},
  myEvents: [],
  tickets: [
    { id: 't_seed1', eventId: 'danceworld', typeId: 'ga', holder: 'Sara M.', code: 'DW7K2QXA', status: 'valid' as const, purchasedAt: '2026-10-10' },
    { id: 't_seed2', eventId: 'listening', typeId: 'ga', holder: 'Sara M.', code: 'LS3M8PZB', status: 'cancelled' as const, purchasedAt: '2026-10-02' },
  ],
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
  } as VenueListing,
  payouts: [
    { id: 'po3', amount: 1080, date: '2026-10-01', status: 'paid' },
    { id: 'po2', amount: 2160, date: '2026-09-15', status: 'paid' },
    { id: 'po1', amount: 900, date: '2026-09-01', status: 'paid' },
  ] as Payout[],
  balance: 2040,
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

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initialData(),

      completeOnboarding: () => set({ onboarded: true }),
      signIn: (email) => set((s) => ({ authed: true, onboarded: true, user: { ...s.user, email: email || s.user.email } })),
      register: (u) => set((s) => ({ onboarded: true, user: { ...s.user, ...u } })),
      signOut: () => set({ authed: false }),
      updateUser: (u) => set((s) => ({ user: { ...s.user, ...u } })),
      setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),

      toggleLike: (id) => set((s) => ({ likes: toggleIn(s.likes, id) })),
      toggleSave: (id) => set((s) => ({ saves: toggleIn(s.saves, id) })),
      toggleFollow: (id) => set((s) => ({ following: toggleIn(s.following, id) })),
      toggleGoing: (id) => set((s) => ({ going: toggleIn(s.going, id) })),
      toggleWish: (kind, id) =>
        set((s) => {
          const list = s.wishlist[kind];
          return { wishlist: { ...s.wishlist, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [id, ...list] } };
        }),

      addPost: (p) => {
        const id = uid('post');
        const post: Post = { ...p, id, authorId: 'me', likes: 0, comments: [], shares: 0, time: 'now', feed: ['forYou', 'following', 'nearby'] };
        set((s) => ({ myPosts: [post, ...s.myPosts] }));
        return id;
      },
      addComment: (postId, text) =>
        set((s) => ({
          extraComments: {
            ...s.extraComments,
            [postId]: [...(s.extraComments[postId] ?? []), { id: uid('c'), authorId: 'me', text, time: 'now', likes: 0 }],
          },
        })),
      addEvent: (e) => {
        const id = uid('ev');
        const ev: EventItem = { ...e, id, organizerId: 'me', going: 0, rating: 0, distanceKm: 0.5 };
        set((s) => ({ myEvents: [ev, ...s.myEvents] }));
        return id;
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
            return { id, eventId: c.eventId, typeId: c.typeId, holder: get().user.name, code: ticketCode(), status: 'valid', purchasedAt: new Date().toISOString() };
          });
          set((s) => ({ tickets: [...tickets, ...s.tickets], going: { ...s.going, [c.eventId]: true }, checkout: undefined }));
          return { kind: 'ticket', ids };
        }
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === c.bookingId ? { ...b, status: 'paid' as const } : b)),
          checkout: undefined,
        }));
        return { kind: 'booking', id: c.bookingId };
      },

      createBooking: (b) => {
        const id = uid('b');
        set((s) => ({ bookings: [{ ...b, id, status: 'pending', createdAt: new Date().toISOString().slice(0, 10) }, ...s.bookings] }));
        return id;
      },
      setBookingStatus: (id, status) => set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)) })),
      setRequestStatus: (id, status) => set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, status } : r)) })),

      sendMessage: (cid, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === cid ? { ...c, messages: [...c.messages, { ...msg, id: uid('m'), from: 'me', time: nowTime() }] } : c,
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

      toggleBlock: (id) => set((s) => ({ blocked: s.blocked.includes(id) ? s.blocked.filter((x) => x !== id) : [...s.blocked, id] })),
      setAvailability: (a) => set((s) => ({ availability: { ...s.availability, ...a } })),
      promoteEvent: (p) => {
        const id = uid('promo');
        set((s) => ({ promotions: [{ ...p, id, createdAt: new Date().toISOString() }, ...s.promotions] }));
        return id;
      },
      setPlan: (plan) => set({ plan }),
      updateVenueListing: (v) => set((s) => ({ venueListing: { ...s.venueListing, ...v } })),
      requestPayout: () => {
        const amount = get().balance;
        if (amount <= 0) return 0;
        set((s) => ({ balance: 0, payouts: [{ id: uid('po'), amount, date: new Date().toISOString().slice(0, 10), status: 'processing' }, ...s.payouts] }));
        return amount;
      },
    }),
    {
      name: 'domtak-app',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { checkout: _checkout, ...rest } = s;
        return rest;
      },
    },
  ),
);

/** All events: sample data plus events the user created. */
export function useAllEvents() {
  const mine = useApp((s) => s.myEvents);
  return mine.length ? [...mine, ...seedEvents] : seedEvents;
}

export function useEvent(id?: string) {
  const mine = useApp((s) => s.myEvents);
  if (!id) return undefined;
  return mine.find((e) => e.id === id) ?? seedEvents.find((e) => e.id === id);
}

export function useFeedPosts() {
  const mine = useApp((s) => s.myPosts);
  return mine.length ? [...mine, ...seedPosts] : seedPosts;
}

export const ROLE_LABEL: Record<Role, string> = {
  fan: 'Fan',
  musician: 'Musician / DJ',
  venue: 'Venue owner',
  organizer: 'Organizer',
};

export const isPro = (role: Role) => role !== 'fan';
