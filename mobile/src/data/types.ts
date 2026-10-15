import type { ImgKey } from './images';

export type Role = 'fan' | 'musician' | 'venue' | 'organizer';
/** Roles that need a reviewed application (blueprint F02). 'fan' is the member workspace every account has. */
export type ProfessionalRole = Exclude<Role, 'fan'>;
export type ProfileKind = 'fan' | 'musician' | 'dj' | 'band' | 'organizer';

/** Professional application outcome (F02–F03). 'info' = more information requested. */
export type ApplicationStatus = 'pending' | 'info' | 'approved' | 'rejected';

export interface Application {
  role: ProfessionalRole;
  status: ApplicationStatus;
  /** ISO timestamp of the latest submission (resubmitting resets it). */
  submittedAt: string;
  decidedAt?: string;
  /** Reason given with a rejection or information request. */
  reason?: string;
  /** Exact missing items when status is 'info'. */
  missing?: string[];
  /** Role-specific answers from the application form, e.g. { 'Stage name': 'Sara', 'Genres': 'Acoustic' }. */
  details: Record<string, string>;
  /** Every submission and decision, oldest first (application status timeline). */
  history?: { at: string; status: ApplicationStatus; note?: string }[];
}

/** An application from someone else in the admin review queue (F03). */
export interface QueuedApplication extends Application {
  id: string;
  applicantName: string;
  handle: string;
  avatar?: ImgKey;
  city: string;
  /** Reviewer who last decided it ('You' for the demo admin). */
  reviewer?: string;
}

/** Whether the provider shows a listed price or asks for a quote request (F05, F06, F15). */
export type PricingMode = 'listed' | 'quote';

/** A music lesson service (F23). Its own scope: never reuses performance pricing. */
export interface Lesson {
  id: string;
  title: string;
  instrument: string;
  format: 'in-person' | 'online' | 'at-studio';
  location?: string;
  durationMin: number;
  /** Price per session in euro. Missing when the lesson is quote-only. */
  price?: number;
  /** True when learners request a quote instead of seeing a price. */
  quote?: boolean;
  level: string;
  description?: string;
}

export interface Profile {
  id: string;
  name: string;
  handle: string;
  kind: ProfileKind;
  title: string;
  avatar: ImgKey;
  cover?: ImgKey;
  city: string;
  verified?: boolean;
  followers: number;
  following: number;
  bio: string;
  genres: string[];
  feePerHour?: number;
  instruments?: string[];
  links?: { soundcloud?: boolean; spotify?: boolean; youtube?: boolean };
  /** Legacy star rating. Musicians show the "Would book again" score from lib/ratings instead. */
  rating?: number;
  eventsCount?: number;
  gallery?: ImgKey[];
  /** Lessons this artist teaches (F23). */
  lessons?: Lesson[];
  /** 'quote' = customers request an itemised quote instead of seeing feePerHour. Missing = 'listed'. */
  pricing?: PricingMode;
  /** Charges billed separately from the performance fee (F05/F14). */
  charges?: { travel?: number; travelNote?: string; equipment?: number; equipmentNote?: string };
}

/** Parking details. Venue.parking (boolean) stays the availability flag; read both through venueParking(venue). */
export interface VenueParking {
  available: boolean;
  spaces?: number;
  kind?: 'on-site' | 'street' | 'garage' | 'nearby';
  notes?: string;
}

/** Garden or other outdoor space. Always a separate item from parking. */
export interface VenueGarden {
  available: boolean;
  /** Guests the outdoor space holds. */
  capacity?: number;
  covered?: boolean;
  notes?: string;
}

/** Catering priced per guest: pricePerGuest × max(guests, minGuests). */
export interface VenueCatering {
  available: boolean;
  pricePerGuest: number;
  minGuests?: number;
  notes?: string;
}

/** Security priced by attendance: ceil(guests / guestsPerGuard) × pricePerGuard. */
export interface VenueSecurity {
  available: boolean;
  guestsPerGuard: number;
  pricePerGuard: number;
  /** Security becomes mandatory from this many guests. */
  requiredFrom?: number;
  notes?: string;
}

/** A separate, optional venue charge (equipment, cleaning, sound engineer…). */
export interface ExtraCharge {
  label: string;
  amount: number;
}

export interface Venue {
  id: string;
  name: string;
  area: string;
  city: string;
  postcode: string;
  cover: ImgKey;
  gallery: ImgKey[];
  type: 'Club' | 'Open air' | 'Hall' | 'Loft' | 'Garden' | 'Bar';
  pricePerNight: number;
  capacity: number;
  rooms: number;
  stages: number;
  parking: boolean;
  equipment: string;
  occasions: string[];
  rating: number;
  followers: number;
  description: string;
  mapPos: { x: number; y: number };
  /** Parking details; `parking` above stays the yes/no flag. Use venueParking(venue). */
  parkingDetails?: VenueParking;
  /** Outdoor space, distinct from parking. Use venueGarden(venue). */
  garden?: VenueGarden;
  facilities?: string[];
  /** House rules and requirements for hosts (curfew, deposit, age…). */
  requirements?: string[];
  /** Missing = 'listed' (pricePerNight). */
  pricing?: PricingMode;
  catering?: VenueCatering;
  security?: VenueSecurity;
  extraCharges?: ExtraCharge[];
}

export interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  sold: number;
}

export type EventCategory = 'Concerts' | 'Parties' | 'Electronic' | 'Acoustic' | 'Family' | 'Festivals' | 'Listening';

/** Event lifecycle (blueprint section 06). Derive the live value with eventState() in lib/events. */
export type EventState = 'draft' | 'planning' | 'published' | 'ready' | 'in_progress' | 'completed' | 'cancelled';

/** Private-event cost sharing (F20): each accepted guest contributes perGuest euro. */
export interface CostSharing {
  enabled: boolean;
  perGuest: number;
  /** ISO day by which guests should pay. */
  deadline?: string;
  note?: string;
}

/** A guest invited to an event you host. */
export interface Invitation {
  profileId: string;
  status: 'invited' | 'accepted' | 'declined';
  paid?: boolean;
  ticketId?: string;
}

export interface EventItem {
  id: string;
  title: string;
  subtitle?: string;
  cover: ImgKey;
  category: EventCategory;
  genre: string;
  venueId: string;
  organizerId: string;
  lineup: string[];
  start: string;
  end: string;
  ticketTypes: TicketType[];
  going: number;
  rating: number;
  distanceKm: number;
  ageLimit?: number;
  description: string;
  mapPos: { x: number; y: number };
  sponsored?: boolean;
  refundPolicy: string;
  isPrivate?: boolean;
  /** Stored lifecycle state. Missing on sample events (treated as 'published'). */
  state?: EventState;
  /** Host profile id ('me' for your own events). */
  hostId?: string;
  expectedGuests?: number;
  /** Provider bookings attached to this event (each keeps its own status and payment). */
  bookingIds?: string[];
  costSharing?: CostSharing;
  invitations?: Invitation[];
  cancelReason?: string;
  cancelledAt?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  time: string;
  likes: number;
  /** Photos attached to the comment (members can only share photos inside comments). */
  photos?: ImgKey[];
}

/** Who can see a post: everyone, or only your followers (shown in the Following feed only). */
export type PostVisibility = 'Public' | 'Followers';

export interface Post {
  id: string;
  authorId: string;
  kind: 'photo' | 'carousel' | 'video';
  media: ImgKey[];
  caption: string;
  likes: number;
  comments: Comment[];
  shares: number;
  time: string;
  location?: string;
  eventId?: string;
  track?: string;
  feed: ('forYou' | 'following' | 'nearby')[];
  /** Missing on sample posts, which are all public. */
  visibility?: PostVisibility;
}

export interface Story {
  id: string;
  authorId: string;
  frames: ImgKey[];
  live?: boolean;
}

export interface Message {
  id: string;
  from: 'me' | 'them';
  type: 'text' | 'image' | 'voice';
  text?: string;
  image?: ImgKey;
  duration?: string;
  time: string;
  liked?: boolean;
}

export interface Conversation {
  id: string;
  withId: string;
  messages: Message[];
  unread: number;
}

export interface AppNotification {
  id: string;
  type: 'follow' | 'comment' | 'reshare' | 'like' | 'booking' | 'ticket' | 'event';
  actorId: string;
  text: string;
  time: string;
  section: 'Today' | 'This week' | 'Earlier';
  thumb?: ImgKey;
  href?: string;
}

export type BookingStatus =
  | 'requested'
  | 'pending'
  | 'accepted'
  | 'paid'
  | 'confirmed'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'disputed'
  | 'change_requested'
  | 'payment_failed';

/** Financial state of one booking (blueprint section 08). Separate from BookingStatus. */
export type PaymentState =
  | 'not_started'
  | 'authorized'
  | 'capture_pending'
  | 'paid'
  | 'release_pending'
  | 'released'
  | 'refund_pending'
  | 'refunded'
  | 'failed'
  | 'payout_pending'
  | 'paid_out'
  | 'disputed';

/** Itemised charges in euro. travel and equipment are always separate from the base fee. */
export interface BookingCharges {
  base: number;
  travel?: number;
  equipment?: number;
  catering?: number;
  security?: number;
  fee?: number;
}

export interface QuoteItem {
  label: string;
  amount: number;
}

export type QuoteStatus = 'requested' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'revised';

/** Itemised quote (F15). version 0 = requested, nothing priced yet; each sendQuote bumps it. */
export interface Quote {
  version: number;
  status: QuoteStatus;
  items: QuoteItem[];
  total: number;
  /** ISO day the quote stays valid until. */
  validUntil?: string;
  note?: string;
}

export interface BookingTimelineEntry {
  at: string;
  label: string;
}

