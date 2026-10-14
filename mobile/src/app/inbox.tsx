import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Avatar, EmptyState, Field, Icon, Pill, Row, Segmented, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profileById, profiles, venueById } from '../data/mock';
import type { BookingStatus, Conversation } from '../data/types';
import { STATUS_LABEL, STATUS_TONE } from '../lib/booking';
import { shortDate } from '../lib/format';
import { useApp } from '../store/useApp';
import { colors, shadow } from '../theme';

const ONLINE = ['adam', 'sameul', 'sara', 'dana', 'mo', 'soso'];

/** Booking statuses that unlock a chat with the provider. */
const CHAT_STATUSES: BookingStatus[] = ['accepted', 'paid', 'confirmed', 'completed'];

const rowStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) };

/** A chat partner can be a person (musician, organizer, fan) or a venue. */
function party(id: string): { name: string; avatar?: ImgKey; verified?: boolean } | undefined {
  const p = profileById(id);
  if (p) return { name: p.name, avatar: p.avatar, verified: p.verified };
  const v = venueById(id);
  if (v) return { name: v.name, avatar: v.cover };
  return undefined;
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
  const role = useApp((s) => s.user.role);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [tab, setTab] = useState<'messages' | 'requests'>('messages');
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const matches = (...texts: (string | undefined)[]) => !query || texts.some((t) => t?.toLowerCase().includes(query));
  const isBlocked = (id: string) => blocked.includes(id);
  const openChat = (withId: string) => router.push(`/chat/${ensureConversation(withId)}`);

  const online = profiles.filter((p) => ONLINE.includes(p.id) && !isBlocked(p.id));
  const list = conversations.filter((c) => {
    const who = party(c.withId);
    return !!who && !isBlocked(c.withId) && matches(who.name);
  });

  // Fans: one chat per booking the provider has accepted (or later).
  const bookingChatsAll = bookings
    .filter((b) => CHAT_STATUSES.includes(b.status) && !isBlocked(b.targetId) && !!party(b.targetId))
    .sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed'));
  const bookingChats = bookingChatsAll.filter((b) => matches(party(b.targetId)?.name, b.eventTitle));

  // Requests carry the requester's name only; match it to a profile to honour blocks.
  const newRequests = allRequests.filter((r) => {
    const requester = profiles.find((p) => p.name === r.requester);
    return r.status === 'new' && !(requester && isBlocked(requester.id));
  });
  const requests = newRequests.filter((r) => matches(r.requester, r.title));

  const noResults = <EmptyState icon="magnify-close" title="No matches" body={`Nothing in your inbox matches “${q.trim()}”.`} action="Clear search" onAction={() => setQ('')} />;

  return (
    <Screen header={<ScreenHeader title="Inbox" />} contentStyle={{ gap: 14 }}>
      <Field placeholder="Search here" accessibilityLabel="Search inbox" value={q} onChangeText={setQ} icon="magnify" returnKeyType="search" />
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
          { key: 'requests', label: role === 'fan' ? `Booking chats (${bookingChatsAll.length})` : `Requests (${newRequests.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'messages' ? (
        list.length ? (
          list.map((c) => {
            const who = party(c.withId);
            const { last, preview } = lastMessage(c);
            return (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Chat with ${who?.name}${c.unread ? `, ${c.unread} unread` : ''}`} onPress={() => router.push(`/chat/${c.id}`)} style={rowStyle}>
                <View>
                  <Avatar src={who?.avatar} size={52} label={who?.name} />
                  {c.unread ? <UnreadDot /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Row justify="space-between">
                    <T v="bodyBold" numberOfLines={1} style={{ flex: 1 }}>{who?.name}</T>
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
      ) : role === 'fan' ? (
        bookingChats.length ? (
          bookingChats.map((b) => {
            const who = party(b.targetId);
            const conv = conversations.find((c) => c.withId === b.targetId);
            const { last, preview } = lastMessage(conv);
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${who?.name} about ${b.eventTitle}, ${STATUS_LABEL[b.status]}`}
                onPress={() => openChat(b.targetId)}
                style={rowStyle}
              >
                <View>
                  <Avatar src={who?.avatar} size={52} label={who?.name} verified={who?.verified} />
                  {conv?.unread ? <UnreadDot /> : null}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Row justify="space-between" gap={8}>
                    <T v="bodyBold" numberOfLines={1} style={{ flex: 1 }}>{who?.name}</T>
                    {last ? <T v="small" style={{ fontSize: 12 }}>{last.time}</T> : null}
                  </Row>
                  <Row gap={6}>
                    <Icon name={b.type === 'venue' ? 'storefront-outline' : 'account-music-outline'} size={15} color={colors.brandMid} />
                    <T v="smallBold" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{b.eventTitle} · {shortDate(b.date)}</T>
                  </Row>
                  <Row justify="space-between" gap={8}>
                    <T v="small" numberOfLines={1} style={{ flex: 1 }} color={conv?.unread ? colors.ink : colors.muted}>{preview}</T>
                    <Pill label={STATUS_LABEL[b.status]} tone={STATUS_TONE[b.status]} />
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
        requests.map((r) => (
          <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Request from ${r.requester}: ${r.title}, ${r.date}, expires in ${r.expires}`} onPress={() => router.push(`/pro/request/${r.id}`)} style={rowStyle}>
            <Avatar label={r.initials} size={48} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{r.requester}</T>
              <T v="small" numberOfLines={1}>{r.title} · {r.date}</T>
            </View>
            <T v="smallBold" color={colors.warning}>{r.expires}</T>
          </Pressable>
        ))
      ) : query && newRequests.length ? (
        noResults
      ) : (
        <EmptyState icon="inbox-outline" title="No new requests" body="New booking requests land here. Keep your availability up to date so people can book you." action="Open Pro workspace" onAction={() => router.push('/pro/workspace')} />
      )}
    </Screen>
  );
}
