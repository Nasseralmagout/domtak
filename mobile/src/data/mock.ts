import type {
  AppNotification,
  Attendee,
  Booking,
  Conversation,
  EventItem,
  IncomingRequest,
  Post,
  Profile,
  Story,
  Venue,
} from './types';

export const GENRES = ['Techno', 'House', 'Hip Hop', 'Indie', 'Jazz', 'Rock', 'Pop', 'D&B', 'Electronic', 'Acoustic', 'Trance', 'Soul'];

export const profiles: Profile[] = [
  {
    id: 'adam', name: 'Adam', handle: '@adam.berlin', kind: 'dj', title: 'DJ/Producer', avatar: 'dj_adam', cover: 'dj_adam',
    city: 'Berlin, Kreuzberg', verified: true, followers: 910, following: 47, rating: 4.9, eventsCount: 64,
    bio: "I'm a passionate electronic music enthusiast who found my calling in the vibrant techno scene of Berlin. Originally from Munich, I moved here five years ago to immerse myself in the city's legendary nightlife and produce my own records.",
    genres: ['Techno', 'House'], feePerHour: 300, instruments: ['CDJ Pioneer 3000', 'Ableton'], links: { soundcloud: true, spotify: true, youtube: true },
    gallery: ['feed_club', 'feed_decks', 'ev_club_dark', 'ev_lasers'],
  },
  {
    id: 'soso', name: 'Soso', handle: '@soso.wav', kind: 'dj', title: 'DJ/Producer', avatar: 'dj_soso', cover: 'dj_soso',
    city: 'Berlin, Friedrichshain', verified: true, followers: 12400, following: 310, rating: 4.8, eventsCount: 128,
    bio: 'Hypnotic techno and late-night grooves. Resident at Moon Club, touring across Europe.',
    genres: ['Techno', 'Trance'], feePerHour: 420, links: { soundcloud: true, spotify: true }, gallery: ['ev_lasers2', 'ev_purple_arena', 'feed_crowd'],
  },
  {
    id: 'dako', name: 'Dako', handle: '@dako.sea', kind: 'dj', title: 'DJ', avatar: 'dj_dako', cover: 'dj_dako',
    city: 'Berlin, Mitte', verified: false, followers: 3800, following: 120, rating: 4.7, eventsCount: 41,
    bio: 'Sunset sets, boat parties and deep house on the Spree.', genres: ['House', 'Jazz'], feePerHour: 250, links: { soundcloud: true, youtube: true },
    gallery: ['feed_rooftop', 'feed_openair'],
  },
  {
    id: 'cats', name: '4 Cats', handle: '@4cats', kind: 'dj', title: 'DJ', avatar: 'dj_4cats', cover: 'dj_4cats',
    city: 'Berlin, Neukölln', verified: true, followers: 8700, following: 205, rating: 4.8, eventsCount: 77,
    bio: 'Pop edits, disco and feel-good club music. Bringing the party since 2016.', genres: ['Pop', 'House'], feePerHour: 280, links: { spotify: true, youtube: true },
    gallery: ['ev_dancing', 'ev_party'],
  },
  {
    id: 'somadog', name: 'SomaDog', handle: '@somadog', kind: 'dj', title: 'DJ', avatar: 'dj_somadog', cover: 'dj_somadog',
    city: 'Berlin, Wedding', followers: 2100, following: 98, rating: 4.6, eventsCount: 23,
    bio: 'Post-punk edits and dark wave for sweaty basements.', genres: ['Rock', 'Electronic'], feePerHour: 200, links: { soundcloud: true },
  },
  {
    id: 'kai', name: 'Kai Nord', handle: '@kainord', kind: 'dj', title: 'DJ/Producer', avatar: 'dj_kai', cover: 'dj_kai',
    city: 'Berlin, Prenzlauer Berg', verified: true, followers: 5600, following: 140, rating: 4.7, eventsCount: 52,
    bio: 'Minimal and microhouse. Vinyl only.', genres: ['House', 'Techno'], feePerHour: 320, links: { soundcloud: true, spotify: true },
  },
  {
    id: 'miti', name: 'Miti S', handle: '@miti.s', kind: 'dj', title: 'DJ', avatar: 'dj_gojira', cover: 'dj_gojira',
    city: 'Berlin, Kreuzberg', followers: 1900, following: 88, rating: 4.5, eventsCount: 18,
    bio: 'Hard techno under strobe lights.', genres: ['Techno'], feePerHour: 220, links: { soundcloud: true },
  },
  {
    id: 'sameul', name: 'Sameul', handle: '@sameul.live', kind: 'musician', title: 'Singer / Songwriter', avatar: 'm_sameul', cover: 'm_sameul',
    city: 'Berlin, Schöneberg', verified: true, followers: 6400, following: 230, rating: 4.9, eventsCount: 39,
    bio: 'Soul vocals with a glittery twist. Available for weddings, galas and club shows.', genres: ['Soul', 'Pop'], feePerHour: 350,
    instruments: ['Vocals'], links: { spotify: true, youtube: true }, gallery: ['ev_concert_blue', 'ev_stage_gold'],
  },
  {
    id: 'sara', name: 'Sara', handle: '@sara.strings', kind: 'musician', title: 'Guitarist / Vocal', avatar: 'm_sara', cover: 'band_rehearsal',
    city: 'Berlin, Kreuzberg', verified: true, followers: 4100, following: 260, rating: 4.8, eventsCount: 33,
    bio: 'Acoustic sets, afro-pop and everything in between. I bring my own PA for small venues.', genres: ['Acoustic', 'Pop'], feePerHour: 180,
    instruments: ['Acoustic guitar', 'Vocals'], links: { spotify: true, youtube: true, soundcloud: true }, gallery: ['m_acoustic', 'feed_picnic'],
  },
  {
    id: 'dana', name: 'Dana', handle: '@dana.riffs', kind: 'musician', title: 'Guitarist / Vocal', avatar: 'm_dana', cover: 'm_dana',
    city: 'Berlin, Friedrichshain', followers: 2700, following: 190, rating: 4.7, eventsCount: 21,
    bio: 'Indie rock with loud guitars and quiet lyrics.', genres: ['Indie', 'Rock'], feePerHour: 160, instruments: ['Electric guitar', 'Vocals'], links: { spotify: true },
  },
  {
    id: 'mo', name: 'Mo', handle: '@mo.plays', kind: 'musician', title: 'Guitarist', avatar: 'm_mo', cover: 'm_mo',
    city: 'Berlin, Mitte', followers: 1500, following: 75, rating: 4.6, eventsCount: 14,
    bio: 'Session guitarist. Blues, rock, funk.', genres: ['Rock', 'Soul'], feePerHour: 140, instruments: ['Electric guitar'], links: { youtube: true },
  },
  {
    id: 'luca', name: 'Luca Sax', handle: '@lucasax', kind: 'musician', title: 'Saxophonist', avatar: 'm_sax', cover: 'm_sax_street',
    city: 'Berlin, Prenzlauer Berg', verified: true, followers: 3300, following: 140, rating: 4.9, eventsCount: 58,
    bio: 'Jazz & house sax for clubs, rooftops and weddings.', genres: ['Jazz', 'House'], feePerHour: 200, instruments: ['Alto sax'], links: { spotify: true, youtube: true },
  },
  {
    id: 'jonah', name: 'Jonah Keys', handle: '@jonahkeys', kind: 'musician', title: 'Pianist', avatar: 'm_pianist', cover: 'm_pianist',
    city: 'Berlin, Charlottenburg', followers: 2200, following: 101, rating: 4.8, eventsCount: 27,
    bio: 'Classical training, neo-soul heart.', genres: ['Jazz', 'Soul'], feePerHour: 190, instruments: ['Piano', 'Rhodes'], links: { spotify: true },
  },
  {
    id: 'nightowls', name: 'Night Owls', handle: '@nightowls.band', kind: 'band', title: 'Indie band · 4 members', avatar: 'band_jam', cover: 'band_stage',
    city: 'Berlin, Neukölln', verified: true, followers: 15800, following: 64, rating: 4.8, eventsCount: 96,
    bio: 'Four friends, one van, too many pedals. New album out this winter.', genres: ['Indie', 'Rock'], feePerHour: 600, links: { spotify: true, youtube: true },
    gallery: ['band_arena', 'ev_red_crowd'],
  },
  {
    id: 'streetjazz', name: 'Spree Street Jazz', handle: '@spreejazz', kind: 'band', title: 'Jazz quartet', avatar: 'band_street', cover: 'band_street',
    city: 'Berlin, Mitte', followers: 4300, following: 80, rating: 4.9, eventsCount: 120,
    bio: 'Swing and bebop for every occasion.', genres: ['Jazz'], feePerHour: 450, links: { youtube: true },
  },
  {
    id: 'voltage', name: 'Voltage', handle: '@voltage', kind: 'band', title: 'Rock band · 5 members', avatar: 'band_arena', cover: 'band_arena',
    city: 'Berlin, Wedding', followers: 7200, following: 51, rating: 4.6, eventsCount: 44,
    bio: 'Stadium energy, basement budget.', genres: ['Rock'], feePerHour: 520, links: { spotify: true },
  },
  {
    id: 'og', name: 'OG Collective', handle: '@ogcollective', kind: 'organizer', title: 'Organizer', avatar: 'ev_lasers', cover: 'ev_lasers',
    city: 'Berlin, Germany', verified: true, followers: 4310, following: 1310, eventsCount: 24,
    bio: 'Techno nights in Berlin bunkers since 2014.', genres: ['Techno'],
  },
  {
    id: 'danceworld', name: 'Dance world', handle: '@danceworld', kind: 'organizer', title: 'Organizer', avatar: 'ev_dance_world', cover: 'ev_dance_world',
    city: 'Berlin, Germany', verified: true, followers: 9100, following: 410, eventsCount: 1532,
    bio: 'Let go, unwind and rave. Every Thursday.', genres: ['Electronic', 'Hip Hop'],
  },
  {
    id: 'darko', name: 'Darko', handle: '@darko.events', kind: 'organizer', title: 'Organizer', avatar: 'cat_focus', cover: 'cat_focus',
    city: 'Hamburg, Germany', followers: 2800, following: 300, eventsCount: 48, bio: 'Costume parties and themed nights.', genres: ['Pop'],
  },
  {
    id: 'musicboard', name: 'Music Board', handle: '@musicboard', kind: 'organizer', title: 'Organizer', avatar: 'ven_neon', cover: 'ven_neon',
    city: 'Berlin, Germany', followers: 5200, following: 520, eventsCount: 70, bio: 'Good vibes only — open airs and festivals.', genres: ['House'],
  },
  { id: 'toni', name: 'Toni', handle: '@toni', kind: 'fan', title: 'Music lover', avatar: 'av_toni', city: 'Berlin', followers: 320, following: 410, bio: 'Always at the front row.', genres: ['Hip Hop'] },
  { id: 'suzi', name: 'Suzi', handle: '@suzi', kind: 'fan', title: 'Music lover', avatar: 'av_suzi', city: 'Berlin', followers: 870, following: 640, bio: 'Festival hopper.', genres: ['Pop', 'Indie'] },
  { id: 'kofi', name: 'Kofi', handle: '@kofi', kind: 'fan', title: 'Music lover', avatar: 'av_kofi', city: 'Berlin', followers: 210, following: 300, bio: '', genres: ['Hip Hop'] },
  { id: 'lina', name: 'Lina', handle: '@lina', kind: 'fan', title: 'Music lover', avatar: 'av_lina', city: 'Berlin', followers: 560, following: 480, bio: '', genres: ['House'] },
  { id: 'maya', name: 'Maya', handle: '@maya', kind: 'fan', title: 'Music lover', avatar: 'av_maya', city: 'Berlin', followers: 1300, following: 900, bio: '', genres: ['Pop'] },
  { id: 'mobolosa', name: 'Mo Bolosa', handle: '@mobolosa', kind: 'organizer', title: 'Organizer', avatar: 'av_mo', cover: 'feed_crowd', city: 'Berlin, Germany', verified: true, followers: 4310, following: 1310, eventsCount: 1532, bio: 'Founder of Bunker Floor nights.', genres: ['Techno'] },
  { id: 'yoba', name: 'Yoba', handle: '@yoba', kind: 'fan', title: 'Music lover', avatar: 'av_yoba', city: 'Berlin', followers: 400, following: 380, bio: '', genres: ['Techno'] },
  { id: 'saradame', name: 'Sara Dame', handle: '@saradame', kind: 'fan', title: 'Music lover', avatar: 'av_sara', city: 'Berlin', followers: 290, following: 330, bio: '', genres: ['Jazz'] },
  { id: 'nina', name: 'Nina', handle: '@nina', kind: 'fan', title: 'Music lover', avatar: 'av_nina', city: 'Berlin', followers: 640, following: 520, bio: '', genres: ['Indie'] },
  { id: 'leyla', name: 'Leyla', handle: '@leyla', kind: 'fan', title: 'Music lover', avatar: 'av_leyla', city: 'Berlin', followers: 980, following: 700, bio: '', genres: ['Soul'] },
  { id: 'marc', name: 'Marc', handle: '@marc', kind: 'fan', title: 'Music lover', avatar: 'av_marc', city: 'Berlin', followers: 150, following: 220, bio: '', genres: ['Rock'] },
  { id: 'ben', name: 'Ben', handle: '@ben', kind: 'fan', title: 'Music lover', avatar: 'av_ben', city: 'Berlin', followers: 330, following: 290, bio: '', genres: ['Techno'] },
  { id: 'clara', name: 'Clara', handle: '@clara', kind: 'fan', title: 'Music lover', avatar: 'av_clara', city: 'Berlin', followers: 720, following: 610, bio: '', genres: ['House'] },
];

