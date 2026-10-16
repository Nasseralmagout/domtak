import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet } from '../../components/ActionSheet';
import { DemoBar, goBack } from '../../components/layout';
import { Button, Icon, type IconName, IconButton, Row, T } from '../../components/ui';
import { attendees } from '../../data/mock';
import { hostsEvent } from '../../lib/eventHost';
import { eventState } from '../../lib/events';
import { shortDate, time } from '../../lib/format';
import { isUpcoming } from '../../store/filters';
import { toast } from '../../store/toast';
import { activeWorkspace, useAllEvents, useApp, useEvent } from '../../store/useApp';
import { colors, fonts, radius } from '../../theme';

/**
 * Door check-in (F22). Validates the ticket, the event and access rights, refuses wrong-event,
 * invalid, refunded and cancelled tickets with the reason, shows the previous check-in for a used
 * ticket, and records one check-in per valid ticket. Only the host or organizer of the event can scan.
 */

const NO_GUESTS: typeof attendees = [];

type Kind = 'ready' | 'valid' | 'used' | 'invalid';
type Result = { kind: Kind; title: string; sub: string };

const READY: Result = { kind: 'ready', title: 'Ready to scan', sub: 'Point the camera at the guest’s e-ticket QR code' };

const LOOK: Record<Kind, { bg: string; iconBg: string; fg: string; icon: IconName; frame: string }> = {
  ready: { bg: colors.brandTint, iconBg: colors.brand, fg: colors.ink, icon: 'qrcode-scan', frame: colors.lilac },
  valid: { bg: colors.successBg, iconBg: colors.success, fg: '#14532D', icon: 'check', frame: '#4ADE80' },
  used: { bg: colors.warningBg, iconBg: colors.warningStrong, fg: '#7C2D12', icon: 'alert-circle-outline', frame: '#FB923C' },
  invalid: { bg: colors.dangerBg, iconBg: colors.danger, fg: '#7A1A12', icon: 'close', frame: '#F87171' },
};

/** Ticket codes printed under the QR: 4 to 12 letters and digits. */
const CODE_FORMAT = /^[A-Z0-9]{4,12}$/;

