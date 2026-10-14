import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Chip, Icon, type IconName, IconButton, Pill, Row, Stepper, T, Toggle } from '../../components/ui';
import { euro, isoDay, MONTHS_LONG, sameDay, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, type Weekday } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const WEEK: { key: Weekday; long: string }[] = [
  { key: 'Mon', long: 'Monday' },
  { key: 'Tue', long: 'Tuesday' },
  { key: 'Wed', long: 'Wednesday' },
  { key: 'Thu', long: 'Thursday' },
  { key: 'Fri', long: 'Friday' },
  { key: 'Sat', long: 'Saturday' },
  { key: 'Sun', long: 'Sunday' },
];
const RADII = [10, 25, 50, 100];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FEE_STEP = 10;
const FEE_MIN = 20;
const FEE_MAX = 5000;
const TODAY_ISO = isoDay(TODAY);

const weekdayOf = (d: Date): Weekday => WEEK[(d.getDay() + 6) % 7].key;
const clampFee = (n: number) => Math.min(FEE_MAX, Math.max(FEE_MIN, Math.round(n / FEE_STEP) * FEE_STEP));

/** "Thu 31 Dec 2026" -> "2026-12-31" (request dates are stored as display labels). */
function labelToIso(label: string) {
  const m = /(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/.exec(label);
  const month = m ? MONTH_SHORT.indexOf(m[2]) : -1;
  if (!m || month < 0) return undefined;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Cells for one month, Monday first; null = empty leading/trailing slot. */
function monthCells(year: number, month: number) {
  const offset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0, 12).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d, 12));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function SectionCard({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children: ReactNode }) {
  return (
    <Card style={{ gap: 14 }}>
      <Row gap={12} align="flex-start">
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="title" accessibilityRole="header">{title}</T>
          {sub ? <T v="small">{sub}</T> : null}
        </View>
      </Row>
      {children}
    </Card>
  );
}

function FeeStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onChange(clampFee(n));
    setDraft(null);
  };
  return (
    <Row gap={10}>
      <IconButton name="minus" label={`Lower fee by ${euro(FEE_STEP)}`} onPress={() => onChange(clampFee(value - FEE_STEP))} bg={colors.brandSoft} color={colors.brand} size={48} iconSize={22} />
      <View style={{ flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: 22, color: colors.ink }}>€</Text>
        <TextInput
          value={draft ?? String(value)}
          onFocus={() => setDraft(String(value))}
          onChangeText={(t) => setDraft(t.replace(/\D/g, '').slice(0, 4))}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel="Booking fee per hour in euros"
          style={{ minWidth: 56, height: 54, textAlign: 'center', fontFamily: fonts.displaySemi, fontSize: 22, color: colors.ink, paddingVertical: 0 }}
        />
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted }}>/ hour</Text>
      </View>
      <IconButton name="plus" label={`Raise fee by ${euro(FEE_STEP)}`} onPress={() => onChange(clampFee(value + FEE_STEP))} bg={colors.brand} color={colors.white} size={48} iconSize={22} />
    </Row>
  );
}

function LegendDot({ label, bg, border, strike }: { label: string; bg: string; border?: string; strike?: boolean }) {
  return (
    <Row gap={6}>
      <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: bg, borderWidth: border ? 1.5 : 0, borderColor: border, alignItems: 'center', justifyContent: 'center' }}>
        {strike ? <View style={{ width: 10, height: 1.5, backgroundColor: colors.danger }} /> : null}
      </View>
      <T v="small" style={{ fontSize: 12 }}>{label}</T>
    </Row>
  );
}