export const venues: Venue[] = [
  {
    id: 'moonclub', name: 'Moon Club', area: 'Kreuzberg', city: 'Berlin', postcode: '10997', cover: 'ven_neon', gallery: ['ev_club_dark', 'ev_lasers2', 'feed_club'],
    type: 'Club', pricePerNight: 800, capacity: 350, rooms: 3, stages: 2, parking: true, equipment: 'Full equipment',
    occasions: ['Concert / Musical', 'Club night', 'Birthday', 'Corporate event', 'PR & marketing event', 'Album release'],
    rating: 4.8, followers: 182000, mapPos: { x: 58, y: 62 },
    description: 'Two dark rooms, a Funktion-One main floor and a beach garden for chill-out sets. Located by the Spree in Kreuzberg.',
  },
  {
    id: 'moonvenue', name: 'Moon Venue', area: 'Wannsee', city: 'Berlin', postcode: '14109', cover: 'ven_moon', gallery: ['ven_garden', 'ven_loft'],
    type: 'Garden', pricePerNight: 1200, capacity: 180, rooms: 2, stages: 1, parking: true, equipment: 'Sound & light',
    occasions: ['Wedding', 'Birthday', 'Dinner event / Private dining', 'Gala / Award ceremony', 'Christmas party', 'Seminar & workshop'],
    rating: 4.9, followers: 910000, mapPos: { x: 18, y: 78 },
    description: 'A lakeside pergola with flowers, long tables and space for a live band. Perfect for weddings and summer dinners.',
  },
  {
    id: 'royalhall', name: 'Royal Hall', area: 'Charlottenburg', city: 'Berlin', postcode: '10585', cover: 'ven_hall', gallery: ['ven_garden'],
    type: 'Hall', pricePerNight: 2400, capacity: 600, rooms: 4, stages: 1, parking: true, equipment: 'Full equipment',
    occasions: ['Concert / Musical / Theater', 'Gala / Award ceremony', 'Fair / Exhibition', 'Corporate event', 'General meeting'],
    rating: 4.7, followers: 54000, mapPos: { x: 28, y: 44 },
    description: 'Historic concert hall with a chandelier ballroom and backstage areas.',
  },
  {
    id: 'forest', name: 'Waldbühne Lichtung', area: 'Grunewald', city: 'Berlin', postcode: '14193', cover: 'ven_forest', gallery: ['feed_openair'],
    type: 'Open air', pricePerNight: 950, capacity: 900, rooms: 1, stages: 1, parking: false, equipment: 'Stage only',
    occasions: ['Festival', 'Open air concert', 'Family event'], rating: 4.6, followers: 23000, mapPos: { x: 10, y: 50 },
    description: 'A forest clearing for open-air concerts and day festivals.',
  },
  {
    id: 'loft', name: 'Spree Loft', area: 'Friedrichshain', city: 'Berlin', postcode: '10243', cover: 'ven_loft', gallery: ['feed_rooftop'],
    type: 'Loft', pricePerNight: 650, capacity: 120, rooms: 2, stages: 1, parking: false, equipment: 'Sound system',
    occasions: ['Birthday', 'Listening session', 'Album release', 'Seminar & workshop'], rating: 4.7, followers: 8100, mapPos: { x: 70, y: 52 },
    description: 'Plants, daylight and a warm sound system — ideal for listening sessions and private parties.',
  },
  {
    id: 'arcada', name: 'Arcada Rooftop', area: 'Mitte', city: 'Berlin', postcode: '10117', cover: 'ven_garden', gallery: ['feed_rooftop'],
    type: 'Bar', pricePerNight: 900, capacity: 150, rooms: 1, stages: 1, parking: false, equipment: 'Sound & light',
    occasions: ['Birthday', 'PR & marketing event', 'Corporate event'], rating: 4.5, followers: 12000, mapPos: { x: 50, y: 40 },
    description: 'Rooftop bar with skyline views and a DJ booth.',
  },
];