export interface Booking {
  id: string;
  /** 'lesson' bookings point at an artist (targetId) and one of their lessons (lessonId). */
  type: 'musician' | 'venue' | 'lesson';
  targetId: string;
  eventTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  location: string;
  guests: number;
  equipment: string;
  extras: string;
  note: string;
  amount: number;
  status: BookingStatus;
  createdAt: string;
  /** Files or statements attached to a dispute (booking/issue). */
  evidence?: string[];
  /** Provider response deadline (ISO): 24 h after the request reached them. */
  deadline?: string;
  /** When the 12-hour reminder goes out while the request is still awaiting a response. */
  reminderAt?: string;
  payment?: PaymentState;
  /** Missing = 'listed'. */
  pricing?: PricingMode;
  charges?: BookingCharges;
  quote?: Quote;
  /** The event this booking belongs to. */
  eventId?: string;
  /** For type 'lesson'. */
  lessonId?: string;
  cancelReason?: string;
  /** A pending change request (F16/F13): agreed terms stay until both sides accept. */
  change?: { note: string; requestedAt: string; previous: BookingStatus };
  /** Set when the linked event was cancelled: the booking goes through the cancellation process, it is not auto-cancelled. */
  pendingCancellation?: { reason: string; at: string; source: 'event' | 'customer' };
  /** Payment attempts on this same booking (retries never create a second booking). */
  paymentAttempts?: number;
  paymentRef?: string;
  /** What happened, oldest first. */
  timeline?: BookingTimelineEntry[];
}

export interface Ticket {
  id: string;
  eventId: string;
  typeId: string;
  holder: string;
  code: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  purchasedAt: string;
  /** ISO time of the (first) door check-in. */
  checkedInAt?: string;
  /** Guest invitation this ticket was issued for (private events). */
  inviteId?: string;
  /** Amount paid (cost-sharing contribution or ticket price). */
  paid?: number;
}

export interface IncomingRequest {
  id: string;
  requester: string;
  initials: string;
  requesterRole: string;
  title: string;
  date: string;
  time: string;
  hours: number;
  location: string;
  guests: number;
  equipment: string;
  message: string;
  offer: number;
  expires: string;
  status: 'new' | 'accepted' | 'declined' | 'past' | 'expired';
  /** Response deadline (ISO), 24 h after the request arrived. Show it with timeLeft(). */
  deadline?: string;
  /** 12-hour reminder time (ISO). */
  reminderAt?: string;
  /** Event day as ISO (YYYY-MM-DD) for conflict checks. */
  isoDate?: string;
  /** What is being booked: a performance, your venue, or a lesson. Missing = performance. */
  kind?: 'performance' | 'venue' | 'lesson';
  /** 'quote' = the customer asked you for an itemised quote. Missing = 'listed'. */
  pricing?: PricingMode;
  quote?: Quote;
  /** Payment state as the provider sees it. */
  payment?: PaymentState;
  charges?: BookingCharges;
  /** Your counter offer in euro, if you sent one (the request stays 'new' until the booker answers). */
  counterOffer?: number;
  /** Optional note sent with the counter offer. */
  counterNote?: string;
}

export interface Attendee {
  id: string;
  name: string;
  avatar?: ImgKey;
  ticketType: string;
  code: string;
  checkedIn: boolean;
}

/** Platform-created music community (F09). Members cannot create communities in the initial scope. */
export interface Community {
  id: string;
  name: string;
  description: string;
  cover: ImgKey;
  members: number;
  genres: string[];
  eventIds: string[];
  postIds: string[];
  rules?: string[];
}

export interface FriendRequest {
  id: string;
  /** 'me' for requests you sent. */
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  at?: string;
}

/** An invitation you (the signed-in user) received as a guest (F20–F21). */
export interface GuestInvite {
  id: string;
  eventId: string;
  fromId: string;
  status: 'invited' | 'accepted' | 'declined';
  /** Cost-sharing contribution in euro; missing or 0 = free. */
  contribution?: number;
  payment?: PaymentState;
  ticketId?: string;
  sentAt?: string;
  message?: string;
}

export type SupportCaseStatus = 'open' | 'waiting' | 'resolved';

export interface SupportCase {
  id: string;
  /** Case reference shown to the user, e.g. "DT-4821". */
  ref: string;
  topic: string;
  linked?: { kind: 'booking' | 'ticket' | 'event' | 'account'; id: string };
  status: SupportCaseStatus;
  createdAt: string;
  messages: { from: 'me' | 'support'; text: string; at: string }[];
}

export type ReportKind = 'post' | 'comment' | 'profile' | 'message' | 'event';
export type ReportStatus = 'open' | 'dismissed' | 'restricted' | 'removed';

export interface Report {
  id: string;
  kind: ReportKind;
  targetId: string;
  reason: string;
  at: string;
  status: ReportStatus;
  /** True for reports you filed. The reporter's identity is never shown to the reported account. */
  byMe?: boolean;
  details?: string;
  decision?: { note?: string; at: string };
}

/** Admin decision log (F03, F25, F26). */
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  note?: string;
}
