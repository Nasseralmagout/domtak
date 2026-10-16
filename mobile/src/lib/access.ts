import type { IconName } from '../components/Icon';
import type { ImgKey } from '../data/images';
import type { ProfessionalRole, Role } from '../data/types';

/**
 * Access and workspace helpers (blueprint F01–F04, sections 02 and 14).
 * Used by sign-up, the professional application, its status screen and the workspace switcher.
 */

/** Workspace names. The member workspace is what every account has; professional ones need approval. */
export const WORKSPACE_LABEL: Record<Role, string> = {
  fan: 'Member',
  musician: 'Artist, band or DJ',
  venue: 'Venue',
  organizer: 'Organizer',
};

export const WORKSPACE_ICON: Record<Role, IconName> = {
  fan: 'account-heart-outline',
  musician: 'microphone-variant',
  venue: 'storefront-outline',
  organizer: 'calendar-star',
};

/** What each workspace lets you do (section 02, roles and permissions). */
export const WORKSPACE_SUMMARY: Record<Role, string> = {
  fan: 'Discover music, join communities, create private events, buy tickets and book artists or venues.',
  musician: 'Receive booking requests, set your services and prices, post to the feed and track earnings.',
  venue: 'List your space, parking and outdoor areas, catering and security, and accept venue bookings.',
  organizer: 'Publish public events, arrange lineups and venues, manage guests and scan tickets.',
};

/** Where a workspace opens after switching (its dashboard). */
export function workspaceHome(role: Role): string {
  return role === 'fan' ? '/(tabs)' : '/pro/workspace';
}

/** Only internal paths are allowed as a post sign-in destination (never another site or a protocol URL). */
export function safeNext(next?: string | string[]): string | undefined {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || typeof v !== 'string') return undefined;
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://')) return undefined;
  if (/^\/(login|register|verify|onboarding)(\?|$)/.test(v)) return undefined;
  return v;
}

// ---------- Professional application form (F02) ----------

export type ApplyStep = 'details' | 'support';

export type FieldKind = 'text' | 'multiline' | 'number' | 'choice' | 'genres' | 'media' | 'link';

export interface ApplyField {
  /** Also the key in Application.details, so reviewers read the same label the applicant saw. */
  label: string;
  kind: FieldKind;
  step: ApplyStep;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
  /** Minimum characters for text answers. */
  min?: number;
  /** Shown before a number answer and stored with it, e.g. '€' for a fee. */
  prefix?: string;
  /** Photos offered by the media picker (the device gallery in the installed app). */
  gallery?: ImgKey[];
}

export const PRO_ROLE_TITLE: Record<ProfessionalRole, string> = {
  musician: 'Artist, band or DJ',
  venue: 'Venue',
  organizer: 'Organizer',
};

export const PRO_ROLE_PITCH: Record<ProfessionalRole, string> = {
  musician: 'Get booked for private and public events, publish your services and post to the feed.',
  venue: 'Rent out your space with clear capacity, parking, outdoor space, catering and security options.',
  organizer: 'Publish public events, book artists and venues, sell tickets and run the door.',
};