const T = (id: string, name: string, description: string, price: number, capacity: number, sold: number) => ({ id, name, description, price, capacity, sold });

export const events: EventItem[] = [
  {
    id: 'danceworld', title: 'Dance world', subtitle: 'Vol. 2', cover: 'ev_dance_world', category: 'Parties', genre: 'Hip Hop', venueId: 'moonclub', organizerId: 'danceworld',
    lineup: ['adam', 'miti', 'cats', 'dako', 'soso', 'somadog'], start: '2026-10-22T22:00:00', end: '2026-10-23T06:00:00',
    ticketTypes: [T('early', 'Early bird', 'Sold out', 25, 100, 100), T('ga', 'General admission', 'Entry to both floors', 30, 300, 168), T('vip', 'VIP', 'Fast lane + Beach Garden access', 50, 50, 31)],
    going: 182, rating: 4.8, distanceKm: 1.2, ageLimit: 18, mapPos: { x: 58, y: 60 }, refundPolicy: 'Refunds up to 48 h before doors',
    description: 'Let go, unwind and rave. Every Thursday — the one & only weekly Techno / EDM event in Berlin. BUNKER FLOOR: 100+ dB of madness, this week\'s special: Hardstyle / Hardcore. BEACH GARDEN: chill-out EDM, house, tech-house and deep house.',
  },
  {
    id: 'darkmoon', title: 'Dark Moon club', cover: 'ev_club_dark', category: 'Electronic', genre: 'Techno', venueId: 'moonclub', organizerId: 'og',
    lineup: ['soso', 'kai'], start: '2026-10-17T23:00:00', end: '2026-10-18T08:00:00',
    ticketTypes: [T('ga', 'General admission', 'Entry all night', 20, 350, 290), T('late', 'Late entry', 'After 03:00', 15, 100, 20)],
    going: 340, rating: 4.8, distanceKm: 1.4, ageLimit: 18, mapPos: { x: 61, y: 66 }, refundPolicy: 'No refunds', sponsored: true,
    description: 'Hypnotic techno marathon with Soso and Kai Nord in the dark room.',
  },
  {
    id: 'bunker7', title: 'Bunker Floor Vol. 7', cover: 'ev_lasers2', category: 'Electronic', genre: 'Techno', venueId: 'moonclub', organizerId: 'mobolosa',
    lineup: ['adam', 'soso', 'cats'], start: '2026-11-07T23:00:00', end: '2026-11-08T08:00:00',
    ticketTypes: [T('ga', 'General admission', 'Entry to both floors', 30, 300, 168), T('vip', 'VIP', 'Fast lane + backstage bar', 50, 50, 31), T('late', 'Late entry', 'After 03:00', 20, 100, 15)],
    going: 214, rating: 4.7, distanceKm: 0.8, ageLimit: 18, mapPos: { x: 55, y: 64 }, refundPolicy: 'Refunds up to 48 h before doors',
    description: 'Seventh edition of our bunker series. Strobes, fog and three of Berlin\'s finest.',
  },
  {
    id: 'livesoul', title: 'Live performance', subtitle: 'Sameul — Soul night', cover: 'ev_concert_blue', category: 'Concerts', genre: 'Soul', venueId: 'royalhall', organizerId: 'musicboard',
    lineup: ['sameul', 'jonah'], start: '2026-10-18T21:00:00', end: '2026-10-18T22:30:00',
    ticketTypes: [T('free', 'Free entry', 'Register to get your QR', 0, 400, 260)],
    going: 260, rating: 4.9, distanceKm: 1.0, mapPos: { x: 30, y: 46 }, refundPolicy: 'Free event',
    description: 'An intimate soul evening with Sameul and Jonah Keys on piano.',
  },
  {
    id: 'youngtalent', title: 'Young Talent Show', cover: 'ev_live_stage', category: 'Concerts', genre: 'Pop', venueId: 'loft', organizerId: 'musicboard',
    lineup: ['dana', 'mo', 'sara'], start: '2026-10-24T19:00:00', end: '2026-10-24T23:00:00',
    ticketTypes: [T('ga', 'General admission', 'Standing', 12, 120, 70)],
    going: 70, rating: 4.6, distanceKm: 3.1, mapPos: { x: 72, y: 50 }, refundPolicy: 'Refunds up to 7 days before',
    description: 'Berlin\'s newest voices on one stage. Vote for your favourite act.',
  },
  {
    id: 'sosparty', title: 'Sos Party', cover: 'ev_party', category: 'Parties', genre: 'Pop', venueId: 'arcada', organizerId: 'darko',
    lineup: ['cats'], start: '2026-10-25T22:00:00', end: '2026-10-26T04:00:00',
    ticketTypes: [T('ga', 'General admission', 'Entry', 15, 150, 90)],
    going: 95, rating: 4.4, distanceKm: 2.0, mapPos: { x: 49, y: 38 }, refundPolicy: 'No refunds',
    description: 'Costume party on the rooftop with 4 Cats on the decks.',
  },
  {
    id: 'halloween', title: 'Focus — Halloween', cover: 'cat_focus', category: 'Parties', genre: 'Electronic', venueId: 'moonclub', organizerId: 'darko',
    lineup: ['somadog', 'miti'], start: '2026-10-31T22:00:00', end: '2026-11-01T06:00:00',
    ticketTypes: [T('ga', 'General admission', 'Costume required', 18, 300, 210), T('vip', 'VIP', 'Fast lane + welcome drink', 35, 40, 12)],
    going: 222, rating: 4.7, distanceKm: 1.2, ageLimit: 18, mapPos: { x: 60, y: 61 }, refundPolicy: 'Refunds up to 48 h before doors',
    description: 'Dress up, get weird. Dark wave and hard techno all night.',
  },
  {
    id: 'acoustic', title: 'Acoustic Sundays', cover: 'cat_acoustic', category: 'Acoustic', genre: 'Acoustic', venueId: 'moonvenue', organizerId: 'musicboard',
    lineup: ['sara', 'luca'], start: '2026-10-19T16:00:00', end: '2026-10-19T20:00:00',
    ticketTypes: [T('ga', 'Garden ticket', 'Includes a drink', 22, 150, 80)],
    going: 80, rating: 4.9, distanceKm: 6.5, mapPos: { x: 20, y: 76 }, refundPolicy: 'Refunds up to 48 h before',
    description: 'Lakeside afternoon with fairy lights, acoustic guitars and saxophone.',
  },
  {
    id: 'familyfest', title: 'Family Fest', cover: 'cat_family', category: 'Family', genre: 'Pop', venueId: 'forest', organizerId: 'musicboard',
    lineup: ['streetjazz', 'sara'], start: '2026-11-01T12:00:00', end: '2026-11-01T18:00:00',
    ticketTypes: [T('adult', 'Adult', '13+', 10, 500, 120), T('kid', 'Kids', 'Under 13', 0, 300, 140)],
    going: 260, rating: 4.8, distanceKm: 8.0, mapPos: { x: 12, y: 52 }, refundPolicy: 'Refunds up to 24 h before',
    description: 'Music, face painting and picnic blankets in the forest.',
  },
  {
    id: 'summerfest', title: 'City Festival', cover: 'ev_festival', category: 'Festivals', genre: 'Electronic', venueId: 'forest', organizerId: 'og',
    lineup: ['soso', 'nightowls', 'voltage', 'adam'], start: '2026-11-14T14:00:00', end: '2026-11-15T02:00:00',
    ticketTypes: [T('day', 'Day ticket', 'Full day access', 49, 900, 610), T('vip', 'VIP', 'Lounge + front-stage area', 89, 80, 44)],
    going: 1200, rating: 4.8, distanceKm: 8.0, mapPos: { x: 14, y: 48 }, refundPolicy: 'Refunds up to 7 days before', sponsored: true,
    description: 'The last open air of the season — two stages, food trucks and a fireworks finale.',
  },
  {
    id: 'nightowlstour', title: 'Night Owls — Album tour', cover: 'band_arena', category: 'Concerts', genre: 'Indie', venueId: 'royalhall', organizerId: 'musicboard',
    lineup: ['nightowls'], start: '2026-11-21T20:00:00', end: '2026-11-21T23:00:00',
    ticketTypes: [T('ga', 'Standing', 'Floor', 35, 500, 420), T('seat', 'Balcony seat', 'Seated', 45, 100, 60)],
    going: 480, rating: 4.9, distanceKm: 4.2, mapPos: { x: 27, y: 42 }, refundPolicy: 'Refunds up to 7 days before',
    description: 'Night Owls play their new album live for the first time.',
  },
  {
    id: 'listening', title: 'Vinyl Listening Session', cover: 'feed_decks', category: 'Listening', genre: 'House', venueId: 'loft', organizerId: 'og',
    lineup: ['kai'], start: '2026-10-29T20:00:00', end: '2026-10-29T23:30:00',
    ticketTypes: [T('ga', 'Seat', 'Limited cushions', 8, 60, 41)],
    going: 41, rating: 4.7, distanceKm: 3.1, mapPos: { x: 71, y: 54 }, refundPolicy: 'No refunds',
    description: 'Kai Nord plays rare microhouse records on a hi-fi system. Phones away.',
  },
];

