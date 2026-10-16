import { router } from 'expo-router';
import { type ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { conversations as seedConversations, profileById, venueById } from '../data/mock';
import type { ImgKey } from '../data/images';
import type { Booking, Conversation } from '../data/types';
import { isClosed, type Tone } from '../lib/booking';
import { STRIP_LABEL, type StripDay, type StripKind } from '../lib/dashboards';
import { plural } from '../lib/format';
import { overlayVenue, useApp } from '../store/useApp';
import { colors, fonts, radius, shadow } from '../theme';
import { Avatar, Button, Icon, type IconName, Pill, Row, T } from './ui';

/**
 * Shared building blocks for the member dashboard (/dashboard) and the professional
 * workspace (/pro/workspace): blueprint section 11 panels, queue rows and the availability strip.
 */

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  brand: { bg: colors.brandSoft, fg: colors.brand },
  neutral: { bg: colors.chipIdle, fg: colors.label },
};

/** A dashboard panel: white card with a title, an optional count and one header action. */
export function Panel({ title, icon, count, action, onAction, note, children }: { title: string; icon?: IconName; count?: number; action?: string; onAction?: () => void; note?: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow(1) }}>
      <Row justify="space-between" gap={8}>
        <Row gap={8} style={{ flex: 1 }}>
          {icon ? <Icon name={icon} size={20} color={colors.brand} /> : null}
          <T v="h3" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</T>
          {count ? <Pill label={String(count)} tone="brand" /> : null}
        </Row>
        {action && onAction ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
            <T v="smallBold" color={colors.brand}>{action}</T>
          </Pressable>
        ) : null}
      </Row>
      {note ? <T v="small" style={{ marginTop: -6 }}>{note}</T> : null}
      {children}
    </View>
  );
}