function Blocked({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#120A24' }}>
      <Row style={{ paddingHorizontal: 8 }}>
        <IconButton name="close" label="Close scanner" color={colors.white} onPress={() => goBack('/pro/workspace')} />
        <Text style={{ flex: 1, color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>Scan tickets</Text>
      </Row>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield-lock-outline" size={44} color={colors.lilac} />
        </View>
        <T v="h2" color={colors.white} center>{title}</T>
        <T v="body" color={colors.lilacLight} center>{body}</T>
        <Button title={action} variant="outlineLight" size="md" onPress={onAction} />
      </View>
    </SafeAreaView>
  );
}

export default function Scanner() {
  const params = useLocalSearchParams<{ eventId?: string }>();
  const user = useApp((s) => s.user);
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const checkIns = useApp((s) => s.checkIns);
  const checkInLog = useApp((s) => s.checkInLog);
  const checkIn = useApp((s) => s.checkIn);
  const allEvents = useAllEvents();
  // Events this account may run entry for: its own, or (approved organizer workspace) the organizer’s events.
  const hosted = useMemo(() => allEvents.filter((e) => hostsEvent(e, user) && isUpcoming(e)).sort((a, b) => a.start.localeCompare(b.start)), [allEvents, user]);
  const eventId = params.eventId ?? hosted[0]?.id ?? '';
  const event = useEvent(eventId);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [picker, setPicker] = useState(false);
  const [result, setResult] = useState<Result>(READY);
  const lock = useRef(false);
  // The viewfinder shrinks on short screens so the result panel always fits.
  const { height } = useWindowDimensions();
  const finder = Math.round(Math.max(150, Math.min(230, height * 0.28)));

  // A different event starts with a clean result.
  const [shownFor, setShownFor] = useState(eventId);
  if (shownFor !== eventId) {
    setShownFor(eventId);
    setResult(READY);
  }

  // Same sample guest list as the Guest list screen; an event with no tickets sold has nobody to scan yet.
  const sold = event ? event.ticketTypes.reduce((n, t) => n + t.sold, 0) : 0;
  const guests = sold > 0 ? attendees : NO_GUESTS;
  const scanned = checkIns[eventId];
  const log = checkInLog[eventId];
  // Seed guests already inside plus everything scanned at this door (shared with the Guest list).
  const checked = useMemo(() => [...guests.filter((a) => a.checkedIn).map((a) => a.code), ...(scanned ?? [])], [guests, scanned]);
  const last = useMemo(() => {
    const entries = Object.entries(log ?? {}).sort((a, b) => b[1].localeCompare(a[1]));
    if (!entries.length) return undefined;
    const [code, at] = entries[0];
    const name = guests.find((a) => a.code === code)?.name ?? tickets.find((t) => t.code === code)?.holder ?? 'Guest';
    return { code, at, name };
  }, [log, guests, tickets]);

  const workspace = activeWorkspace(user);
  const listHref = workspace === 'organizer' ? '/pro/events' : '/my-events';

  if (!event) {
    return params.eventId ? (
      <Blocked title="Event not found" body="This event may have been removed. Pick one of your events to run entry." action="Your events" onAction={() => router.replace(listHref as never)} />
    ) : (
      <Blocked
        title="No event to check in"
        body={
          workspace === 'musician' || workspace === 'venue'
            ? 'Ticket scanning is for the host or organizer of an event and the staff they delegate. Artists and venues don’t get automatic access.'
            : 'You don’t host an upcoming event. Once you do, its entry opens here.'
        }
        action={workspace === 'organizer' ? 'Your events' : 'My events'}
        onAction={() => router.replace(listHref as never)}
      />
    );
  }
  if (!hostsEvent(event, user)) {
    return (
      <Blocked
        title="No entry access"
        body={`Only the host or organizer of ${event.title} and the staff they delegate can scan its tickets.`}
        action="View event"
        onAction={() => router.replace(`/event/${event.id}`)}
      />
    );
  }

  const cancelled = eventState(event, bookings) === 'cancelled';
  const titleOf = (id?: string) => allEvents.find((e) => e.id === id)?.title;

  const validate = (raw: string) => {
    if (!raw.trim()) {
      setResult({ kind: 'ready', title: 'Enter a ticket ID', sub: 'Type the code printed under the QR' });
      return;
    }
    let code = raw.trim().toUpperCase();
    let forEvent: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { c?: string; e?: string };
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.c === 'string') code = parsed.c.toUpperCase();
        if (typeof parsed.e === 'string') forEvent = parsed.e;
      }
    } catch {
      // A plain code typed in or printed on the ticket.
    }
    const ticket = tickets.find((t) => t.code === code && t.eventId === eventId) ?? tickets.find((t) => t.code === code);
    const guest = guests.find((a) => a.code === code);
    const previous = log?.[code] ?? (ticket?.eventId === eventId ? ticket.checkedInAt : undefined);
    let next: Result;
    if (!CODE_FORMAT.test(code)) {
      next = { kind: 'invalid', title: 'Invalid code', sub: 'This isn’t a Domtak ticket code. Refuse entry and ask for the e-ticket.' };
    } else if (cancelled) {
      next = { kind: 'invalid', title: 'Event cancelled', sub: `${event.title} was cancelled, so no ticket is valid for entry.` };
    } else if ((forEvent && forEvent !== eventId) || (ticket && ticket.eventId !== eventId && !guest)) {
      const other = titleOf(forEvent && forEvent !== eventId ? forEvent : ticket?.eventId);
      next = { kind: 'invalid', title: 'Wrong event', sub: `This ticket is for ${other ?? 'another event'}, not ${event.title}. Refuse entry.` };
    } else if (!ticket && !guest) {
      next = { kind: 'invalid', title: 'Ticket not found', sub: `No ticket with code ${code} for this event. Check the code or refuse entry.` };
    } else if (ticket?.status === 'refunded') {
      next = { kind: 'invalid', title: 'Refunded ticket', sub: `#${code} was refunded and is no longer valid. Refuse entry.` };
    } else if (ticket?.status === 'cancelled') {
      next = { kind: 'invalid', title: 'Cancelled ticket', sub: `#${code} was cancelled and is no longer valid. Refuse entry.` };
    } else if (checked.includes(code) || ticket?.status === 'used') {
      next = {
        kind: 'used',
        title: 'Already used',
        sub: previous ? `#${code} was checked in at ${time(previous)} on ${shortDate(previous)}. One check-in per ticket.` : `#${code} was checked in earlier at this door. One check-in per ticket.`,
      };
    } else if (!checkIn(eventId, code)) {
      next = { kind: 'used', title: 'Already used', sub: `#${code} was just checked in. One check-in per ticket.` };
    } else {
      const at = useApp.getState().checkInLog[eventId]?.[code];
      const typeName = guest?.ticketType ?? event.ticketTypes.find((t) => t.id === ticket?.typeId)?.name ?? 'Ticket';
      next = { kind: 'valid', title: `Valid · ${guest?.name ?? ticket?.holder ?? 'Guest'}`, sub: `${typeName} · #${code}${at ? ` · checked in at ${time(at)}` : ''}` };
    }
    setResult(next);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(next.kind === 'valid' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const look = LOOK[result.kind];
  const canScan = permission?.granted && Platform.OS !== 'web';
  const count = checked.length;
  const reset = () => setResult(READY);

  // Labelled sample codes taken from real records, one per outcome the door can see.
  const samples: { label: string; code: string }[] = [];
  const nextGuest = guests.find((a) => !checked.includes(a.code))?.code ?? tickets.find((t) => t.eventId === eventId && t.status === 'valid' && !checked.includes(t.code))?.code;
  if (nextGuest) samples.push({ label: 'Valid', code: nextGuest });
  if (checked[0]) samples.push({ label: 'Already used', code: checked[0] });
  const otherEvent = tickets.find((t) => t.eventId !== eventId && !guests.some((a) => a.code === t.code));
  if (otherEvent) samples.push({ label: 'Other event', code: otherEvent.code });
  const changed = tickets.find((t) => t.eventId === eventId && (t.status === 'refunded' || t.status === 'cancelled'));
  if (changed) samples.push({ label: changed.status === 'refunded' ? 'Refunded' : 'Cancelled', code: changed.code });

  return (
    <View style={{ flex: 1, backgroundColor: '#120A24' }}>
      {canScan ? (
        <CameraView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (lock.current || result.kind !== 'ready') return;
            lock.current = true;
            validate(data);
            setTimeout(() => (lock.current = false), 1200);
          }}
        />
      ) : null}
      <SafeAreaView style={{ flex: 1 }}>
        <Row style={{ paddingHorizontal: 8 }} gap={4}>
          <IconButton name="close" label="Close scanner" color={colors.white} onPress={() => goBack('/pro/workspace')} />
          <Pressable
            accessibilityRole={hosted.length > 1 ? 'button' : undefined}
            accessibilityLabel={hosted.length > 1 ? `Scanning ${event.title}. Change event` : `Scanning ${event.title}`}
            disabled={hosted.length <= 1}
            onPress={() => setPicker(true)}
            style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>Scan tickets</Text>
            <Row gap={4}>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.lilac, fontFamily: fonts.body, fontSize: 12 }}>{event.title} · {shortDate(event.start)}</Text>
              {hosted.length > 1 ? <Icon name="chevron-down" size={16} color={colors.lilac} /> : null}
            </Row>
          </Pressable>
          <View accessibilityLabel={`${count} checked in${sold ? ` of ${sold} tickets` : ''}`} style={{ backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 }}>{count}{sold ? `/${sold}` : ''} in</Text>
          </View>
        </Row>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 }}>
          <View accessibilityLabel="Camera viewfinder" style={{ width: finder, height: finder }}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View
                key={c}
                style={{
                  position: 'absolute', width: 48, height: 48, borderColor: look.frame,
                  top: c[0] === 't' ? 0 : undefined, bottom: c[0] === 'b' ? 0 : undefined, left: c[1] === 'l' ? 0 : undefined, right: c[1] === 'r' ? 0 : undefined,
                  borderTopWidth: c[0] === 't' ? 5 : 0, borderBottomWidth: c[0] === 'b' ? 5 : 0, borderLeftWidth: c[1] === 'l' ? 5 : 0, borderRightWidth: c[1] === 'r' ? 5 : 0,
                  borderTopLeftRadius: c === 'tl' ? 18 : 0, borderTopRightRadius: c === 'tr' ? 18 : 0, borderBottomLeftRadius: c === 'bl' ? 18 : 0, borderBottomRightRadius: c === 'br' ? 18 : 0,
                }}
              />
            ))}
            {!canScan ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
                <Icon name="camera-outline" size={40} color={colors.lilac} />
                <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>
                  {Platform.OS === 'web' ? 'Camera scanning runs on the phone app. Enter codes below.' : 'Allow camera access to scan QR tickets.'}
                </Text>
                {Platform.OS !== 'web' && !permission?.granted ? (
                  <Button
                    title="Allow camera"
                    size="sm"
                    onPress={async () => {
                      const res = await requestPermission();
                      // Once access is denied for good the system won't ask again, so explain where to turn it on.
                      if (!res.granted) toast(res.canAskAgain ? 'Camera access is needed to scan tickets' : 'Camera is off for Domtak. Turn it on in system settings, or type codes below.');
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          <Row gap={12}>
            {canScan ? <IconButton name={torch ? 'flashlight-off' : 'flashlight'} label={torch ? 'Turn torch off' : 'Turn torch on'} selected={torch} color={colors.white} bg={torch ? colors.brand : 'rgba(255,255,255,0.14)'} size={52} onPress={() => setTorch(!torch)} /> : null}
            <View style={{ width: canScan ? 200 : 264, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
              <TextInput
                value={manual}
                onChangeText={setManual}
                placeholder="Enter ticket ID"
                placeholderTextColor={colors.lilac}
                autoCapitalize="characters"
                accessibilityLabel="Ticket ID"
                onSubmitEditing={() => { validate(manual); setManual(''); }}
                style={{ flex: 1, color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 }}
              />
              <IconButton name="chevron-right" label="Check ticket ID" color={colors.white} size={44} onPress={() => { validate(manual); setManual(''); }} />
            </View>
          </Row>
        </View>

        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
          {cancelled ? (
            <Row gap={8} style={{ padding: 10, borderRadius: radius.md, backgroundColor: colors.dangerBg }}>
              <Icon name="calendar-remove-outline" size={18} color={colors.danger} />
              <T v="small" color={colors.danger} style={{ flex: 1 }}>This event was cancelled. Every ticket is refused at the door.</T>
            </Row>
          ) : null}
          <Row gap={14} style={{ padding: 14, borderRadius: 18, backgroundColor: look.bg }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: look.iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={look.icon} size={26} color={colors.white} />
            </View>
            <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
              <T v="h3" color={look.fg}>{result.title}</T>
              <T v="small" color={colors.inkSoft}>{result.sub}</T>
            </View>
          </Row>
          {result.kind !== 'ready' ? <Button title="Scan next guest" onPress={reset} /> : null}
          {result.kind === 'ready' && !guests.length && !tickets.some((t) => t.eventId === eventId) ? (
            <T v="small" center>No tickets issued for this event yet, so there’s no one to check in.</T>
          ) : null}
          {last ? <T v="small" center>Last check-in: {last.name} · #{last.code} at {time(last.at)}</T> : null}
          {samples.length ? (
            <DemoBar title="Demo · try a sample code" style={{ padding: 10, gap: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {samples.map((s) => (
                  <Pressable
                    key={`${s.label}-${s.code}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Try sample code ${s.code}, ${s.label}`}
                    onPress={() => validate(s.code)}
                    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
                  >
                    <T v="smallBold">{s.label} · {s.code}</T>
                  </Pressable>
                ))}
              </ScrollView>
            </DemoBar>
          ) : null}
          <Button title="Guest list" variant="ghost" size="md" icon="account-group-outline" onPress={() => router.push(`/pro/attendees/${eventId}`)} />
        </View>
      </SafeAreaView>

      <ActionSheet
        visible={picker}
        title="Run entry for"
        onClose={() => setPicker(false)}
        actions={hosted.map((e) => ({
          label: e.title,
          sub: `${shortDate(e.start)} · ${time(e.start)}`,
          icon: e.id === eventId ? 'check' : 'calendar-outline',
          onPress: () => router.setParams({ eventId: e.id }),
        }))}
      />
    </View>
  );
}
