import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../../components/layout';
import { Banner, Button, Card, Chip, Divider, EmptyState, Icon, type IconName, KeyValue, Photo, Pill, Radio, Row, T } from '../../../components/ui';
import { GENRES } from '../../../data/mock';
import { hostsEvent } from '../../../lib/eventHost';
import { eventState } from '../../../lib/events';
import { compact, euro, isoDay, parse, shortDate, time, TODAY } from '../../../lib/format';
import { activePromotion, DAY_MS, doorsOpenAt, isPromoted, type PromotionChain, promotionChain, promotionEnd } from '../../../lib/promotions';
import { type Promotion, useApp, useEvent, useVenue } from '../../../store/useApp';
import { colors, radius, shadow } from '../../../theme';

/** Featured listings: €49–€199 per week (revenue model). Reach is per week at a 10 km radius. */
const BUDGETS: { amount: number; name: string; reach: number; blurb: string; icon: IconName; popular?: boolean }[] = [
  { amount: 49, name: 'Starter', reach: 3000, blurb: 'Featured in Discover near the venue', icon: 'star-four-points-outline' },
  { amount: 99, name: 'Popular', reach: 8000, blurb: 'Discover, Map and Search placement', icon: 'rocket-launch-outline', popular: true },
  { amount: 199, name: 'Max', reach: 20000, blurb: 'Top placement plus a push to matching fans', icon: 'bullhorn-outline' },
];
const DURATIONS = [3, 7, 14];
const RADII = [5, 10, 25];
const RADIUS_FACTOR: Record<number, number> = { 5: 0.6, 10: 1, 25: 1.7 };

const audienceFactor = (n: number) => (n === 0 ? 1 : Math.min(1, 0.4 + 0.12 * n));
const roundReach = (n: number) => Math.max(100, Math.round(n / 100) * 100);
const weeklyReach = (base: number, km: number, genres: number) => roundReach(base * (RADIUS_FACTOR[km] ?? 1) * audienceFactor(genres));
const reachFor = (p: Pick<Promotion, 'budget' | 'days' | 'radiusKm' | 'audience'>) => {
  const tier = BUDGETS.find((b) => b.amount === p.budget) ?? BUDGETS[0];
  return roundReach((weeklyReach(tier.reach, p.radiusKm, p.audience.length) * p.days) / 7);
};

const fmtDay = (ms: number) => shortDate(isoDay(new Date(ms)));
const dayCount = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T v="h3">{title}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