export const posts: Post[] = [
  {
    id: 'p1', authorId: 'adam', kind: 'photo', media: ['feed_club'], likes: 50210, shares: 340, time: '2h', location: 'Moon Club, Berlin', eventId: 'danceworld',
    caption: 'Thank you for supporting us with this wonderful night. We will have a concert for the next album soon.', track: 'Adam — Spree Lights (Original Mix)', feed: ['forYou', 'following', 'nearby'],
    comments: [
      { id: 'c1', authorId: 'suzi', text: 'Best set of the year!!', time: '1h', likes: 24 },
      { id: 'c2', authorId: 'toni', text: 'When is the next one?', time: '54m', likes: 8 },
      { id: 'c3', authorId: 'adam', text: '@toni 22 Oct at Moon Club!', time: '40m', likes: 31 },
    ],
  },
  {
    id: 'p2', authorId: 'nightowls', kind: 'carousel', media: ['band_stage', 'band_arena', 'ev_red_crowd', 'band_rehearsal'], likes: 18400, shares: 210, time: '4h', location: 'Royal Hall', eventId: 'nightowlstour',
    caption: 'Rehearsal week for the album tour. Swipe for the chaos →', feed: ['forYou', 'following'],
    comments: [{ id: 'c4', authorId: 'nina', text: 'Already got my balcony seat!', time: '3h', likes: 12 }],
  },
  {
    id: 'p3', authorId: 'danceworld', kind: 'photo', media: ['ev_dance_world'], likes: 9100, shares: 520, time: '6h', location: 'Moon Club, Kreuzberg', eventId: 'danceworld',
    caption: 'Going to a dance concert this Thursday? Early birds are gone, general tickets still available.', feed: ['forYou', 'nearby'],
    comments: [{ id: 'c5', authorId: 'kofi', text: 'Squad is ready', time: '5h', likes: 4 }],
  },
  {
    id: 'p4', authorId: 'sara', kind: 'video', media: ['m_acoustic'], likes: 7300, shares: 96, time: '8h', location: 'Görlitzer Park', track: 'Sara — Kreuzberg Mornings (acoustic)',
    caption: 'New song, first take. Should I play it on Sunday at Acoustic Sundays?', feed: ['forYou', 'following', 'nearby'],
    comments: [{ id: 'c6', authorId: 'leyla', text: 'YES please', time: '7h', likes: 15 }],
  },
  {
    id: 'p5', authorId: 'moonvenue', kind: 'photo', media: ['ven_moon'], likes: 4200, shares: 64, time: '12h', location: 'Moon Venue, Wannsee',
    caption: 'Our pergola is ready for winter weddings — heaters, lights and room for a live band. Booking now for December.', feed: ['forYou'],
    comments: [],
  },
  {
    id: 'p6', authorId: 'soso', kind: 'carousel', media: ['ev_lasers2', 'ev_purple_arena', 'feed_crowd'], likes: 22800, shares: 410, time: '1d', location: 'Amsterdam',
    caption: 'Amsterdam you were unreal. Back in Berlin for Dark Moon on Saturday.', eventId: 'darkmoon', feed: ['forYou', 'following'],
    comments: [{ id: 'c7', authorId: 'ben', text: 'See you Saturday', time: '20h', likes: 3 }],
  },
  {
    id: 'p7', authorId: 'luca', kind: 'photo', media: ['feed_rooftop'], likes: 3100, shares: 22, time: '1d', location: 'Arcada Rooftop',
    caption: 'Sax + house on the rooftop. Booking open for winter parties.', feed: ['forYou', 'nearby'], comments: [],
  },
  {
    id: 'p8', authorId: 'musicboard', kind: 'carousel', media: ['feed_openair', 'feed_friends', 'feed_picnic'], likes: 5600, shares: 130, time: '2d', location: 'Grunewald', eventId: 'familyfest',
    caption: 'Family Fest is back on 1 November. Kids go free!', feed: ['forYou', 'nearby'], comments: [],
  },
];

