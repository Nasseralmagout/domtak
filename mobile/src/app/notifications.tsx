import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FollowButton } from '../components/cards';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, EmptyState, Icon, type IconName, Photo, Row, Segmented, T, TimeLeft, type Tone } from '../components/ui';
import type { ImgKey } from '../data/images';
import { notifications, profileById, venueById } from '../data/mock';
import type { AppNotification, Booking, EventItem, FriendRequest, GuestInvite, IncomingRequest, SupportCase, Ticket } from '../data/types';
import { WORKSPACE_LABEL } from '../lib/access';
import { bookingRef, providerOf, quoteState, reminderDue, timeLeft } from '../lib/booking';
import { addHours, ago, dateTime, euro, nowIso, parse, sameDay, shortDate, TODAY } from '../lib/format';
import { lastMessage, lastUpdate } from '../lib/support';
import { isApproved, type User, useAllEvents, useApp, useInvitedEvents } from '../store/useApp';
import { colors, shadow } from '../theme';

type Section = AppNotification['section'];
type Filter = 'all' | 'essential' | 'social';

/** A notice derived from a store record. It always opens the record that needs action (blueprint section 13). */
interface Notice {
  id: string;
  /** Essential transaction and account notices, or optional social updates. */
  essential: boolean;
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
  at: string;
  href: string;
  action?: boolean;
  deadline?: string;
  image?: ImgKey;
  label?: string;
}

const TYPE_ICON: Record<AppNotification['type'], IconName> = {
  follow: 'account-plus-outline',
  comment: 'comment-outline',
  reshare: 'share-variant-outline',
  like: 'heart-outline',
  booking: 'calendar-clock',
  ticket: 'ticket-confirmation-outline',
  event: 'party-popper',
};

const TONE_BG: Record<Tone, string> = { success: colors.success, warning: colors.warningStrong, danger: colors.danger, brand: colors.brand, neutral: colors.label };

function profileHref(id: string) {
  if (venueById(id)) return `/venue/${id}`;
  const p = profileById(id);
  return p && (p.kind === 'dj' || p.kind === 'musician' || p.kind === 'band') ? `/artist/${id}` : `/profile/${id}`;
}

/** Ticket reminders are about the event with the actor's id; keep their countdown in step with today's date. */
function ticketText(n: AppNotification, event: EventItem | undefined, hasTicket: boolean) {
  if (!event) return n.text;
  const days = Math.round((parse(event.start).getTime() - TODAY.getTime()) / 86_400_000);
  const when = days <= 0 ? 'starts today' : days === 1 ? 'starts tomorrow' : `starts in ${days} days`;
  return `${event.title} ${when}. ${hasTicket ? 'Your ticket is ready.' : 'Get your ticket before it sells out.'}`;
}

/** Where tapping a social notification should take you. */
function targetFor(n: AppNotification, tickets: Ticket[]) {
  if (n.type === 'ticket') {
    // "Your ticket is ready" opens the matching e-ticket, or the ticket shop when you have none.
    const t = tickets.find((x) => x.eventId === n.actorId && x.status === 'valid');
    return t ? `/ticket/${t.id}` : `/tickets/${n.actorId}`;
  }
  if (n.href && n.href !== '/tickets') return n.href;
  // Activity on your own posts and comments lives on your profile.
  if (n.type === 'comment' || n.type === 'reshare' || n.type === 'like') return '/profile/me';
  return profileHref(n.actorId);
}

function sectionOf(at: string): Section {
  const d = parse(at);
  if (sameDay(d, TODAY) || d.getTime() > TODAY.getTime()) return 'Today';
  return TODAY.getTime() - d.getTime() < 7 * 86_400_000 ? 'This week' : 'Earlier';
}

const lastAt = (b: Booking) => b.timeline?.[b.timeline.length - 1]?.at ?? b.createdAt;

