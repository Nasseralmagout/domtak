import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Avatar, EmptyState, Field, Icon, Pill, Row, Segmented, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profileById, profiles, venueById } from '../data/mock';
import type { BookingStatus, Conversation } from '../data/types';
import { bookingLabel, bookingTone, timeLeft } from '../lib/booking';
import { plural, shortDate } from '../lib/format';
import { useFriendProfiles, useFriendRequests } from '../store/social';
import { canAcceptBookings, overlayVenue, useApp, type VenueListing } from '../store/useApp';
import { colors, shadow } from '../theme';

const ONLINE = ['adam', 'sameul', 'sara', 'dana', 'mo', 'soso'];

/** Booking statuses that unlock a chat with the provider. */
const CHAT_STATUSES: BookingStatus[] = ['accepted', 'paid', 'confirmed', 'completed'];

const rowStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) };

interface Party { name: string; avatar?: ImgKey; verified?: boolean; isVenue: boolean }

/**
 * A chat partner can be a person (musician, organizer, fan) or a venue (shown with its cover and the owner's listing edits).
 * Every venue also has a stand-in account in `profiles`, so venues are resolved first.
 */
function party(id: string, listing: VenueListing): Party | undefined {
  const v = overlayVenue(venueById(id), listing);
  if (v) return { name: v.name, avatar: v.cover, verified: !!profileById(id)?.verified, isVenue: true };
  const p = profileById(id);
  if (p) return { name: p.name, avatar: p.avatar, verified: p.verified, isVenue: false };
  return undefined;
}

function PartyName({ who, venueIcon = true }: { who?: Party; venueIcon?: boolean }) {
  return (
    <Row gap={4} style={{ flex: 1 }}>
      <T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{who?.name}</T>
      {venueIcon && who?.isVenue ? <Icon name="storefront-outline" size={15} color={colors.brandMid} /> : null}
    </Row>
  );
}

function lastMessage(c?: Conversation) {
  const last = c?.messages[c.messages.length - 1];
  const preview = last ? (last.type === 'text' ? (last.from === 'me' ? `You: ${last.text}` : last.text) : last.type === 'voice' ? 'Voice message' : 'Photo') : 'Say hi';
  return { last, preview };
}

function UnreadDot() {
  return <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: colors.white }} />;
}