// Every venue also has an account so it can post, chat and be followed.
for (const v of venues) {
  if (!profiles.some((p) => p.id === v.id)) {
    profiles.push({
      id: v.id, name: v.name, handle: `@${v.id}`, kind: 'organizer', title: 'Venue', avatar: v.cover, cover: v.cover,
      city: `${v.city}, ${v.area}`, verified: v.followers > 20000, followers: v.followers, following: 47, bio: v.description, genres: [],
    });
  }
}

export const stories: Story[] = [
  { id: 's1', authorId: 'adam', frames: ['story_neon', 'story_collage', 'ev_drummer', 'band_arena'], live: false },
  { id: 's2', authorId: 'sameul', frames: ['ev_concert_blue', 'ev_stage_gold'], live: true },
  { id: 's3', authorId: 'sara', frames: ['m_acoustic', 'feed_picnic'] },
  { id: 's4', authorId: 'dana', frames: ['m_dana', 'ev_live_stage'] },
  { id: 's5', authorId: 'mo', frames: ['m_mo'] },
  { id: 's6', authorId: 'soso', frames: ['ev_lasers', 'ev_purple_arena'] },
  { id: 's7', authorId: 'luca', frames: ['m_sax_street'] },
];

export const conversations: Conversation[] = [
  {
    id: 'adam', withId: 'adam', unread: 2,
    messages: [
      { id: 'm1', from: 'them', type: 'image', image: 'm_guitar_bw', time: '23:52' },
      { id: 'm2', from: 'them', type: 'text', text: 'This is my photo to publish on your event if you want', time: '23:53' },
      { id: 'm3', from: 'me', type: 'text', text: 'Absolutely. When?', time: '11:00' },
      { id: 'm4', from: 'me', type: 'voice', duration: '0:34', time: '11:03' },
      { id: 'm5', from: 'them', type: 'text', text: 'Yay!', time: '11:05', liked: true },
      { id: 'm6', from: 'me', type: 'text', text: "I'm so excited!", time: '11:09', liked: true },
    ],
  },
  {
    id: 'toni', withId: 'toni', unread: 1,
    messages: [{ id: 'm1', from: 'them', type: 'text', text: 'Are you coming to Dance world on Thursday?', time: 'Just now' }],
  },
  { id: 'sara', withId: 'sara', unread: 0, messages: [{ id: 'm1', from: 'them', type: 'text', text: 'Thanks for the booking request! Let me check my calendar.', time: '15 min' }] },
  { id: 'moonvenue', withId: 'moonvenue', unread: 0, messages: [{ id: 'm1', from: 'them', type: 'text', text: 'Your venue tour is confirmed for Saturday 11:00.', time: '1 h' }] },
  { id: 'og', withId: 'og', unread: 0, messages: [{ id: 'm1', from: 'me', type: 'text', text: 'Can I get on the guest list for Bunker 7?', time: 'yesterday' }] },
  { id: 'suzi', withId: 'suzi', unread: 0, messages: [{ id: 'm1', from: 'them', type: 'text', text: 'Saw your story — that venue looks amazing', time: '2 d' }] },
];

