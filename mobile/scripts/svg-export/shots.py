"""Build shots.json: every Domtak screen/state to export, in A-to-Z order by section."""
import json
import sys

S = []


def add(section, name, path, title, **kw):
    n = sum(1 for s in S if s['section'] == section) + 1
    S.append({'section': section, 'name': f'{section}-{n:02d}-{name}', 'path': path, 'title': title, **kw})


def click(name=None, role='button', exact=False, text=None, wait=700):
    a = {'do': 'click', 'role': role if not text else None, 'name': name, 'exact': exact, 'wait': wait}
    if text:
        a['text'] = text
    return a


def fill(placeholder=None, value='', name=None):
    return {'do': 'fill', 'placeholder': placeholder, 'name': name, 'value': value}


# 01 Onboarding & auth (logged out)
add('01', 'onboarding-1', '/onboarding', 'Onboarding — Discover', fresh=True, noFull=True)
add('01', 'onboarding-2', '/onboarding', 'Onboarding — Book & follow', fresh=True, noFull=True, actions=[click('Next slide', wait=1500)])
add('01', 'onboarding-3', '/onboarding', 'Onboarding — Create & find events', fresh=True, noFull=True, actions=[click('Next slide', wait=1500), click('Next slide', wait=1500)])
add('01', 'login', '/login', 'Login', fresh=True)
add('01', 'register', '/register', 'Register', fresh=True)
add('01', 'register-errors', '/register', 'Register — validation', fresh=True, actions=[click('Next', exact=True)])
add('01', 'verify', '/verify', 'Verify account (OTP)', fresh=True, noFull=True)
add('01', 'choose-role', '/role', 'Choose account role', fresh=True)
add('01', 'profile-setup', '/profile-setup', 'Profile setup', fresh=True)
add('01', 'forgot-password', '/forgot-password', 'Forgot password', fresh=True, noFull=True)
add('01', 'forgot-check-inbox', '/forgot-password', 'Forgot password — check inbox', fresh=True, noFull=True, actions=[click('Send reset link')])
add('01', 'forgot-new-password', '/forgot-password', 'Forgot password — new password', fresh=True, noFull=True, actions=[click('Send reset link'), click('I’ve opened the link')])

# 02 Home & social
add('02', 'home-for-you', '/', 'Home feed — For You')
add('02', 'home-following', '/', 'Home feed — Following', actions=[click('Following', role='tab')])
add('02', 'home-nearby', '/', 'Home feed — Nearby', actions=[click('Nearby', role='tab')])
add('02', 'post-menu', '/', 'Post — more menu', noFull=True, actions=[click('More options')])
add('02', 'story', '/story/s1', 'Story viewer', noFull=True)
add('02', 'live', '/live/s2', 'Live stream', noFull=True)
add('02', 'post-comments', '/post/p1', 'Post & comments')
add('02', 'new-post', '/new-post', 'New post')
add('02', 'new-story', '/new-post?story=1', 'New story')
add('02', 'create-menu', '/create-menu', 'Create (+) sheet — fan', noFull=True)
add('02', 'side-menu', '/menu', 'Side menu', noFull=True)
add('02', 'notifications', '/notifications', 'Notifications')
add('02', 'search', '/search', 'Search')
add('02', 'search-results', '/search', 'Search — results', actions=[fill('Events, musicians, venues, organizers', 'moon')])

# 03 Events & tickets
add('03', 'events-tab', '/events', 'Events tab')
add('03', 'events-list', '/events/all', 'All events')
add('03', 'events-electronic', '/events/Electronic', 'Events — Electronic')
add('03', 'filters', '/filters', 'Filters')
add('03', 'map', '/map', 'Map', noFull=True)
add('03', 'map-venues', '/map', 'Map — venues', noFull=True, actions=[click('Venues')])
add('03', 'event-detail', '/event/bunker7', 'Event detail')
add('03', 'event-discussion', '/event-comments/danceworld', 'Event discussion')
add('03', 'choose-ticket', '/tickets/bunker7', 'Choose ticket')
add('03', 'checkout', '/tickets/bunker7', 'Review summary & payment', actions=[click('Continue')])
add('03', 'checkout-verify', '/tickets/bunker7', 'Payment — bank verification', noFull=True, actions=[click('Continue'), click('Pay €31,50')])
add('03', 'checkout-failed', '/tickets/bunker7', 'Payment failed', noFull=True, actions=[click('Continue'), click('Pay €31,50'), fill('6-digit code', '0000'), click('Confirm payment', wait=1600)])
add('03', 'ticket-success', '/tickets/bunker7', 'Ticket booked', noFull=True, actions=[click('Continue'), click('Pay €31,50'), fill('6-digit code', '2904'), click('Confirm payment', wait=1600)])
add('03', 'e-ticket', '/ticket/t_seed1', 'E-ticket with QR', noFull=True)
add('03', 'your-tickets', '/my-bookings?tab=tickets', 'Your bookings — tickets')
add('03', 'leave-review', '/review/danceworld', 'Leave a review')

# 04 Artists & venues
add('04', 'artists-tab', '/artists', 'Artists tab')
add('04', 'artists-dj', '/artists/dj', 'All DJs')
add('04', 'artists-musician', '/artists/musician', 'All musicians')
add('04', 'artists-band', '/artists/band', 'All bands')
add('04', 'artist-profile', '/artist/adam', 'Artist portfolio')
add('04', 'artist-reviews', '/ratings/adam', 'Artist reviews')
add('04', 'followers', '/connections/adam?tab=followers', 'Followers')
add('04', 'following', '/connections/adam?tab=following', 'Following')
add('04', 'venues', '/venues', 'All venues')
add('04', 'venue-detail', '/venue/moonvenue', 'Venue detail')
add('04', 'venue-reviews', '/ratings/moonclub', 'Venue reviews')
add('04', 'organizer-profile', '/profile/mobolosa', 'Organizer profile')