/** Compact empty state inside a panel: real absence of records plus the relevant next step. */
export function PanelEmpty({ icon, title, body, actions = [] }: { icon: IconName; title: string; body: string; actions?: { label: string; onPress: () => void; icon?: IconName; primary?: boolean }[] }) {
  return (
    <View style={{ gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.brandTint }}>
      <Row gap={10} align="flex-start">
        <Icon name={icon} size={22} color={colors.brand} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyBold">{title}</T>
          <T v="small">{body}</T>
        </View>
      </Row>
      {actions.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <Button key={a.label} title={a.label} icon={a.icon} size="sm" variant={a.primary ? 'primary' : 'secondary'} hitSlop={6} onPress={a.onPress} />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

/** One record that needs attention: tone-coloured icon, title, detail and a chevron to the record. */
export function QueueRow({ icon, title, sub, tone = 'brand', onPress, right, a11y }: { icon: IconName; title: string; sub?: string; tone?: Tone; onPress: () => void; right?: ReactNode; a11y?: string }) {
  const t = TONE[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? `${title}${sub ? `, ${sub}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={t.fg} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T v="bodyBold" numberOfLines={2}>{title}</T>
        {sub ? <T v="small" numberOfLines={2}>{sub}</T> : null}
      </View>
      {right}
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

/** A small figure tile (label, value, detail). */
export function Stat({ label, value, sub, icon, tone = 'brand' }: { label: string; value: string; sub?: string; icon?: IconName; tone?: Tone }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`} style={{ flexBasis: '46%', flexGrow: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTint, gap: 2 }}>
      <Row gap={6}>
        {icon ? <Icon name={icon} size={15} color={TONE[tone].fg} /> : null}
        <T v="small" numberOfLines={1} style={{ fontSize: 12, flex: 1 }}>{label}</T>
      </Row>
      <T v="h3">{value}</T>
      {sub ? <T v="small" style={{ fontSize: 12 }} numberOfLines={2}>{sub}</T> : null}
    </View>
  );
}

const STRIP_LOOK: Record<StripKind, { bg: string; fg: string; border: string }> = {
  booked: { bg: colors.brand, fg: colors.white, border: colors.brand },
  event: { bg: colors.gold, fg: colors.ink, border: colors.gold },
  blocked: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
  open: { bg: colors.successBg, fg: colors.success, border: colors.successBg },
  closed: { bg: colors.surface, fg: colors.subtle, border: colors.border },
};

/** Two-week availability strip with a legend. Tapping a day opens it in the calendar. */
export function DayStrip({ days, kinds = ['booked', 'blocked', 'open', 'closed'] }: { days: StripDay[]; kinds?: StripKind[] }) {
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {days.map((d) => {
          const look = STRIP_LOOK[d.kind];
          return (
            <Pressable
              key={d.iso}
              accessibilityRole="button"
              accessibilityLabel={`${d.weekday} ${d.day}: ${STRIP_LABEL[d.kind]}${d.labels.length ? `, ${d.labels.join(', ')}` : ''}. Open in calendar`}
              onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { date: d.iso } })}
              style={({ pressed }) => ({ width: 46, height: 64, borderRadius: 12, borderWidth: 1, borderColor: look.border, backgroundColor: look.bg, alignItems: 'center', justifyContent: 'center', gap: 2, opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: look.fg }}>{d.weekday}</Text>
              <Text style={{ fontFamily: fonts.displaySemi, fontSize: 17, color: look.fg }}>{d.day}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Row gap={12} style={{ flexWrap: 'wrap', rowGap: 6 }}>
        {kinds.map((k) => (
          <Row key={k} gap={6}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: STRIP_LOOK[k].bg, borderWidth: 1, borderColor: STRIP_LOOK[k].border }} />
            <T v="small" style={{ fontSize: 12 }}>{STRIP_LABEL[k]}</T>
          </Row>
        ))}
      </Row>
    </View>
  );
}

interface Party {
  name: string;
  avatar?: ImgKey;
}

/** Last message preview for a conversation. */
function preview(c: Conversation) {
  const last = c.messages[c.messages.length - 1];
  if (!last) return 'No messages yet';
  const text = last.type === 'text' ? last.text ?? '' : last.type === 'voice' ? 'Voice message' : 'Photo';
  return last.from === 'me' ? `You: ${text}` : text;
}

/**
 * Messages panel body: unread conversations first, with the booking they relate to as context.
 * Uses the sample conversations until the inbox has been opened (same rule as the header badge).
 */
export function ConversationList({ limit = 3, bookings = [] }: { limit?: number; bookings?: Booking[] }) {
  const stored = useApp((s) => s.conversations);
  const blocked = useApp((s) => s.blocked);
  const listing = useApp((s) => s.venueListing);
  const list = useMemo(() => {
    const all = stored.length ? stored : seedConversations;
    return all.filter((c) => !blocked.includes(c.withId)).sort((a, b) => b.unread - a.unread);
  }, [stored, blocked]);
  const unread = list.reduce((n, c) => n + c.unread, 0);
  const party = (id: string): Party | undefined => {
    const v = overlayVenue(venueById(id), listing);
    if (v) return { name: v.name, avatar: v.cover };
    const p = profileById(id);
    return p ? { name: p.name, avatar: p.avatar } : undefined;
  };
  if (!list.length) {
    return (
      <PanelEmpty
        icon="message-outline"
        title="No conversations yet"
        body="Chats with friends, hosts and the artists or venues you book appear here."
        actions={[{ label: 'Open inbox', onPress: () => router.push('/inbox') }]}
      />
    );
  }
  return (
    <View style={{ gap: 2 }}>
      {unread ? <T v="smallBold" color={colors.brand}>{plural(unread, 'unread message')}</T> : <T v="small">You’re all caught up.</T>}
      {list.slice(0, limit).map((c) => {
        const who = party(c.withId);
        const booking = bookings.find((b) => b.targetId === c.withId && !isClosed(b.status));
        const context = booking ? `About: ${booking.eventTitle}` : undefined;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${who?.name ?? 'Conversation'}${c.unread ? `, ${c.unread} unread` : ''}. ${preview(c)}${context ? `. ${context}` : ''}. Reply`}
            onPress={() => router.push(`/chat/${c.id}`)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}
          >
            <Avatar src={who?.avatar} size={40} label={who?.name} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold" numberOfLines={1}>{who?.name ?? 'Conversation'}</T>
              <T v="small" numberOfLines={1}>{preview(c)}</T>
              {context ? <T v="small" color={colors.brandMid} numberOfLines={1} style={{ fontSize: 12 }}>{context}</T> : null}
            </View>
            {c.unread ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 }}>{c.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
