import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Avatar, Field, Row, Segmented, T } from '../components/ui';
import { profileById, profiles } from '../data/mock';
import { useApp } from '../store/useApp';
import { colors, shadow } from '../theme';

export default function Inbox() {
  const conversations = useApp((s) => s.conversations);
  const allRequests = useApp((s) => s.requests);
  const requests = allRequests.filter((r) => r.status === 'new');
  const role = useApp((s) => s.user.role);
  const [tab, setTab] = useState<'messages' | 'requests'>('messages');
  const [q, setQ] = useState('');
  const online = profiles.filter((p) => ['adam', 'sameul', 'sara', 'dana', 'mo', 'soso'].includes(p.id));

  const list = conversations.filter((c) => {
    const p = profileById(c.withId);
    return !q || p?.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <Screen header={<ScreenHeader title="Inbox" />} contentStyle={{ gap: 14 }}>
      <Field placeholder="Search here" value={q} onChangeText={setQ} icon="magnify" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {online.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Message ${p.name}`} onPress={() => router.push(`/chat/${useApp.getState().ensureConversation(p.id)}`)} style={{ alignItems: 'center', gap: 6, width: 72 }}>
            <View>
              <Avatar src={p.avatar} size={68} />
              <View style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.white }} />
            </View>
            <T v="small" color={colors.ink} numberOfLines={1}>{p.name}</T>
          </Pressable>
        ))}
      </ScrollView>
      <Segmented
        dark
        options={[{ key: 'messages', label: 'Messages' }, { key: 'requests', label: role === 'fan' ? 'Booking chats' : `Requests (${requests.length})` }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'messages'
        ? list.map((c) => {
            const p = profileById(c.withId);
            const last = c.messages[c.messages.length - 1];
            const preview = last ? (last.type === 'text' ? last.text : last.type === 'voice' ? 'Voice message' : 'Photo') : 'Say hi';
            return (
              <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/chat/${c.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
                <View>
                  <Avatar src={p?.avatar} size={52} label={p?.name} />
                  {c.unread ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: colors.white }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Row justify="space-between">
                    <T v="bodyBold">{p?.name}</T>
                    <T v="small" style={{ fontSize: 12 }}>{last?.time}</T>
                  </Row>
                  <T v={c.unread ? 'bodyBold' : 'body'} numberOfLines={1} color={c.unread ? colors.ink : colors.muted}>{preview}</T>
                </View>
              </Pressable>
            );
          })
        : role === 'fan'
          ? (
            <T v="body" color={colors.muted}>Chats with musicians and venues you’ve booked appear here once a booking is confirmed.</T>
          )
          : requests.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/pro/request/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
                <Avatar label={r.initials} size={48} />
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{r.requester}</T>
                  <T v="small" numberOfLines={1}>{r.title} · {r.date}</T>
                </View>
                <T v="smallBold" color={colors.warning}>{r.expires}</T>
              </Pressable>
            ))}
    </Screen>
  );
}