/** What happened to the money on a closed booking, in plain English. */
function moneyLine(b: Booking) {
  const ref = b.paymentRef ? ` (reference ${b.paymentRef})` : '';
  switch (b.payment) {
    case 'released':
      return `Your payment authorization was released${ref}. You weren’t charged.`;
    case 'release_pending':
      return 'Release of your payment authorization has started. It completes once the payment provider confirms it.';
    case 'refunded':
      return `Your refund is complete${ref}.`;
    case 'refund_pending':
      return 'A refund is on its way. It completes once the payment provider confirms it.';
    default:
      return 'No payment was taken.';
  }
}

function bookingNotices(b: Booking, reviewed: boolean, cases: SupportCase[]): Notice[] {
  const p = providerOf(b);
  const base = { essential: true, image: p.image, label: p.name, href: `/booking/${b.id}`, at: lastAt(b) };
  const out: Notice[] = [];
  const done = b.payment === 'refunded' ? 'Refund completed' : b.payment === 'released' ? 'Payment released' : undefined;

  if (b.status === 'payment_failed' || b.payment === 'failed') {
    out.push({ ...base, id: `bk-${b.id}`, icon: 'credit-card-off-outline', tone: 'danger', title: `Payment failed · ${p.name}`, body: `${b.eventTitle}: nothing was charged. Retry safely on the same booking or choose another method.`, action: true });
  } else if (b.pricing === 'quote' && b.quote && b.status === 'requested') {
    const q = quoteState(b.quote);
    if (q === 'sent' || q === 'revised') {
      out.push({ ...base, id: `bk-${b.id}`, icon: 'file-document-outline', tone: 'warning', title: `${p.name} sent a ${q === 'revised' ? 'revised ' : ''}quote`, body: `${euro(b.quote.total)} for ${b.eventTitle}${b.quote.validUntil ? `, valid until ${shortDate(b.quote.validUntil)}` : ''}. Accept it to continue to payment.`, action: true });
    } else if (q === 'expired') {
      out.push({ ...base, id: `bk-${b.id}`, icon: 'file-document-remove-outline', tone: 'neutral', title: `Quote expired · ${p.name}`, body: 'The offer ended without a booking. Ask for a new quote if you still need them.' });
    } else if (q === 'requested') {
      out.push({ ...base, id: `bk-${b.id}`, icon: 'file-document-outline', tone: 'brand', title: `Quote requested from ${p.name}`, body: `${b.eventTitle}: they review your details and send an itemised price. Nothing is charged until you accept.` });
    }
  } else if (b.status === 'pending') {
    const reminded = reminderDue(b);
    out.push({
      ...base,
      id: `bk-${b.id}`,
      icon: reminded ? 'bell-ring-outline' : 'calendar-clock',
      tone: 'brand',
      title: reminded ? `${p.name} hasn’t answered yet` : `Request sent to ${p.name}`,
      body: reminded
        ? `We reminded them after 12 hours. ${timeLeft(b.deadline) || 'Waiting'} to accept or decline; your payment stays pending their decision.`
        : `${b.eventTitle}: they have${b.deadline ? ` until ${dateTime(b.deadline)}` : ' 24 hours'} to accept or decline. Payment pending their decision.`,
      deadline: b.deadline,
    });
  } else if (b.status === 'accepted') {
    out.push({ ...base, id: `bk-${b.id}`, icon: 'credit-card-clock-outline', tone: 'warning', title: `${p.name} accepted`, body: `${b.eventTitle}: finalize the payment. The booking is confirmed once the payment is verified.`, action: true });
  } else if (b.status === 'confirmed' || b.status === 'paid') {
    out.push({ ...base, id: `bk-${b.id}`, icon: 'calendar-check', tone: 'success', title: `Booking confirmed · ${p.name}`, body: `${b.eventTitle} on ${shortDate(b.date)}. Payment verified and agreed terms saved.` });
  } else if (b.status === 'declined') {
    out.push({ ...base, id: `bk-${b.id}`, icon: done ? 'cash-check' : 'close-circle-outline', tone: done ? 'neutral' : 'warning', title: done ? `${done} · ${p.name} declined` : `${p.name} declined`, body: `${b.eventTitle}. ${moneyLine(b)}` });
  } else if (b.status === 'expired') {
    out.push({ ...base, id: `bk-${b.id}`, icon: done ? 'cash-check' : 'timer-sand-complete', tone: done ? 'neutral' : 'warning', title: done ? `${done} · request expired` : `Request expired · ${p.name}`, body: `No answer within 24 hours. ${moneyLine(b)}` });
  } else if (b.status === 'cancelled') {
    out.push({ ...base, id: `bk-${b.id}`, icon: done ? 'cash-check' : 'calendar-remove-outline', tone: done ? 'neutral' : 'warning', title: done ? `${done} · ${p.name}` : `Booking cancelled · ${p.name}`, body: `${b.eventTitle}. ${moneyLine(b)}` });
  } else if (b.status === 'change_requested') {
    out.push({ ...base, id: `bk-${b.id}`, icon: 'swap-horizontal', tone: 'warning', title: `Change requested · ${p.name}`, body: `${b.change?.note ?? b.eventTitle}. The agreed terms stay until both sides accept.`, action: true });
  } else if (b.status === 'disputed') {
    const c = cases.find((x) => x.linked?.kind === 'booking' && x.linked.id === b.id);
    out.push({ ...base, id: `bk-${b.id}`, icon: 'scale-balance', tone: 'warning', title: `Problem reported · ${bookingRef(b)}`, body: 'Support is reviewing the case. The payment state stays visible meanwhile.', href: c ? `/support/${c.id}` : base.href });
  } else if (b.status === 'completed' && !reviewed) {
    out.push({ ...base, id: `bk-${b.id}`, icon: 'star-outline', tone: 'brand', title: `How was ${p.name}?`, body: `${b.eventTitle} is completed. Tell others whether you’d book them again.`, href: `/review/${b.id}` });
  }

  if (b.pendingCancellation && (b.status === 'pending' || b.status === 'accepted' || b.status === 'confirmed' || b.status === 'requested')) {
    out.push({ ...base, id: `bk-${b.id}-cancel`, icon: 'calendar-alert', tone: 'warning', title: `Event cancelled · ${p.name} booking still open`, body: 'Cancel this booking or agree new terms with the provider. It isn’t cancelled automatically.', at: b.pendingCancellation.at, action: true });
  }
  return out;
}