export default function PromoteEvent() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  // Includes the owner's saved listing edits (e.g. a renamed Moon Club).
  const venue = useVenue(event?.venueId);
  const promotions = useApp((s) => s.promotions);
  const promoteEvent = useApp((s) => s.promoteEvent);
  const methods = useApp((s) => s.paymentMethods);
  const selectedPayment = useApp((s) => s.selectedPayment);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);

  // An extension starts from the settings of the running boost, else the latest one for this event (newest come first).
  const last = (event ? activePromotion(promotions, event) : null) ?? promotions.find((p) => p.eventId === eventId);
  const [budget, setBudget] = useState(() => last?.budget ?? 99);
  const [days, setDays] = useState(7);
  const [radiusKm, setRadiusKm] = useState(() => last?.radiusKm ?? 10);
  const [audience, setAudience] = useState<string[]>(() => last?.audience ?? (event && GENRES.includes(event.genre) ? [event.genre] : []));
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ total: number; reach: number; extended: boolean }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const chain = useMemo(() => promotionChain(promotions, eventId ?? ''), [promotions, eventId]);
  // Boosts are stamped on the demo clock, so "now" is the demo day too.
  const now = TODAY.getTime();

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Promote event" onBack={() => goBack('/pro/events')} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="This event may have been removed. Pick another one from your events." action="Back to my events" onAction={() => router.dismissTo('/pro/events')} />
      </Screen>
    );
  }

  // Promotion is for live public events you organise: never a draft, a cancelled or a private event.
  const state = eventState(event, bookings);
  if (!hostsEvent(event, user) || state === 'draft' || state === 'cancelled') {
    const own = hostsEvent(event, user);
    return (
      <Screen header={<ScreenHeader title="Promote event" onBack={() => goBack(own ? `/event-workspace/${event.id}` : `/event/${event.id}`)} />}>
        {!own ? (
          <EmptyState icon="account-lock-outline" title="Only the organizer can promote this event" body="Featured listings are bought by the organizer of a public event." action="View event" onAction={() => router.replace(`/event/${event.id}`)} />
        ) : state === 'draft' ? (
          <EmptyState icon="file-document-edit-outline" title="Publish the event first" body="Drafts are only visible to you, so there is nothing to promote yet. Finish and publish it from the event workspace." action="Open event workspace" onAction={() => router.replace(`/event-workspace/${event.id}`)} />
        ) : (
          <EmptyState icon="calendar-remove-outline" title="This event is cancelled" body="Cancelled events can’t be promoted." action="Open event workspace" onAction={() => router.replace(`/event-workspace/${event.id}`)} />
        )}
      </Screen>
    );
  }
  const ended = parse(event.end) < TODAY;
  const doorsAt = doorsOpenAt(event).getTime();
  const doorsOpen = doorsAt <= now;
  // Boosts stop automatically when doors open, so the visible end date is capped there.
  const runEnd = promotionEnd(promotions, event)?.getTime() ?? 0;
  const active = isPromoted(promotions, event, TODAY);
  // The running boost already lasts until doors open: there is nothing left to extend.
  const covered = active && chain.end >= doorsAt;
  const canPromote = !doorsOpen && !event.isPrivate && !covered;
  const method = methods.find((m) => m.id === selectedPayment) ?? methods[0];

  const tier = BUDGETS.find((b) => b.amount === budget) ?? BUDGETS[1];
  // An extension starts when the running boost ends. Boosts stop at doors open, so only the (whole) days
  // before then are billed and booked: nothing is charged for days that could never run.
  const startAt = active ? chain.end : now;
  const daysBeforeDoors = Math.max(1, Math.ceil((doorsAt - startAt) / DAY_MS));
  const billedDays = Math.min(days, daysBeforeDoors);
  const runsPastEvent = billedDays < days;
  const total = Math.round((budget * billedDays) / 7);
  const reach = reachFor({ budget, days: billedDays, radiusKm, audience });
  const newEnd = Math.min(startAt + billedDays * DAY_MS, doorsAt);

  const toggleGenre = (g: string) => setAudience((a) => (a.includes(g) ? a.filter((x) => x !== g) : [...a, g]));

  const pay = () => {
    if (paying) return;
    setPaying(true);
    timer.current = setTimeout(() => {
      promoteEvent({ eventId: event.id, budget, days: billedDays, radiusKm, audience });
      setPaying(false);
      setDone({ total, reach, extended: active });
    }, 700);
  };

  // ----- Success state -----
  if (done) {
    return (
      <Screen edges={['top', 'bottom']} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, gap: 12 }}>
        <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="rocket-launch" size={50} color={colors.gold} />
        </View>
        <T v="h1" color={colors.brandMid} center>{done.extended ? 'Boost extended!' : 'Your event is boosted!'}</T>
        <T v="body" color={colors.muted} center>
          {`${event.title} is now a featured listing for fans within ${radiusKm} km of ${venue?.name ?? 'the venue'}. Watch ticket sales on your events page.`}
        </T>
        <Card style={{ alignSelf: 'stretch', gap: 2, marginTop: 8 }}>
          <KeyValue k="Runs until" v={fmtDay(runEnd)} />
          <KeyValue k="Estimated reach" v={`${compact(done.reach)} people`} />
          <KeyValue k="Paid with" v={method?.label ?? 'Card'} />
          <Divider style={{ marginVertical: 8 }} />
          <KeyValue k="Total charged" v={euro(done.total)} strong />
        </Card>
        <Button title="Back to my events" full style={{ marginTop: 8 }} onPress={() => router.dismissTo('/pro/events')} />
        <Button title="View event page" variant="secondary" full onPress={() => router.push(`/event/${event.id}`)} />
      </Screen>
    );
  }

  return (
    <Screen
      header={<ScreenHeader title={covered ? 'Promotion' : active ? 'Extend promotion' : 'Promote event'} subtitle="Featured listing" onBack={() => goBack('/pro/events')} />}
      footer={
        canPromote ? (
          <BottomBar>
            <Row gap={12}>
              <View style={{ flex: 1 }}>
                <T v="small">Total · {dayCount(billedDays)}</T>
                <T v="h2">{euro(total)}</T>
              </View>
              <Button
                title={active ? 'Pay & extend' : 'Pay & boost'}
                icon="rocket-launch-outline"
                loading={paying}
                style={{ flex: 1.4 }}
                accessibilityLabel={`${active ? 'Pay and extend' : 'Pay and boost'}, ${euro(total)}`}
                onPress={pay}
              />
            </Row>
          </BottomBar>
        ) : null
      }
    >
      {/* Event preview */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }} accessibilityLabel={`${event.title}, ${shortDate(event.start)}. Open event page`} onPress={() => router.push(`/event/${event.id}`)}>
        <Photo src={event.cover} style={{ width: 68, height: 68 }} radius={14} accessibilityLabel={`${event.title} cover`} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title" numberOfLines={1}>{event.title}</T>
          <T v="small" numberOfLines={1}>{shortDate(event.start)} · {time(event.start)} · {venue?.name ?? 'TBA'}</T>
          <View style={{ marginTop: 4 }}>
            {active ? (
              <Pill label={`Promoted until ${fmtDay(runEnd)}`} icon="rocket-launch" tone="success" />
            ) : ended ? (
              <Pill label="Ended" tone="neutral" />
            ) : doorsOpen ? (
              <Pill label="Doors open" tone="neutral" />
            ) : event.isPrivate ? (
              <Pill label="Private" icon="lock-outline" tone="neutral" />
            ) : (
              <Pill label="Not promoted yet" tone="neutral" />
            )}
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Card>

      {doorsOpen ? (
        <EmptyState
          icon="calendar-check-outline"
          title={ended ? 'This event has ended' : 'Doors are already open'}
          body="Promotions run before doors open. Boost one of your upcoming events instead."
          action="Back to my events"
          onAction={() => router.dismissTo('/pro/events')}
        />
      ) : event.isPrivate ? (
        <EmptyState icon="lock-outline" title="Private events are invite-only" body="Featured listings show events to fans nearby, so only public events can be promoted. Invite your guests directly instead." action="Invite guests" onAction={() => router.push(`/invite?event=${event.id}`)} />
      ) : covered ? (
        <>
          <ActivePromotion chain={chain} end={runEnd} now={now} />
          <Banner icon="check-decagram" tone="success">{`Your boost already runs until doors open on ${fmtDay(doorsAt)} at ${time(event.start)}, so there is nothing left to extend.`}</Banner>
          <Button title="Back to my events" variant="secondary" full onPress={() => router.dismissTo('/pro/events')} />
        </>
      ) : (
        <>
          {active ? (
            <ActivePromotion chain={chain} end={runEnd} now={now} />
          ) : (
            <Banner icon="star-four-points-outline">Featured events appear at the top of Discover, Map and Search for fans near the venue, marked as Sponsored.</Banner>
          )}

          <Section title={active ? 'Extension budget' : 'Weekly budget'} hint="Billed per week, pro-rated by duration.">
            <View style={{ gap: 10 }} accessibilityRole="radiogroup">
              {BUDGETS.map((b) => {
                const on = b.amount === budget;
                return (
                  <Pressable
                    key={b.amount}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${b.name}, ${euro(b.amount)} per week, about ${compact(weeklyReach(b.reach, radiusKm, audience.length))} people per week`}
                    onPress={() => setBudget(b.amount)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: radius.lg,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? colors.brand : colors.border,
                      backgroundColor: on ? colors.brandTint : colors.surface,
                      opacity: pressed ? 0.9 : 1,
                      ...(on ? shadow(1) : null),
                    })}
                  >
                    <Radio selected={on} />
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={b.icon} size={22} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Row gap={6} style={{ flexWrap: 'wrap' }}>
                        <T v="bodyBold">{b.name}</T>
                        {b.popular ? <Pill label="Most popular" tone="warning" /> : null}
                      </Row>
                      <T v="small" numberOfLines={2}>{b.blurb}</T>
                      <Row gap={4}>
                        <Icon name="account-multiple-outline" size={14} color={colors.brandMid} />
                        <T v="smallBold" color={colors.brandMid}>≈ {compact(weeklyReach(b.reach, radiusKm, audience.length))} people / week</T>
                      </Row>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T v="h3">{euro(b.amount)}</T>
                      <T v="small" style={{ fontSize: 12 }}>per week</T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title="Duration" hint={active ? `Adds days after the current boost ends on ${fmtDay(chain.end)}.` : 'Your boost starts right after payment.'}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {DURATIONS.map((d) => <Chip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />)}
            </Row>
          </Section>

          <Section title="Radius" hint={`Around ${venue?.name ?? 'the venue'}${venue ? `, ${venue.area}` : ''}`}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {RADII.map((r) => <Chip key={r} label={`${r} km`} icon="map-marker-radius-outline" selected={radiusKm === r} onPress={() => setRadiusKm(r)} />)}
            </Row>
          </Section>

          <Section title="Audience" hint={audience.length ? `Fans of ${audience.join(', ')}` : 'No genre picked: reaching all music fans nearby.'}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {GENRES.map((g) => <Chip key={g} label={g} selected={audience.includes(g)} onPress={() => toggleGenre(g)} />)}
            </Row>
          </Section>

          <Card style={{ gap: 2 }}>
            <T v="caption" style={{ marginBottom: 6 }}>SUMMARY</T>
            <KeyValue k="Plan" v={`${tier.name} · ${euro(budget)} / week`} />
            <KeyValue k="Duration" v={runsPastEvent ? `${dayCount(billedDays)}, until doors open` : dayCount(days)} />
            <KeyValue k={active ? 'New end date' : 'Runs until'} v={fmtDay(newEnd)} />
            <KeyValue k="Radius" v={`${radiusKm} km`} />
            <KeyValue k="Audience" v={audience.length ? `${audience.length} genre${audience.length > 1 ? 's' : ''}` : 'All fans'} />
            <KeyValue k="Estimated reach" v={`${compact(reach)} people`} color={colors.brand} />
            <Divider style={{ marginVertical: 8 }} />
            <KeyValue k="Total" v={euro(total)} strong />
            <T v="small" style={{ marginTop: 4 }}>{`${euro(budget)} × ${dayCount(billedDays)} ÷ 7, rounded. Incl. VAT.`}</T>
          </Card>

          {runsPastEvent ? (
            <Banner icon="information-outline" tone="warning">{`Doors open on ${fmtDay(doorsAt)} at ${time(event.start)}. The boost stops then, so you’re only charged for ${dayCount(billedDays)}, not ${days}.`}</Banner>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pay with ${method?.label ?? 'card'}. Change payment method`}
            onPress={() => router.push('/payment-methods')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
          >
            <View style={{ minWidth: 48, height: 32, paddingHorizontal: 6, borderRadius: 8, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
              <T v="smallBold" color={colors.white} style={{ fontSize: 11 }}>{method?.badge ?? 'CARD'}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{method?.label ?? 'Add a payment method'}</T>
              <T v="small">{method?.sub ?? 'Required to boost'}</T>
            </View>
            <T v="smallBold" color={colors.brand}>Change</T>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

/** `end` is the visible end of the boost (the chain end, capped at doors open). */
function ActivePromotion({ chain, end, now }: { chain: PromotionChain; end: number; now: number }) {
  const span = Math.max(1, end - chain.start);
  const pct = Math.min(1, Math.max(0, (now - chain.start) / span));
  // Only figures that come from what was bought: no measured views or clicks are invented here.
  const totalReach = chain.run.reduce((n, p) => n + reachFor(p), 0);
  const spent = chain.run.reduce((n, p) => n + Math.round((p.budget * p.days) / 7), 0);
  const daysLeft = Math.max(1, Math.ceil((end - now) / DAY_MS));
  return (
    <View style={{ borderRadius: radius.xl, padding: 16, gap: 14, backgroundColor: colors.brandDeep }}>
      <Row justify="space-between">
        <Row gap={8}>
          <Icon name="rocket-launch" size={20} color={colors.gold} />
          <T v="title" color={colors.white}>Boost running</T>
        </Row>
        <T v="smallBold" color={colors.lilacLight}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</T>
      </Row>
      <View style={{ gap: 6 }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${Math.round(pct * 100)}%`, borderRadius: 4, backgroundColor: colors.gold }} />
        </View>
        <Row justify="space-between">
          <T v="small" color={colors.lilac}>Started {fmtDay(chain.start)}</T>
          <T v="small" color={colors.lilac}>Ends {fmtDay(end)}</T>
        </Row>
      </View>
      <Row gap={8}>
        {[
          { k: 'Est. reach', v: compact(totalReach) },
          { k: chain.run.length === 1 ? 'Boost' : 'Boosts', v: String(chain.run.length) },
          { k: 'Spent', v: euro(spent) },
        ].map((s) => (
          <View key={s.k} style={{ flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <T v="small" color={colors.lilacLight} style={{ fontSize: 12 }} numberOfLines={1}>{s.k}</T>
            <T v="bodyBold" color={colors.white}>{s.v}</T>
          </View>
        ))}
      </Row>
      <T v="small" color={colors.lilac}>Reach is the estimate for the plans you bought, not measured views.</T>
    </View>
  );
}