export default function AvailabilityScreen() {
  const role = useApp((s) => s.user.role);
  const city = useApp((s) => s.user.city);
  const availability = useApp((s) => s.availability);
  const setAvailability = useApp((s) => s.setAvailability);
  const requests = useApp((s) => s.requests);
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1, 12));

  const { days, blockedDates, feePerHour, minHours, radiusKm, instantBook } = availability;
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const bookedSet = useMemo(
    () => new Set(requests.filter((r) => r.status === 'accepted').map((r) => labelToIso(r.date)).filter((d): d is string => Boolean(d))),
    [requests],
  );
  const upcomingBlocked = blockedDates.filter((d) => d >= TODAY_ISO).sort();
  const openDays = WEEK.filter((w) => days[w.key]);
  const daysSummary = openDays.length === 7 ? 'Every day' : openDays.length === 0 ? 'No weekly days open' : openDays.map((w) => w.key).join(', ');
  const isVenue = role === 'venue';

  const atFirstMonth = cursor.getFullYear() === TODAY.getFullYear() && cursor.getMonth() === TODAY.getMonth();
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1, 12));
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth());

  const toggleDay = (key: Weekday) => setAvailability({ days: { ...days, [key]: !days[key] } });
  const preset = (keys: Weekday[]) => setAvailability({ days: WEEK.reduce((acc, w) => ({ ...acc, [w.key]: keys.includes(w.key) }), {} as Record<Weekday, boolean>) });
  const toggleBlocked = (iso: string) =>
    setAvailability({ blockedDates: blockedSet.has(iso) ? blockedDates.filter((d) => d !== iso) : [...blockedDates, iso].sort() });

  const save = () => {
    toast('Availability saved');
    goBack('/pro/workspace');
  };

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="Availability" subtitle="What bookers see on your profile" />}
      footer={
        <BottomBar>
          <Button title="Save" icon="check" onPress={save} />
        </BottomBar>
      }
    >
      <View style={{ padding: 16, borderRadius: radius.xl, backgroundColor: colors.brandDeep, gap: 10, ...shadow(2) }}>
        <Row justify="space-between">
          <T v="caption" color={colors.lilac}>BOOKABLE</T>
          {instantBook ? <Pill label="Instant book" icon="flash" tone="brand" /> : <Pill label="Approval needed" icon="clock-outline" tone="neutral" />}
        </Row>
        <T v="h2" color={colors.white}>{daysSummary}</T>
        <T v="body" color={colors.lilacLight}>
          {euro(feePerHour)}/h · min. {minHours} h · {isVenue ? 'organisers within' : 'travels up to'} {radiusKm} km
        </T>
        {upcomingBlocked.length ? <T v="small" color={colors.lilacLight}>{upcomingBlocked.length} upcoming {upcomingBlocked.length === 1 ? 'date' : 'dates'} blocked</T> : null}
      </View>

      <SectionCard icon="calendar-week" title="Weekly schedule" sub="Days you usually take bookings">
        <Row gap={0}>
          {WEEK.map((w) => {
            const on = days[w.key];
            return (
              <Pressable
                key={w.key}
                accessibilityRole="switch"
                accessibilityLabel={w.long}
                accessibilityState={{ checked: on }}
                onPress={() => toggleDay(w.key)}
                style={{ flex: 1, height: 64, paddingHorizontal: 2 }}
              >
                {({ pressed }) => (
                  <View style={{ flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: on ? colors.brand : colors.chipIdle, borderWidth: 1, borderColor: on ? colors.brand : colors.border, opacity: pressed ? 0.8 : 1 }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: on ? colors.white : colors.label }}>{w.key}</Text>
                    <Icon name={on ? 'check' : 'minus'} size={14} color={on ? colors.lilacLight : colors.disabled} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label="Weekends" selected={WEEK.every((w) => days[w.key] === ['Fri', 'Sat', 'Sun'].includes(w.key))} onPress={() => preset(['Fri', 'Sat', 'Sun'])} />
          <Chip label="Weekdays" selected={WEEK.every((w) => days[w.key] === !['Sat', 'Sun'].includes(w.key))} onPress={() => preset(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])} />
          <Chip label="Every day" selected={openDays.length === 7} onPress={() => preset(WEEK.map((w) => w.key))} />
        </Row>
        {openDays.length === 0 ? <Banner icon="alert-circle-outline" tone="warning">No days selected — bookers can’t send you requests until you open at least one day.</Banner> : null}
      </SectionCard>

      <SectionCard icon="calendar-remove" title="Blocked dates" sub="Tap a day to block or unblock it">
        <Row justify="space-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: atFirstMonth }}
            disabled={atFirstMonth}
            onPress={() => shift(-1)}
            hitSlop={4}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="chevron-left" size={28} color={atFirstMonth ? colors.disabled : colors.ink} />
          </Pressable>
          <T v="title" accessibilityRole="header">{MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}</T>
          <IconButton name="chevron-right" label="Next month" iconSize={28} size={44} onPress={() => shift(1)} />
        </Row>
        <View>
          <Row gap={0}>
            {WEEK.map((w) => (
              <Text key={w.key} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 12, color: days[w.key] ? colors.ink : colors.subtle, paddingBottom: 6 }}>{w.key.slice(0, 2)}</Text>
            ))}
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 48 }} />;
              const iso = isoDay(d);
              const past = iso < TODAY_ISO;
              const blocked = blockedSet.has(iso);
              const booked = bookedSet.has(iso);
              const open = days[weekdayOf(d)];
              const today = sameDay(d, TODAY);
              const state = past ? 'past' : booked ? 'booked gig' : blocked ? 'blocked' : open ? 'available' : 'off in weekly schedule';
              const bg = past ? 'transparent' : booked ? colors.brand : blocked ? colors.dangerBg : open ? colors.brandTint : 'transparent';
              const fg = past ? colors.disabled : booked ? colors.white : blocked ? colors.danger : open ? colors.ink : colors.subtle;
              return (
                <Pressable
                  key={iso}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.getDate()} ${MONTHS_LONG[d.getMonth()]}, ${state}`}
                  accessibilityHint={past || booked ? undefined : blocked ? 'Unblocks this date' : 'Blocks this date'}
                  accessibilityState={{ disabled: past, selected: blocked }}
                  disabled={past}
                  onPress={() => (booked ? toast(`You have a confirmed gig on ${shortDate(iso)}`) : toggleBlocked(iso))}
                  style={{ width: `${100 / 7}%`, height: 48, padding: 2 }}
                >
                  {({ pressed }) => (
                    <View style={{ flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: today ? 2 : 0, borderColor: colors.brand, opacity: pressed ? 0.75 : 1 }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: fg, textDecorationLine: blocked && !past ? 'line-through' : 'none' }}>{d.getDate()}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        <Row gap={14} style={{ flexWrap: 'wrap' }}>
          <LegendDot label="Available" bg={colors.brandTint} />
          <LegendDot label="Blocked" bg={colors.dangerBg} strike />
          <LegendDot label="Booked gig" bg={colors.brand} />
          <LegendDot label="Day off" bg={colors.surface} border={colors.borderStrong} />
        </Row>
        {upcomingBlocked.length ? (
          <View style={{ gap: 8 }}>
            <Row justify="space-between">
              <T v="label">Upcoming blocked dates</T>
              <Pressable accessibilityRole="button" accessibilityLabel="Unblock all upcoming dates" hitSlop={10} onPress={() => setAvailability({ blockedDates: blockedDates.filter((d) => d < TODAY_ISO) })}>
                <T v="smallBold" color={colors.brand}>Clear all</T>
              </Pressable>
            </Row>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {upcomingBlocked.map((iso) => (
                <Pressable
                  key={iso}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${shortDate(iso)}`}
                  onPress={() => toggleBlocked(iso)}
                  hitSlop={4}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingLeft: 12, paddingRight: 10, borderRadius: 20, backgroundColor: colors.dangerBg, opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.danger }}>{shortDate(iso)}</Text>
                  <Icon name="close" size={16} color={colors.danger} />
                </Pressable>
              ))}
            </Row>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard icon="cash-multiple" title="Booking fee" sub={`Per hour, in ${euro(FEE_STEP)} steps. Tap the amount to type it.`}>
        <FeeStepper value={feePerHour} onChange={(n) => setAvailability({ feePerHour: n })} />
        <Row gap={12} style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 14 }}>
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Minimum booking</T>
            <T v="small">{minHours} {minHours === 1 ? 'hour' : 'hours'} · bookers can’t request less</T>
          </View>
          <Stepper value={minHours} min={1} max={12} onChange={(n) => setAvailability({ minHours: n })} />
        </Row>
        <Banner icon="information-outline">
          {`A ${minHours} h booking pays ${euro(feePerHour * minHours)}. You receive ${euro(feePerHour * minHours * 0.9)} after the 10% Domtak fee.`}
        </Banner>
      </SectionCard>

      <SectionCard
        icon="map-marker-radius-outline"
        title={isVenue ? 'Booking radius' : 'Travel radius'}
        sub={isVenue ? 'Accept requests from organisers within this distance' : `How far you’ll travel from ${city.split(',')[0] || 'home'} for a gig`}
      >
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {RADII.map((km) => (
            <Chip key={km} label={`${km} km`} selected={radiusKm === km} onPress={() => setAvailability({ radiusKm: km })} />
          ))}
        </Row>
      </SectionCard>

      <Card style={{ gap: 10 }}>
        <Row gap={12}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: instantBook ? colors.gold : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="flash" size={20} color={instantBook ? colors.brandDark : colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="title">Instant book</T>
            <T v="small">{instantBook ? 'On · requests confirm automatically' : 'Off · you approve each request'}</T>
          </View>
          <Toggle label="Instant book" value={instantBook} onValueChange={(v) => setAvailability({ instantBook: v })} />
        </Row>
        <T v="small" color={colors.inkSoft}>
          Requests that match your open days, fee and minimum hours are confirmed right away — no 48 h approval wait. Payment is still held in escrow and released to you 24 h after the gig.
        </T>
        {instantBook ? <Banner icon="shield-check-outline" tone="success">Instant book is on. Keep blocked dates up to date so you’re never double-booked.</Banner> : null}
      </Card>
    </Screen>
  );
}