export default function Inbox() {
  const conversations = useApp((s) => s.conversations);
  const allRequests = useApp((s) => s.requests);
  const bookings = useApp((s) => s.bookings);
  const blocked = useApp((s) => s.blocked);
  const user = useApp((s) => s.user);
  const venueListing = useApp((s) => s.venueListing);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [tab, setTab] = useState<'messages' | 'requests'>('messages');
  const [q, setQ] = useState('');
  const friends = useFriendProfiles();
  const { incoming: friendRequests } = useFriendRequests();
  // Booking requests are answered in an approved musician or venue workspace; everyone else sees booking chats.
  const providerInbox = canAcceptBookings(user);

  const query = q.trim().toLowerCase();
  const matches = (...texts: (string | undefined)[]) => !query || texts.some((t) => t?.toLowerCase().includes(query));
  const isBlocked = (id: string) => blocked.includes(id);
  const openChat = (withId: string) => router.push(`/chat/${ensureConversation(withId)}`);

  const online = profiles.filter((p) => ONLINE.includes(p.id) && !isBlocked(p.id));
  const who = (id: string) => party(id, venueListing);
  const list = conversations.filter((c) => {
    const p = who(c.withId);
    return !!p && !isBlocked(c.withId) && matches(p.name);
  });

  // Fans: one chat per booking the provider has accepted (or later).
  const bookingChatsAll = bookings
    .filter((b) => CHAT_STATUSES.includes(b.status) && !isBlocked(b.targetId) && !!who(b.targetId))
    .sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed'));
  const bookingChats = bookingChatsAll.filter((b) => matches(who(b.targetId)?.name, b.eventTitle));

  // Requests carry the requester's name only; match it to a profile to honour blocks.
  const newRequests = allRequests.filter((r) => {
    const requester = profiles.find((p) => p.name === r.requester);
    return r.status === 'new' && !(requester && isBlocked(requester.id));
  });
  const requests = newRequests.filter((r) => matches(r.requester, r.title));

  const noResults = <EmptyState icon="magnify-close" title="No matches" body={`Nothing in your inbox matches “${q.trim()}”.`} action="Clear search" onAction={() => setQ('')} />;

  const requestNames = friendRequests.map((r) => profileById(r.fromId)?.name).filter(Boolean) as string[];
  const friendSub = friendRequests.length
    ? requestNames.length === 1
      ? `${requestNames[0]} wants to be friends`
      : `${requestNames[0]} and ${plural(requestNames.length - 1, 'other')} want to be friends`
    : `${plural(friends.length, 'friend')} · find people and manage requests`;

  return (
    <Screen header={<ScreenHeader title="Inbox" />} contentStyle={{ gap: 14 }}>
      <Field placeholder="Search here" accessibilityLabel="Search inbox" value={q} onChangeText={setQ} icon="magnify" returnKeyType="search" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={friendRequests.length ? `Friend requests, ${friendRequests.length} waiting. ${friendSub}` : `Friends. ${friendSub}`}
        onPress={() => router.push(friendRequests.length ? '/friends?tab=requests' : '/friends')}
        style={rowStyle}
      >
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={friendRequests.length ? 'account-multiple-plus-outline' : 'account-multiple-outline'} size={26} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyBold">{friendRequests.length ? 'Friend requests' : 'Friends'}</T>
          <T v="small" numberOfLines={1}>{friendSub}</T>
        </View>
        {friendRequests.length ? (
          <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.warningStrong, alignItems: 'center', justifyContent: 'center' }}>
            <T v="smallBold" color={colors.white}>{friendRequests.length}</T>
          </View>
        ) : null}
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Pressable>
      {online.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {online.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Message ${p.name}, online now`} onPress={() => openChat(p.id)} style={{ alignItems: 'center', gap: 6, width: 72 }}>
              <View>
                <Avatar src={p.avatar} size={68} />
                <View style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.white }} />
              </View>
              <T v="small" color={colors.ink} numberOfLines={1}>{p.name}</T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Segmented
        dark
        options={[
          { key: 'messages', label: 'Messages' },
          { key: 'requests', label: providerInbox ? `Requests (${newRequests.length})` : `Booking chats (${bookingChatsAll.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'messages' ? (
        list.length ? (
          list.map((c) => {
            const p = who(c.withId);
            const { last, preview } = lastMessage(c);
            return (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Chat with ${p?.name}${p?.isVenue ? ' (venue)' : ''}${c.unread ? `, ${c.unread} unread` : ''}`} onPress={() => router.push(`/chat/${c.id}`)} style={rowStyle}>
                <View>
                  <Avatar src={p?.avatar} size={52} label={p?.name} verified={p?.verified} />
                  {c.unread ? <UnreadDot /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Row justify="space-between" gap={8}>
                    <PartyName who={p} />
                    <T v="small" style={{ fontSize: 12 }}>{last?.time}</T>
                  </Row>
                  <T v={c.unread ? 'bodyBold' : 'body'} numberOfLines={1} color={c.unread ? colors.ink : colors.muted}>{preview}</T>
                </View>
              </Pressable>
            );
          })
        ) : query ? (
          noResults
        ) : (
          <EmptyState icon="email-outline" title="No messages yet" body="Say hi to an artist, venue or friend. Your conversations show up here." action="Find people" onAction={() => router.push('/search')} />
        )
      ) : !providerInbox ? (
        bookingChats.length ? (
          bookingChats.map((b) => {
            const p = who(b.targetId);
            const conv = conversations.find((c) => c.withId === b.targetId);
            const { last, preview } = lastMessage(conv);
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${p?.name} about ${b.eventTitle}, ${bookingLabel(b)}`}
                onPress={() => openChat(b.targetId)}
                style={rowStyle}
              >
                <View>
                  <Avatar src={p?.avatar} size={52} label={p?.name} verified={p?.verified} />
                  {conv?.unread ? <UnreadDot /> : null}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Row justify="space-between" gap={8}>
                    {/* The booking line below already carries the venue/musician icon. */}
                    <PartyName who={p} venueIcon={false} />
                    {last ? <T v="small" style={{ fontSize: 12 }}>{last.time}</T> : null}
                  </Row>
                  <Row gap={6}>
                    <Icon name={b.type === 'venue' ? 'storefront-outline' : 'account-music-outline'} size={15} color={colors.brandMid} />
                    <T v="smallBold" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{b.eventTitle} · {shortDate(b.date)}</T>
                  </Row>
                  <Row justify="space-between" gap={8}>
                    <T v="small" numberOfLines={1} style={{ flex: 1 }} color={conv?.unread ? colors.ink : colors.muted}>{preview}</T>
                    <Pill label={bookingLabel(b)} tone={bookingTone(b)} />
                  </Row>
                </View>
              </Pressable>
            );
          })
        ) : query && bookingChatsAll.length ? (
          noResults
        ) : (
          <EmptyState
            icon="message-text-outline"
            title="No booking chats yet"
            body="Once a musician or venue accepts your booking, you can chat with them about the details here."
            action="Your bookings"
            onAction={() => router.push('/my-bookings?tab=musician')}
          />
        )
      ) : requests.length ? (
        requests.map((r) => {
          const left = r.deadline ? timeLeft(r.deadline) : r.expires;
          return (
            <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Request from ${r.requester}: ${r.title}, ${r.date}, ${left}`} onPress={() => router.push(`/pro/request/${r.id}`)} style={rowStyle}>
              <Avatar label={r.initials} size={48} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{r.requester}</T>
                <T v="small" numberOfLines={1}>{r.title} · {r.date}</T>
              </View>
              <T v="smallBold" color={colors.warning}>{left}</T>
            </Pressable>
          );
        })
      ) : query && newRequests.length ? (
        noResults
      ) : (
        <EmptyState icon="inbox-outline" title="No new requests" body="New booking requests land here. Keep your availability up to date so people can book you." action="Open Pro workspace" onAction={() => router.push('/pro/workspace')} />
      )}
    </Screen>
  );
}