export const notifications: AppNotification[] = [
  { id: 'n1', type: 'follow', actorId: 'suzi', text: 'started following you', time: '8m', section: 'Today' },
  { id: 'n2', type: 'booking', actorId: 'sara', text: 'accepted your booking request — pay to confirm', time: '1h', section: 'Today', href: '/booking/b2' },
  { id: 'n3', type: 'ticket', actorId: 'danceworld', text: 'Dance world is coming up. Your ticket is ready.', time: '3h', section: 'Today', thumb: 'ev_dance_world', href: '/tickets' },
  { id: 'n4', type: 'comment', actorId: 'suzi', text: 'commented on your post: "So good!"', time: '2d', section: 'This week', thumb: 'feed_friends' },
  { id: 'n5', type: 'reshare', actorId: 'toni', text: 'reshared your post', time: '3d', section: 'This week', thumb: 'feed_friends' },
  { id: 'n6', type: 'event', actorId: 'soso', text: 'is playing near you on Saturday — Dark Moon club', time: '4d', section: 'This week', thumb: 'ev_club_dark', href: '/event/darkmoon' },
  { id: 'n7', type: 'like', actorId: 'nightowls', text: 'liked your comment', time: '1w', section: 'Earlier' },
];

export const initialBookings: Booking[] = [
  {
    id: 'b1', type: 'musician', targetId: 'adam', eventTitle: 'Shakira birthday', date: '2026-12-24', startTime: '20:00', endTime: '00:00', hours: 4,
    location: 'Downtown 1341, Berlin', guests: 80, equipment: 'CDJ Pioneer 3000 provided', extras: 'None', note: 'House-to-techno journey please!', amount: 1200, status: 'pending', createdAt: '2026-10-12',
  },
  {
    id: 'b2', type: 'musician', targetId: 'sara', eventTitle: 'Rooftop warm-up', date: '2026-11-06', startTime: '19:00', endTime: '22:00', hours: 3,
    location: 'Arcada Rooftop, Mitte', guests: 60, equipment: 'Venue PA', extras: 'None', note: '', amount: 540, status: 'accepted', createdAt: '2026-10-09',
  },
  {
    id: 'b3', type: 'venue', targetId: 'moonvenue', eventTitle: 'Winter wedding', date: '2026-12-12', startTime: '15:00', endTime: '02:00', hours: 11,
    location: 'Moon Venue, Wannsee', guests: 120, equipment: 'Sound & light', extras: 'Heaters', note: '', amount: 1200, status: 'confirmed', createdAt: '2026-09-30',
  },
  {
    id: 'b4', type: 'venue', targetId: 'loft', eventTitle: 'Listening party', date: '2026-09-20', startTime: '20:00', endTime: '23:00', hours: 3,
    location: 'Spree Loft, Friedrichshain', guests: 40, equipment: 'Sound system', extras: 'None', note: '', amount: 650, status: 'declined', createdAt: '2026-09-01',
  },  {
    id: 'b5', type: 'musician', targetId: 'adam', eventTitle: 'Office summer party', date: '2026-09-26', startTime: '19:00', endTime: '23:00', hours: 4,
    location: 'Spree Loft, Friedrichshain', guests: 90, equipment: 'Provided by venue / host', extras: 'None', note: '', amount: 1200, status: 'completed', createdAt: '2026-09-02',
  },
];

