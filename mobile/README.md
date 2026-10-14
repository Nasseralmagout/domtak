# Domtak — Android app

Music-first social platform for Berlin: an Instagram-style feed for musicians, venues, organizers and fans, plus event discovery, ticketing with QR codes, and musician/venue booking with escrow payments.

Built with **Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript**. Every screen from the V1 user flow and information architecture is implemented and navigable, running on realistic sample data (photos come from the Domtak UI design file).

## Run it

```bash
cd mobile
npm install
npx expo start          # press "a" for an Android emulator, or scan the QR code with Expo Go
```

All native modules used (camera, image, fonts, gradients, SVG/QR) are included in Expo Go, so no custom dev build is needed to try it.

**Build an installable APK** (cloud build, no Android Studio needed):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview     # .apk for testers
npx eas-cli@latest build --platform android --profile production  # .aab for Google Play
```

Checks: `npm run typecheck`, `npm run lint`, `npm run export:android`.

## Demo tips

- Sign in with any email and a password of 6+ characters. During sign-up any 6-digit code verifies the account.
- **Settings → Demo: account role** switches between Fan, Musician/DJ, Venue owner and Organizer. The "+" sheet and the Pro workspace adapt to the role.
- On a booking's status screen, **"Provider accepts / declines"** simulates the other side so you can walk the whole escrow lifecycle.
- Checkout has a **"Preview: payment failed state"** link. Any 4–6 digits approve the bank (3-D Secure) step.
- The door scanner uses the real camera on a phone. On web, type a code instead (try `A7K2`, `C44D`, or the code under your own e-ticket).
- **Settings → Reset demo** restores the sample data. App state is saved on the device with AsyncStorage.

## Screens (A → Z)

| Area | Screens |
|---|---|
| Onboarding | Splash, 3 onboarding slides, Login, Register, Verify (email/SMS code), Choose role, Profile setup, Forgot password |
| Home / Social | Instagram-style feed with stories (incl. LIVE), For You / Following / Nearby, photo, carousel and video posts, double-tap like, save, share, music track tags, **event ticket strip and "Book this artist" on posts**, "Musicians' next events" and "Upcoming events" carousels, sponsored event card · Story viewer with reply · Post + comments · New post / story |
| Discover | Events tab (featured, categories, coming up) · Event list with category chips and search · Filters (date, time, price slider, category, music style) · Map with pins and quick filters · Unified search (events, artists, venues, organizers) |
| Events & tickets | Event detail (lineup, organizer, venue, going, share, add to calendar) · Choose ticket type and quantity · Review summary and payment (saved cards, Google Pay, PayPal, SEPA, bank verification, failure state) · Success · E-ticket with real QR code · Leave a review |
| Artists & venues | Artist categories (Musician, Band, DJ) · Artist list (genre chips, sort by popularity or fee) · Artist portfolio (bio, styles, fee, SoundCloud/Spotify/YouTube, gigs, media, reviews) · Venues list · Venue detail (gallery, capacity, rooms, stages, occasions) |
| Booking (escrow) | Booking request form (date, time, duration, guests, equipment) · Review and send · Status tracker: Requested → Pending → Accepted → Paid in escrow → Confirmed → Completed · Declined / Expired / Cancelled-refund / Disputed screens |
| Calendar | Month / Week / Day calendar with your plans · Event overview grouped by month |
| Messages | Inbox (online artists, messages, booking requests) · Chat with text, photo and voice messages |
| Account | Profile (posts, saved, events, shortcuts) · Public user/organizer profile · Side menu · Notifications · Your bookings (tickets, musicians, venues) · Wishlist with empty states · Payment methods · Settings · Help & FAQ · Promo code · About |
| Pro tools | Pro workspace (earnings, escrow, requests, gigs, profile views) · Incoming booking requests · Accept / counter / decline with reason · Create event wizard (details, map location, ticket types, preview) → Event created → Invite guests · Sales & attendees · QR door scanner (valid / already used / invalid) · Pro verification |

## Project structure

```
mobile/
  app.json, eas.json        app + build config (package de.domtak.app)
  assets/                   icon, splash, and photos taken from the design file
  src/app/                  Expo Router screens: every file is a route
    (tabs)/                 Home · Artists · + · Events · Calendar
  src/components/           design-system primitives, cards, post card, tab bar, layout
  src/data/                 types, sample data, image registry
  src/store/                zustand state (persisted) + discovery filters
  src/lib/                  formatting and booking lifecycle helpers
  src/theme/                colours (Domtak purple #3B1F8B), type scale, radii, shadows
```

## What's mocked, and the next steps for production

The app is complete on the client side. To go live, the sample data and store actions need a backend:

1. **API and auth:** replace `src/data/mock.ts` and the zustand actions with real endpoints (users and roles, posts, events, venues, bookings, tickets, messages). Use real email/SMS OTP.
2. **Payments and escrow:** Stripe Connect (or similar). Hold funds on acceptance, release them 24 h after the event, and handle refunds and disputes.
3. **Maps:** swap the static Berlin map for `react-native-maps` (needs a Google Maps API key).
4. **Media:** real photo/video upload with `expo-image-picker` and storage.
5. **Realtime and push:** chat over websockets; booking and ticket notifications with `expo-notifications`.
6. **Admin:** a web console to review Pro applications and disputes.