function requestNotices(r: IncomingRequest): Notice[] {
  const href = `/pro/request/${r.id}`;
  const base = { essential: true, href, label: r.requester };
  if (r.status === 'new') {
    const reminded = reminderDue(r);
    const quote = r.pricing === 'quote';
    return [
      {
        ...base,
        id: `rq-${r.id}`,
        icon: reminded ? 'bell-ring-outline' : 'inbox-arrow-down',
        tone: 'warning',
        title: reminded ? `Reminder: ${r.requester} is waiting` : `${quote ? 'Quote request' : 'New booking request'} · ${r.requester}`,
        body: reminded
          ? `${r.title}: 12 hours without a response. Accept or decline before the deadline.`
          : `${r.title}, ${r.date} · ${quote ? 'send an itemised quote' : `${euro(r.offer)} offered`}. Respond within 24 hours.`,
        at: reminded && r.reminderAt ? r.reminderAt : r.deadline ? addHours(r.deadline, -24) : nowIso(),
        deadline: r.deadline,
        action: true,
      },
    ];
  }
  if (r.status === 'expired') {
    const released = r.payment === 'released';
    return [{ ...base, id: `rq-${r.id}`, icon: 'timer-sand-complete', tone: 'neutral', title: `Request expired · ${r.requester}`, body: `${r.title}: no response within 24 hours. ${released ? 'The customer’s payment was released.' : 'The customer’s payment is being released.'}`, at: r.deadline ?? nowIso() }];
  }
  if (r.status === 'accepted' && r.payment === 'capture_pending') {
    return [{ ...base, id: `rq-${r.id}`, icon: 'credit-card-clock-outline', tone: 'brand', title: `Waiting for payment · ${r.requester}`, body: `${r.title}: you accepted. It is confirmed once the customer’s payment is verified.`, at: r.deadline ?? nowIso() }];
  }
  return [];
}

