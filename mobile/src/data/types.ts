import type { ImgKey } from './images';

export type Role = 'fan' | 'musician' | 'venue' | 'organizer';
export type ProfileKind = 'fan' | 'musician' | 'dj' | 'band' | 'organizer';

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
  rating?: number;
  eventsCount?: number;
  gallery?: ImgKey[];
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
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  time: string;
  likes: number;
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
  | 'disputed';

export interface Booking {
  id: string;
  type: 'musician' | 'venue';
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
}

export interface Ticket {
  id: string;
  eventId: string;
  typeId: string;
  holder: string;
  code: string;
  status: 'valid' | 'used' | 'cancelled';
  purchasedAt: string;
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
  status: 'new' | 'accepted' | 'declined' | 'past';
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