export const incomingRequests: IncomingRequest[] = [
  {
    id: 'r1', requester: 'Anderson Pack', initials: 'AP', requesterRole: 'Fan · private event', title: 'Shakira birthday', date: 'Thu 24 Dec 2026', time: '20:00 – 00:00',
    hours: 4, location: 'Downtown 1341, Berlin', guests: 80, equipment: 'CDJ Pioneer 3000 provided',
    message: "Big fan of your Kreuzberg sets — we'd love a house-to-techno journey for the birthday.", offer: 1200, expires: '47 h', status: 'new',
  },
  {
    id: 'r2', requester: 'OG Collective', initials: 'OG', requesterRole: 'Organizer · verified', title: 'Bunker Floor Vol. 7', date: 'Sat 7 Nov 2026', time: '01:00 – 04:00',
    hours: 3, location: 'Moon Club, Kreuzberg', guests: 300, equipment: 'Full club setup', message: 'Closing slot on the bunker floor. Same rider as last time.', offer: 900, expires: '20 h', status: 'new',
  },
  {
    id: 'r3', requester: 'Lena K.', initials: 'LK', requesterRole: 'Fan · private event', title: 'Rooftop warm-up', date: 'Fri 13 Nov 2026', time: '19:00 – 22:00',
    hours: 3, location: 'Arcada Rooftop, Mitte', guests: 60, equipment: 'Venue PA', message: 'Chill house for a company after-work.', offer: 750, expires: '3 days', status: 'new',
  },
  {
    id: 'r4', requester: 'Moon Club', initials: 'MC', requesterRole: 'Venue owner', title: 'NYE Main Floor', date: 'Thu 31 Dec 2026', time: '23:00 – 03:00',
    hours: 4, location: 'Moon Club, Kreuzberg', guests: 350, equipment: 'Full club setup', message: '', offer: 2400, expires: '—', status: 'accepted',
  },
  {
    id: 'r5', requester: 'Dance world', initials: 'DW', requesterRole: 'Organizer', title: 'Dance world Vol. 1', date: 'Sun 27 Sep 2026', time: '23:00 – 02:00',
    hours: 3, location: 'Moon Club, Kreuzberg', guests: 300, equipment: 'Full club setup', message: '', offer: 1000, expires: '—', status: 'past',
  },
];

export const attendees: Attendee[] = [
  { id: 'a1', name: 'Lena Krause', avatar: 'av_lina', ticketType: 'VIP', code: 'A7K2', checkedIn: true },
  { id: 'a2', name: 'Jonas Weber', avatar: 'av_ben', ticketType: 'General admission', code: 'B19F', checkedIn: true },
  { id: 'a3', name: 'Mira Okafor', avatar: 'av_maya', ticketType: 'General admission', code: 'C44D', checkedIn: false },
  { id: 'a4', name: 'Tom Richter', avatar: 'av_tom', ticketType: 'Late entry', code: 'D02X', checkedIn: false },
  { id: 'a5', name: 'Nina Park', avatar: 'av_nina', ticketType: 'General admission', code: 'E88Q', checkedIn: false },
  { id: 'a6', name: 'Clara Vogel', avatar: 'av_clara', ticketType: 'VIP', code: 'F31M', checkedIn: false },
];

export const eventCategories: { key: string; label: string; image: import('./images').ImgKey; category?: string }[] = [
  { key: 'Concerts', label: 'Live Performances', image: 'ev_concert_blue', category: 'Concerts' },
  { key: 'Electronic', label: 'Electronic', image: 'ev_lasers', category: 'Electronic' },
  { key: 'Parties', label: 'Focus & Parties', image: 'cat_focus', category: 'Parties' },
  { key: 'Festivals', label: 'Party Mix', image: 'cat_party', category: 'Festivals' },
  { key: 'Family', label: 'Family', image: 'cat_family', category: 'Family' },
  { key: 'Acoustic', label: 'Acoustic', image: 'cat_acoustic', category: 'Acoustic' },
];

export const artistCategories = [
  { key: 'musician', label: 'Musician', image: 'ev_live_stage' as const },
  { key: 'band', label: 'Band', image: 'ev_silhouette' as const },
  { key: 'dj', label: 'DJ', image: 'cat_dj' as const },
];

export const OCCASIONS = ['Birthday', 'Wedding', 'Corporate event', 'Club night', 'Private party', 'Festival', 'Dinner', 'Other'];

// Lookups
export const profileById = (id: string) => profiles.find((p) => p.id === id);
export const venueById = (id: string) => venues.find((v) => v.id === id);

// ---------- Added for v1.1 screens ----------

export interface ReviewItem {
  id: string;
  authorId: string;
  targetId: string;
  rating: number;
  text: string;
  date: string;
  context: string;
}

export const reviews: ReviewItem[] = [
  { id: 'rv1', authorId: 'maya', targetId: 'adam', rating: 5, text: 'Absolutely made our wedding. Read the room perfectly and kept the floor full until 3am.', date: '2026-09-28', context: 'Wedding · Moon Venue' },
  { id: 'rv2', authorId: 'ben', targetId: 'adam', rating: 5, text: 'On time, professional, great sound. Booking again for NYE.', date: '2026-09-12', context: 'Club night · Moon Club' },
  { id: 'rv3', authorId: 'clara', targetId: 'adam', rating: 4, text: 'Amazing set — chat replies were a bit slow before the gig.', date: '2026-08-30', context: 'Birthday · Arcada Rooftop' },
  { id: 'rv4', authorId: 'nina', targetId: 'adam', rating: 5, text: 'The warm-up into peak time was perfect. Everyone asked who the DJ was.', date: '2026-08-02', context: 'Corporate event · Spree Loft' },
  { id: 'rv5', authorId: 'toni', targetId: 'adam', rating: 4, text: 'Great music, arrived 20 minutes late but stayed longer to make up for it.', date: '2026-07-19', context: 'Private party · Kreuzberg' },
  { id: 'rv6', authorId: 'leyla', targetId: 'sara', rating: 5, text: 'Her voice gave everyone goosebumps. Brought her own PA, zero hassle.', date: '2026-09-20', context: 'Garden party · Wannsee' },
  { id: 'rv7', authorId: 'marc', targetId: 'sara', rating: 5, text: 'Perfect acoustic set for our café opening.', date: '2026-08-11', context: 'Opening · Friedrichshain' },
  { id: 'rv8', authorId: 'suzi', targetId: 'moonclub', rating: 5, text: 'Best sound system in Kreuzberg. Staff were super helpful with our album release.', date: '2026-09-05', context: 'Album release' },
  { id: 'rv9', authorId: 'kofi', targetId: 'moonclub', rating: 4, text: 'Great venue, the beach garden is a vibe. Queue management could be better.', date: '2026-08-21', context: 'Club night' },
  { id: 'rv10', authorId: 'lina', targetId: 'moonvenue', rating: 5, text: 'Dream wedding location. The pergola at sunset is unreal.', date: '2026-09-14', context: 'Wedding' },
];