function inviteNotices(g: GuestInvite, event: EventItem | undefined, tickets: Ticket[]): Notice[] {
  if (!event) return [];
  const from = profileById(g.fromId);
  const base = { essential: true, image: from?.avatar, label: from?.name, href: `/invitation/${g.id}`, at: g.sentAt ?? nowIso() };
  if (g.status === 'invited') {
    return [{ ...base, id: `gi-${g.id}`, icon: 'email-open-outline', tone: 'brand', title: `${from?.name ?? 'A friend'} invited you`, body: `${event.title} · ${shortDate(event.start)} · ${g.contribution ? `${euro(g.contribution)} cost sharing` : 'free'}. Answer to get your ticket.`, action: true }];
  }
  if (g.status !== 'accepted') return [];
  const ticket = g.ticketId ? tickets.find((t) => t.id === g.ticketId) : undefined;
  if (ticket) {
    return [{ ...base, id: `gi-${g.id}`, icon: 'ticket-confirmation-outline', tone: 'success', title: `Ticket issued · ${event.title}`, body: 'Your QR ticket is in your wallet. Show it at the door.', href: `/ticket/${ticket.id}`, at: ticket.purchasedAt }];
  }
  if (g.contribution && g.payment === 'failed') {
    return [{ ...base, id: `gi-${g.id}`, icon: 'credit-card-off-outline', tone: 'danger', title: 'Contribution payment failed', body: `${event.title}: nothing was charged and no ticket was issued. Retry from the invitation.`, action: true }];
  }
  if (g.contribution && g.payment !== 'paid') {
    return [{ ...base, id: `gi-${g.id}`, icon: 'cash', tone: 'warning', title: `Pay your ${euro(g.contribution)} contribution`, body: `${event.title}: your ticket is issued once the payment succeeds.`, action: true }];
  }
  return [];
}

function applicationNotices(user: User): Notice[] {
  const app = user.application;
  if (!app) return [];
  const label = WORKSPACE_LABEL[app.role];
  const base = { id: 'app', essential: true, href: '/application' };
  switch (app.status) {
    case 'pending':
      return [{ ...base, icon: 'clock-outline', tone: 'brand', title: 'Application submitted', body: `Your ${label.toLowerCase()} application is in review. Your member account keeps working meanwhile.`, at: app.submittedAt }];
    case 'info':
      return [{ ...base, icon: 'file-document-edit-outline', tone: 'warning', title: 'More information needed', body: app.missing?.length ? `Add: ${app.missing.join(', ')}.` : (app.reason ?? 'Open your application to see what is missing.'), at: app.decidedAt ?? app.submittedAt, action: true }];
    case 'approved':
      return [{ ...base, icon: 'check-decagram', tone: 'success', title: `You’re approved as ${label.toLowerCase()}`, body: user.role === app.role ? 'Your professional workspace is active.' : 'Switch to your professional workspace to start.', at: app.decidedAt ?? app.submittedAt, action: user.role !== app.role }];
    case 'rejected':
      return [{ ...base, icon: 'close-octagon-outline', tone: 'danger', title: 'Application not approved', body: app.reason ? `${app.reason} You can update it and apply again.` : 'See the reason and how to apply again.', at: app.decidedAt ?? app.submittedAt }];
  }
}

function caseNotice(c: SupportCase): Notice {
  const last = lastMessage(c);
  const base = { id: `sc-${c.id}`, essential: true, href: `/support/${c.id}`, at: lastUpdate(c) };
  if (c.status === 'resolved') return { ...base, icon: 'check-circle-outline', tone: 'success', title: `Case resolved · ${c.ref}`, body: last?.from === 'support' ? last.text : c.topic };
  if (c.status === 'waiting') return { ...base, icon: 'lifebuoy', tone: 'warning', title: `Support replied · ${c.ref}`, body: last?.text ?? c.topic, action: true };
  return { ...base, icon: 'lifebuoy', tone: 'brand', title: `Case ${c.ref} · with support`, body: c.topic };
}