# 05 Booking (escrow)
add('05', 'booking-request', '/booking/new?type=musician&id=adam', 'Booking request')
add('05', 'booking-review', '/booking/new?type=musician&id=adam', 'Booking — review summary', actions=[fill('e.g. Shakira birthday', 'Garden birthday'), fill('Address or venue', 'Görlitzer Park, Kreuzberg'), click('Review request')])
add('05', 'venue-booking', '/booking/new?type=venue&id=moonvenue', 'Venue booking request')
add('05', 'your-bookings-musicians', '/my-bookings?tab=musician', 'Your bookings — musicians')
add('05', 'your-bookings-venues', '/my-bookings?tab=venue', 'Your bookings — venues')
add('05', 'status-pending', '/booking/b1', 'Booking status — pending')
add('05', 'status-accepted', '/booking/b2', 'Booking status — accepted, pay')
add('05', 'status-confirmed', '/booking/b3', 'Booking status — confirmed')
add('05', 'status-completed', '/booking/b5', 'Booking completed — review')
add('05', 'booking-declined', '/booking/b4', 'Booking declined')

# 06 Calendar & messages
add('06', 'calendar-month', '/calendar', 'Calendar — month')
add('06', 'calendar-week', '/calendar', 'Calendar — week', actions=[click('Week', role='tab')])
add('06', 'calendar-overview', '/calendar', 'Your event overview', actions=[click('Overview')])
add('06', 'inbox', '/inbox', 'Inbox')
add('06', 'booking-chats', '/inbox', 'Inbox — booking chats', actions=[click('Booking chats', role='tab')])
add('06', 'chat', '/chat/adam', 'Chat')
add('06', 'chat-venue', '/chat/moonvenue', 'Chat — venue')

# 07 Account
add('07', 'profile', '/profile/me', 'Your profile')
add('07', 'edit-profile', '/profile-setup?mode=edit', 'Edit profile')
add('07', 'wishlist', '/wishlist', 'Wishlist')
add('07', 'wishlist-empty', '/wishlist', 'Wishlist — venues', actions=[click('Venues (1)', role='tab')])
add('07', 'settings', '/settings', 'Settings')
add('07', 'subscription', '/subscription', 'Pro plan')
add('07', 'payment-methods', '/payment-methods', 'Payment methods')
add('07', 'add-card', '/payment-methods?add=1', 'Add a card')
add('07', 'blocked-users', '/blocked', 'Blocked users')
add('07', 'help', '/help', 'Help & FAQ')
add('07', 'about', '/help?section=about', 'About Domtak')
add('07', 'pro-verification', '/pro-verification', 'Pro verification')

# 08 Pro tools
add('08', 'workspace-musician', '/pro/workspace', 'Pro workspace — musician', userRole='musician')
add('08', 'availability', '/pro/availability', 'Availability & pricing', userRole='musician')
add('08', 'earnings', '/pro/earnings', 'Earnings', userRole='musician')
add('08', 'insights', '/pro/earnings?tab=insights', 'Insights', userRole='musician')
add('08', 'requests', '/pro/requests', 'Booking requests', userRole='musician')
add('08', 'request-detail', '/pro/request/r1', 'Booking request detail', userRole='musician')
add('08', 'request-decline', '/pro/request/r1?decline=1', 'Decline request', userRole='musician', noFull=True)
add('08', 'request-counter', '/pro/request/r1', 'Counter offer', userRole='musician', noFull=True, actions=[click('Counter')])
add('08', 'create-menu-musician', '/create-menu', 'Create (+) sheet — musician', userRole='musician', noFull=True)
add('08', 'workspace-organizer', '/pro/workspace', 'Pro workspace — organizer', userRole='organizer')
add('08', 'my-events', '/pro/events', 'My events', userRole='organizer')
add('08', 'promote-event', '/pro/promote/bunker7', 'Promote event', userRole='organizer')
add('08', 'attendees', '/pro/attendees/bunker7', 'Sales & attendees', userRole='organizer')
add('08', 'scanner', '/pro/scan?eventId=bunker7', 'QR door scanner', userRole='organizer', noFull=True)
add('08', 'scanner-valid', '/pro/scan?eventId=bunker7', 'Scanner — valid ticket', userRole='organizer', noFull=True, actions=[click('Try demo code')])
add('08', 'create-event-details', '/create-event', 'Create event — details', userRole='organizer')
add('08', 'create-event-location', '/create-event', 'Create event — location', userRole='organizer', actions=[fill('e.g. Bunker Floor Vol. 8', 'Rooftop Sunset Session'), click('Next', exact=True)])
add('08', 'create-event-tickets', '/create-event', 'Create event — tickets', userRole='organizer', actions=[fill('e.g. Bunker Floor Vol. 8', 'Rooftop Sunset Session'), click('Next', exact=True), click('Next', exact=True)])
add('08', 'create-event-preview', '/create-event', 'Create event — preview', userRole='organizer', actions=[fill('e.g. Bunker Floor Vol. 8', 'Rooftop Sunset Session'), click('Next', exact=True), click('Next', exact=True), click('Next', exact=True)])
add('08', 'invite-guests', '/invite', 'Invite guests', userRole='organizer')
add('08', 'workspace-venue', '/pro/workspace', 'Pro workspace — venue owner', userRole='venue')
add('08', 'venue-listing', '/pro/venue-listing', 'Edit venue listing', userRole='venue')

json.dump(S, open(sys.argv[1], 'w'), indent=1)
print(len(S), 'shots')