export const reviewsFor = (targetId: string) => reviews.filter((r) => r.targetId === targetId);

/** Options for ratingFor / reviewCountFor so lists can match detail pages exactly. */
export interface RatingOptions {
  /** Extra star ratings to include, e.g. your own reviews of completed bookings. */
  extra?: number[];
  /** Review authors to leave out, e.g. blocked accounts. */
  exclude?: string[];
}

const ratingsOf = (id: string, opts?: RatingOptions) => [
  ...(opts?.extra ?? []),
  ...reviewsFor(id)
    .filter((r) => !opts?.exclude?.includes(r.authorId))
    .map((r) => r.rating),
];

/**
 * Rating shown for an artist or venue: the average of its reviews rounded to one decimal,
 * else the stored venue/profile rating, else 0. Lists, detail pages and /ratings all use this.
 */
export function ratingFor(id: string, opts?: RatingOptions): number {
  const all = ratingsOf(id, opts);
  if (all.length) return Math.round((all.reduce((n, r) => n + r, 0) / all.length) * 10) / 10;
  return venueById(id)?.rating ?? profileById(id)?.rating ?? 0;
}

/** Number of reviews behind ratingFor (0 when it falls back to the stored rating). */
export function reviewCountFor(id: string, opts?: RatingOptions): number {
  return ratingsOf(id, opts).length;
}

export interface Transaction {
  id: string;
  title: string;
  sub: string;
  amount: number;
  date: string;
  status: 'escrow' | 'available' | 'paid out' | 'fee';
}

/** Available rows (tx2 + tx3 = €2.040) add up to the store's starting balance; older income was paid out. */
export const transactions: Transaction[] = [
  { id: 'tx1', title: 'NYE Main Floor', sub: 'Moon Club · booking', amount: 2160, date: '2026-10-12', status: 'escrow' },
  { id: 'tx2', title: 'Dance world Vol. 1', sub: 'Dance world · booking', amount: 900, date: '2026-09-28', status: 'available' },
  { id: 'tx3', title: 'Sunset boat party', sub: 'Private · booking', amount: 1140, date: '2026-09-20', status: 'available' },
  { id: 'tx4', title: 'Payout to IBAN ••0391', sub: 'Bank transfer', amount: -1080, date: '2026-10-01', status: 'paid out' },
  { id: 'tx5', title: 'Pro plan', sub: 'Monthly subscription', amount: -9.99, date: '2026-10-01', status: 'fee' },
  { id: 'tx6', title: 'Bunker Floor Vol. 6', sub: 'OG Collective · booking', amount: 810, date: '2026-09-06', status: 'paid out' },
];

/** Last 14 days, oldest first. */
export const analytics = {
  profileViews: [62, 70, 58, 81, 94, 120, 143, 88, 76, 91, 102, 133, 158, 171],
  followersGained: [3, 5, 2, 6, 9, 14, 18, 4, 6, 7, 8, 12, 19, 22],
  bookingRequests: [0, 1, 0, 0, 1, 2, 1, 0, 1, 0, 1, 2, 2, 1],
  ticketSales: [4, 6, 9, 5, 12, 31, 44, 8, 10, 14, 17, 36, 52, 61],
  topSources: [
    { label: 'Home feed', share: 46 },
    { label: 'Search', share: 22 },
    { label: 'Event lineups', share: 18 },
    { label: 'Map', share: 9 },
    { label: 'Shared links', share: 5 },
  ],
};

export const liveComments = [
  { id: 'lc1', authorId: 'suzi', text: 'this voice!!!' },
  { id: 'lc2', authorId: 'toni', text: 'play the new one!' },
  { id: 'lc3', authorId: 'leyla', text: 'Royal Hall on Sunday, who is coming?' },
  { id: 'lc4', authorId: 'kofi', text: 'greetings from Neukölln' },
  { id: 'lc5', authorId: 'maya', text: 'goosebumps' },
  { id: 'lc6', authorId: 'nina', text: 'can I book you for my wedding?' },
];

export const eventDiscussion: Record<string, { id: string; authorId: string; text: string; time: string; likes: number }[]> = {
  danceworld: [
    { id: 'ed1', authorId: 'kofi', text: 'Is there a cloakroom?', time: '3h', likes: 4 },
    { id: 'ed2', authorId: 'danceworld', text: '@kofi yes, €2 per item, open all night.', time: '2h', likes: 12 },
    { id: 'ed3', authorId: 'suzi', text: 'Who else is going for the Beach Garden at sunrise?', time: '1h', likes: 21 },
    { id: 'ed4', authorId: 'toni', text: 'Last time the bunker floor was insane. Bring earplugs.', time: '40m', likes: 9 },
  ],
  bunker7: [
    { id: 'ed5', authorId: 'ben', text: 'Set times out yet?', time: '5h', likes: 3 },
    { id: 'ed6', authorId: 'mobolosa', text: 'Adam 23–01, Soso 01–04, 4 Cats closing. See you there!', time: '4h', likes: 28 },
  ],
};

/** Followers of a profile, derived from the sample accounts. */
export const followersOf = (id: string) => profiles.filter((p) => p.id !== id && (p.kind === 'fan' || p.id.length % 2 === id.length % 2)).slice(0, 14);
export const followingOf = (id: string) => profiles.filter((p) => p.id !== id && p.kind !== 'fan').slice(0, 12);