function friendNotice(r: FriendRequest): Notice {
  const p = profileById(r.fromId);
  return { id: `fr-${r.id}`, essential: false, icon: 'account-plus-outline', tone: 'brand', title: `${p?.name ?? 'Someone'} sent you a friend request`, body: 'Accept or decline on their profile.', href: `/profile/${r.fromId}`, at: r.at ?? nowIso(), image: p?.avatar, label: p?.name, action: true };
}

function NoticeRow({ n }: { n: Notice }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n.title}. ${n.body}`}
      onPress={() => router.push(n.href as never)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1, ...shadow(1) })}
    >
      <View>
        {n.image ? (
          <Avatar src={n.image} size={46} label={n.label} />
        ) : (
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n.icon} size={22} color={colors.brand} />
          </View>
        )}
        {n.image ? (
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: TONE_BG[n.tone], borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n.icon} size={12} color={colors.white} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold" numberOfLines={2}>{n.title}</T>
        <T v="small" numberOfLines={3}>{n.body}</T>
        <Row gap={8} style={{ marginTop: 2, flexWrap: 'wrap' }}>
          {n.deadline && timeLeft(n.deadline) !== 'Expired' ? <TimeLeft deadline={n.deadline} /> : null}
          <T v="small" style={{ fontSize: 12 }}>{ago(n.at)}</T>
        </Row>
      </View>
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

export default function Notifications() {
  const markRead = useApp((s) => s.markNotificationsRead);
  const user = useApp((s) => s.user);
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const requests = useApp((s) => s.requests);
  const reviews = useApp((s) => s.reviews);
  const cases = useApp((s) => s.supportCases);
  const friendRequests = useApp((s) => s.friendRequests);
  const blocked = useApp((s) => s.blocked);
  const events = useAllEvents();
  const invited = useInvitedEvents();
  const [filter, setFilter] = useState<Filter>('all');
  useFocusEffect(useCallback(() => markRead(), [markRead]));

  const notices = useMemo(() => {
    const out: Notice[] = [];
    bookings.forEach((b) => out.push(...bookingNotices(b, !!reviews[b.id], cases)));
    // Provider notices go to accounts approved for that kind of work.
    const musician = isApproved(user, 'musician');
    const venue = isApproved(user, 'venue');
    requests.forEach((r) => {
      if (r.kind === 'venue' ? venue : musician) out.push(...requestNotices(r));
    });
    invited.forEach(({ invite, event }) => {
      if (!blocked.includes(invite.fromId)) out.push(...inviteNotices(invite, event, tickets));
    });
    tickets.forEach((t) => {
      const e = events.find((x) => x.id === t.eventId) ?? invited.find((x) => x.event.id === t.eventId)?.event;
      if (!e) return;
      if (t.status === 'refunded') out.push({ id: `tk-${t.id}`, essential: true, icon: 'cash-refund', tone: 'neutral', title: `Ticket refunded · ${e.title}`, body: `Ticket ${t.code} is refunded and no longer valid at the door.`, href: `/ticket/${t.id}`, at: t.purchasedAt, image: e.cover });
      else if (t.status === 'valid' && e.state === 'cancelled') out.push({ id: `tk-${t.id}`, essential: true, icon: 'calendar-remove-outline', tone: 'warning', title: `Event cancelled · ${e.title}`, body: e.cancelReason ? `${e.cancelReason}. Your ticket shows the refund route.` : 'The host cancelled the event. Your ticket shows the refund route.', href: `/ticket/${t.id}`, at: e.cancelledAt ?? nowIso(), image: e.cover, action: true });
    });
    out.push(...applicationNotices(user));
    cases.forEach((c) => out.push(caseNotice(c)));
    friendRequests.forEach((r) => {
      if (r.status === 'pending' && r.fromId !== 'me' && !blocked.includes(r.fromId)) out.push(friendNotice(r));
    });
    return out.sort((a, b) => parse(b.at).getTime() - parse(a.at).getTime());
  }, [bookings, reviews, cases, user, requests, invited, blocked, tickets, events, friendRequests]);

  // Booking notices come from the booking records above, so the sample "booking" items would be duplicates.
  const social = useMemo(() => notifications.filter((n) => n.type !== 'booking' && !blocked.includes(n.actorId)), [blocked]);

  const shown = notices.filter((n) => filter === 'all' || (filter === 'essential' ? n.essential : !n.essential));
  const actions = shown.filter((n) => n.action);
  const rest = shown.filter((n) => !n.action);
  const showSocial = filter !== 'essential';
  const sections: Section[] = ['Today', 'This week', 'Earlier'];
  const empty = !shown.length && !(showSocial && social.length);

  return (
    <Screen header={<ScreenHeader title="Notifications" onBack={() => goBack('/(tabs)')} />}>
      <Segmented
        options={[
          { key: 'all', label: 'All' },
          { key: 'essential', label: 'Essential' },
          { key: 'social', label: 'Social' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {actions.length ? (
        <View style={{ gap: 10 }}>
          <T v="smallBold" color={colors.warning} accessibilityRole="header">Needs your action · {actions.length}</T>
          {actions.map((n) => <NoticeRow key={n.id} n={n} />)}
        </View>
      ) : null}

      {sections.map((sec) => {
        const derived = rest.filter((n) => sectionOf(n.at) === sec);
        const list = showSocial ? social.filter((n) => n.section === sec) : [];
        if (!derived.length && !list.length) return null;
        return (
          <View key={sec} style={{ gap: 10 }}>
            <T v="smallBold" color={colors.muted} accessibilityRole="header">{sec}</T>
            {derived.map((n) => <NoticeRow key={n.id} n={n} />)}
            {list.map((n) => {
              const actor = profileById(n.actorId);
              const ticketEvent = n.type === 'ticket' ? events.find((e) => e.id === n.actorId) : undefined;
              // Ticket reminders read as a sentence on their own, e.g. "Dance world starts in 8 days."
              const text = n.type === 'ticket' ? ticketText(n, ticketEvent, tickets.some((t) => t.eventId === n.actorId && t.status === 'valid')) : n.text;
              const name = n.type === 'ticket' && ticketEvent ? '' : actor?.name;
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${name ? `${name} ` : ''}${text}, ${n.time} ago`}
                  onPress={() => router.push(targetFor(n, tickets) as never)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1, ...shadow(1) })}
                >
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${actor?.name ?? 'profile'}`} onPress={() => router.push(profileHref(n.actorId) as never)}>
                    <Avatar src={actor?.avatar} size={46} label={actor?.name} />
                    <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={TYPE_ICON[n.type]} size={12} color={colors.white} />
                    </View>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <T v="body" numberOfLines={3}>{name ? <T v="bodyBold">{name} </T> : null}{text}</T>
                    <T v="small" style={{ fontSize: 12 }}>{n.time}</T>
                  </View>
                  {n.type === 'follow' && actor ? <FollowButton id={actor.id} /> : n.thumb ? <Photo src={n.thumb} style={{ width: 52, height: 52 }} radius={10} /> : <Icon name="chevron-right" size={20} color={colors.subtle} />}
                </Pressable>
              );
            })}
          </View>
        );
      })}

      {empty ? (
        <EmptyState
          icon="bell-outline"
          title="No notifications"
          body={filter === 'social' ? 'Follows, comments and friend requests appear here.' : 'Booking updates, payments, tickets, invitations and support replies appear here.'}
        />
      ) : actions.length ? null : (
        <Row justify="center" gap={6}>
          <Icon name="check-circle-outline" size={16} color={colors.success} />
          <T v="small">Nothing needs your action</T>
        </Row>
      )}
    </Screen>
  );
}
