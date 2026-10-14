import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge } from '../../components/cards';
import { goBack } from '../../components/layout';
import { Avatar, Button, Icon, type IconName, IconButton, Pill, Row, T } from '../../components/ui';
import { analytics, transactions } from '../../data/mock';
import type { Role } from '../../data/types';
import { euro, isoDay, shortDate, TODAY } from '../../lib/format';
import { ROLE_LABEL, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const THIS_MONTH = isoDay(TODAY).slice(0, 7); // "2026-10"

/** Request dates are display labels like "Thu 31 Dec 2026"; turn them into ISO days for DateBadge and sorting. */
function requestIso(label: string) {
  const m = /(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/.exec(label);
  const month = m ? MONTH_SHORT.indexOf(m[2]) : -1;
  if (!m || month < 0) return isoDay(TODAY);
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
/** What the pro receives for a gig: the offer minus the 10% Domtak fee. */
const net = (offer: number) => Math.round(offer * 0.9);
/** Gigs that already have a mock transaction; newly accepted ones are booked into escrow today (same rule as /pro/earnings). */
const KNOWN_TITLES = new Set(transactions.map((t) => t.title));

type QuickAction = { key: string; icon: IconName; label: string; href: string; badge?: number; a11y?: string };

/** Role-aware entry points: everyone gets Requests and Earnings; musicians Availability, venue owners their listing, organizers their events. */
function quickActions(role: Role, newRequests: number): QuickAction[] {
  const list: QuickAction[] = [
    { key: 'requests', icon: 'inbox-arrow-down', label: 'Requests', href: '/pro/requests', badge: newRequests, a11y: 'Booking requests' },
    { key: 'earnings', icon: 'wallet-outline', label: 'Earnings', href: '/pro/earnings' },
  ];
  if (role === 'musician') list.push({ key: 'availability', icon: 'calendar-check', label: 'Availability', href: '/pro/availability' });
  if (role === 'venue') list.push({ key: 'venue', icon: 'storefront-outline', label: 'My venue', href: '/pro/venue-listing', a11y: 'My venue listing' });
  if (role === 'organizer') {
    list.push({ key: 'events', icon: 'calendar-star', label: 'My events', href: '/pro/events' });
    list.push({ key: 'new-event', icon: 'calendar-plus', label: 'New event', href: '/create-event' });
  }
  list.push({ key: 'scan', icon: 'qrcode-scan', label: 'Scan', href: '/pro/scan' });
  return list;
}

function Action({ icon, label, badge, a11y, onPress }: { icon: IconName; label: string; badge?: number; a11y?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y ?? label}${badge ? `, ${badge} new` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 2, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={colors.brand} />
      </View>
      <T v="smallBold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 12 }}>{label}</T>
      {badge ? (
        <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.warningStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Workspace() {
  const user = useApp((s) => s.user);
  const requests = useApp((s) => s.requests);
  const myEvents = useApp((s) => s.myEvents);
  const balance = useApp((s) => s.balance);

  const newCount = requests.filter((r) => r.status === 'new').length;
  const accepted = requests
    .filter((r) => r.status === 'accepted')
    .map((r) => ({ ...r, iso: requestIso(r.date) }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  const escrow = sum(accepted.map((r) => net(r.offer)));
  const newlyAccepted = sum(accepted.filter((r) => !KNOWN_TITLES.has(r.title)).map((r) => net(r.offer)));
  const monthEarnings = sum(transactions.filter((t) => t.amount > 0 && t.date.startsWith(THIS_MONTH)).map((t) => t.amount)) + newlyAccepted;

  const views = analytics.profileViews;
  const views7 = views.slice(-7);
  const viewsTotal = sum(views7);
  const viewsPrev = sum(views.slice(-14, -7));
  const viewsDelta = viewsPrev ? Math.round(((viewsTotal - viewsPrev) / viewsPrev) * 100) : 0;
  const viewsMax = Math.max(1, ...views7);

  const actions = quickActions(user.role, newCount);
  const city = user.city.split(',')[0];
  const hasGigs = accepted.length > 0 || myEvents.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.brandDeep, paddingBottom: 64 }}>
        <Row style={{ paddingHorizontal: 4, height: 56 }} gap={4}>
          <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/(tabs)')} />
          <Text style={{ flex: 1, color: colors.white, fontFamily: fonts.wordmark, fontSize: 24 }}>DOMTAK <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.brandDark, backgroundColor: colors.gold }}> PRO </Text></Text>
          <IconButton name="cog-outline" label="Settings" color={colors.lilac} onPress={() => router.push('/settings')} />
        </Row>
        <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <Avatar src={user.avatar} size={52} label={user.name} verified={user.pro === 'verified'} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>Hi, {user.name.split(' ')[0]}</Text>
            <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 13 }} numberOfLines={1}>
              {ROLE_LABEL[user.role]} · {user.pro === 'verified' ? 'Verified' : user.pro === 'review' ? 'Verification in review' : 'Not verified yet'}{city ? ` · ${city}` : ''}
            </Text>
          </View>
        </Row>
      </SafeAreaView>

      <ScrollView style={{ marginTop: -52 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, gap: 14, ...shadow(2) }}>
          <Row justify="space-between" align="flex-start">
            <View>
              <T v="small">Earnings this month</T>
              <T v="h1">{euro(monthEarnings)}</T>
            </View>
            <Button title="Payout" accessibilityLabel={`Payout, ${euro(balance)} available`} size="sm" icon="bank-transfer-out" hitSlop={6} onPress={() => router.push('/pro/earnings')} />
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.brandTint }}>
              <T v="small" style={{ fontSize: 12 }}>Held in escrow</T>
              <T v="bodyBold">{euro(escrow)}</T>
            </View>
            <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.brandTint }}>
              <T v="small" style={{ fontSize: 12 }}>Available</T>
              <T v="bodyBold">{euro(balance)}</T>
            </View>
          </Row>
        </View>

        <Row gap={6} align="stretch">
          {actions.map((a) => (
            <Action key={a.key} icon={a.icon} label={a.label} badge={a.badge} a11y={a.a11y} onPress={() => router.push(a.href as never)} />
          ))}
        </Row>

        {user.pro !== 'verified' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${user.pro === 'review' ? 'Verification in review' : 'Get verified as Pro'}. Badge, in-app bookings and payouts`}
            onPress={() => router.push('/pro-verification')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.brandDeep }}>
            <Icon name="check-decagram" size={26} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold" color={colors.white}>{user.pro === 'review' ? 'Verification in review' : 'Get verified as Pro'}</T>
              <T v="small" color={colors.lilacLight}>Badge, in-app bookings & payouts</T>
            </View>
            <Icon name="chevron-right" size={22} color={colors.white} />
          </Pressable>
        ) : null}

        <View style={{ gap: 10 }}>
          <Row justify="space-between">
            <T v="h3">Upcoming gigs</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Open calendar" onPress={() => router.push('/(tabs)/calendar')} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
              <T v="smallBold" color={colors.brand}>Calendar</T>
            </Pressable>
          </Row>
          {accepted.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${shortDate(r.iso)}, ${r.time}, ${r.location.split(',')[0]}, ${euro(r.offer)}, paid into escrow. Open request`}
              onPress={() => router.push(`/pro/request/${r.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
              <DateBadge iso={r.iso} size={52} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{r.title}</T>
                <T v="small">{r.time} · {r.location.split(',')[0]} · {euro(r.offer)}</T>
              </View>
              <Pill label="Escrow" tone="success" icon="lock-clock" />
            </Pressable>
          ))}
          {myEvents.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title}, ${shortDate(e.start)}, your event. Manage attendees`}
              onPress={() => router.push(`/pro/attendees/${e.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
              <DateBadge iso={e.start} size={52} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{e.title}</T>
                <T v="small">Your event · {e.ticketTypes.reduce((n, t) => n + t.capacity, 0)} tickets</T>
              </View>
              <T v="smallBold" color={colors.brand}>Manage</T>
            </Pressable>
          ))}
          {!hasGigs ? (
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, gap: 10, ...shadow(1) }}>
              <T v="bodyBold">No upcoming gigs yet</T>
              <T v="small">Accepted booking requests{user.role === 'organizer' ? ' and your published events' : ''} show up here.</T>
              <Button
                title={user.role === 'organizer' ? 'Create an event' : 'Review requests'}
                size="sm"
                variant="light"
                hitSlop={6}
                style={{ alignSelf: 'flex-start' }}
                onPress={() => router.push(user.role === 'organizer' ? '/create-event' : '/pro/requests')}
              />
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Profile views, last 7 days, ${num(viewsTotal)}, ${viewsDelta >= 0 ? 'up' : 'down'} ${Math.abs(viewsDelta)} percent. Open insights`}
          onPress={() => router.push('/pro/earnings?tab=insights')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-end', gap: 14, padding: 16, borderRadius: 16, backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1, ...shadow(1) })}
        >
          <View style={{ flex: 1 }}>
            <Row gap={4}>
              <T v="small">Profile views · 7 days</T>
              <Icon name="chevron-right" size={16} color={colors.subtle} />
            </Row>
            <T v="h2">
              {num(viewsTotal)} <T v="smallBold" color={viewsDelta >= 0 ? colors.success : colors.danger}>{viewsDelta >= 0 ? '+' : '−'}{Math.abs(viewsDelta)}%</T>
            </T>
          </View>
          <Row gap={5} align="flex-end" style={{ height: 44 }}>
            {views7.map((v, i) => (
              <View key={i} style={{ width: 10, height: Math.max(4, (v / viewsMax) * 44), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: i === views7.length - 1 ? colors.brand : colors.lilac }} />
            ))}
          </Row>
        </Pressable>
      </ScrollView>
    </View>
  );
}