export const APPLY_FIELDS: Record<ProfessionalRole, ApplyField[]> = {
  musician: [
    { label: 'Act type', kind: 'choice', step: 'details', required: true, options: ['Solo artist', 'Band', 'DJ'] },
    { label: 'Stage name', kind: 'text', step: 'details', required: true, placeholder: 'The name people book you under', min: 2 },
    { label: 'Genres', kind: 'genres', step: 'details', required: true, hint: 'Pick the styles you perform' },
    { label: 'Music links', kind: 'link', step: 'details', required: true, placeholder: 'SoundCloud, Spotify, YouTube or Bandcamp link', min: 6 },
    { label: 'Press photos', kind: 'media', step: 'details', required: true, hint: 'At least one photo of you or your act', gallery: ['m_sara', 'm_live_singer', 'band_stage', 'dj_red', 'm_sax', 'band_jam'] },
    { label: 'Fee per hour', kind: 'number', step: 'details', placeholder: 'e.g. 150', hint: 'In euro. Leave empty if you prefer to send quotes', prefix: '€' },
    { label: 'About the act', kind: 'multiline', step: 'support', required: true, placeholder: 'What you play, line-up, what a booking includes', min: 20 },
    { label: 'Recent performances', kind: 'multiline', step: 'support', required: true, placeholder: 'Venues, events or dates from the last 12 months', min: 6 },
    { label: 'Travel and equipment', kind: 'text', step: 'support', placeholder: 'e.g. travel within Berlin, own controller' },
  ],
  venue: [
    { label: 'Venue name', kind: 'text', step: 'details', required: true, placeholder: 'e.g. Moon Club', min: 2 },
    { label: 'Address', kind: 'text', step: 'details', required: true, placeholder: 'Street, postcode, Berlin', min: 6 },
    { label: 'Capacity', kind: 'number', step: 'details', required: true, placeholder: 'Maximum guests indoors' },
    { label: 'Venue type', kind: 'choice', step: 'details', required: true, options: ['Club', 'Bar', 'Event hall', 'Loft', 'Garden', 'Other'] },
    { label: 'Venue photos', kind: 'media', step: 'details', required: true, hint: 'At least one photo of the space', gallery: ['ven_loft', 'ven_hall', 'ven_neon', 'ven_moon', 'ven_garden', 'ven_forest'] },
    { label: 'Permission to host events', kind: 'choice', step: 'support', required: true, options: ['I own the venue', 'I rent it with permission to host events', 'I manage it for the owner'] },
    { label: 'Parking details', kind: 'text', step: 'support', placeholder: 'e.g. 12 on-site spaces, or street parking only' },
    { label: 'Garden / outdoor space', kind: 'text', step: 'support', placeholder: 'e.g. covered garden for 80 guests, or none' },
    { label: 'About the venue', kind: 'multiline', step: 'support', required: true, placeholder: 'Rooms, equipment, house rules and typical events', min: 20 },
  ],
  organizer: [
    { label: 'Organisation', kind: 'text', step: 'details', required: true, placeholder: 'Company or collective name', min: 2 },
    { label: 'Event types', kind: 'text', step: 'details', required: true, placeholder: 'e.g. club nights, open airs, concerts', min: 3 },
    { label: 'Past events', kind: 'multiline', step: 'details', required: true, placeholder: 'Names, dates and venues of events you ran', min: 10 },
    { label: 'Website or social link', kind: 'link', step: 'details', placeholder: 'e.g. instagram.com/yourcollective' },
    { label: 'Event photos', kind: 'media', step: 'details', hint: 'Optional: photos from your past events', gallery: ['ev_party', 'ev_festival', 'ev_lasers', 'ev_red_crowd', 'ev_live_stage', 'ev_purple_arena'] },
    { label: 'Typical audience size', kind: 'number', step: 'support', placeholder: 'e.g. 300' },
    { label: 'Business registration', kind: 'text', step: 'support', required: true, placeholder: 'Trade licence or company number', min: 4 },
    { label: 'About your events', kind: 'multiline', step: 'support', required: true, placeholder: 'Your audience, how you sell tickets and run entry', min: 20 },
  ],
};

/** "3 photos" — how a media answer is stored in Application.details. */
export function photoCount(n: number) {
  return `${n} photo${n === 1 ? '' : 's'}`;
}

/** Items a reviewer typically asks for when an application is incomplete (used by the labelled demo review). */
export const DEMO_MISSING: Record<ProfessionalRole, string[]> = {
  musician: ['Music links', 'Recent performances'],
  venue: ['Permission to host events', 'Parking details', 'Garden / outdoor space'],
  organizer: ['Past events', 'Business registration'],
};

export const DEMO_REJECT_REASON: Record<ProfessionalRole, string> = {
  musician: 'We could not verify the music links or recent performances you listed.',
  venue: 'We could not confirm that you are allowed to host events at this address.',
  organizer: 'We could not verify the past events or business registration you listed.',
};

/** A complete sample application per role, for the clearly labelled demo shortcut in Settings. */
export const SAMPLE_APPLICATION: Record<ProfessionalRole, Record<string, string>> = {
  musician: { 'Act type': 'DJ', 'Stage name': 'Sara Nights', Genres: 'Techno, House', 'Music links': 'soundcloud.com/saranights', 'Press photos': photoCount(2), 'Fee per hour': '€120', 'About the act': 'Melodic techno and house sets for clubs and private parties.', 'Recent performances': 'Moon Club, Sep 2026 · Rooftop party, Aug 2026' },
  venue: { 'Venue name': 'Moon Club', Address: 'Revaler Str. 99, 10245 Berlin', Capacity: '350', 'Venue type': 'Club', 'Venue photos': photoCount(3), 'Permission to host events': 'I manage it for the owner', 'Parking details': '12 on-site spaces', 'Garden / outdoor space': 'Covered garden for 120 guests', 'About the venue': 'Club with a Funktion-One system, two rooms and a garden.' },
  organizer: { Organisation: 'Kiez Nights Collective', 'Event types': 'Club nights, open airs', 'Past events': '8 club nights at Moon Club and Arcada in 2026', 'Business registration': 'Gewerbe 2024-118', 'About your events': 'Monthly techno nights for 200 to 400 guests with online tickets.' },
};
