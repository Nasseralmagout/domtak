import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../../components/layout';
import { Button, Icon, type IconName, IconButton, Row, T } from '../../components/ui';
import { attendees } from '../../data/mock';
import { useApp, useEvent } from '../../store/useApp';
import { colors, fonts } from '../../theme';

type Result = { kind: 'ready' | 'valid' | 'used' | 'invalid'; title: string; sub: string };

const LOOK: Record<Result['kind'], { bg: string; iconBg: string; fg: string; icon: IconName; frame: string }> = {
  ready: { bg: colors.brandTint, iconBg: colors.brand, fg: colors.ink, icon: 'qrcode-scan', frame: colors.lilac },
  valid: { bg: colors.successBg, iconBg: colors.success, fg: '#14532D', icon: 'check', frame: '#4ADE80' },
  used: { bg: colors.warningBg, iconBg: colors.warningStrong, fg: '#7C2D12', icon: 'alert-circle-outline', frame: '#FB923C' },
  invalid: { bg: colors.dangerBg, iconBg: colors.danger, fg: '#7A1A12', icon: 'close', frame: '#F87171' },
};

export default function Scanner() {
  const { eventId = 'bunker7' } = useLocalSearchParams<{ eventId?: string }>();
  const event = useEvent(eventId);
  const tickets = useApp((s) => s.tickets);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [result, setResult] = useState<Result>({ kind: 'ready', title: 'Ready to scan', sub: 'Point the camera at the guest’s e-ticket QR code' });
  const [checked, setChecked] = useState<string[]>(() => attendees.filter((a) => a.checkedIn).map((a) => a.code));
  const lock = useRef(false);
  const count = checked.length;

  const validate = (raw: string) => {
    if (!raw.trim()) {
      setResult({ kind: 'ready', title: 'Enter a ticket ID', sub: 'Type the 4–8 character code printed under the QR' });
      return;
    }
    let code = raw.trim().toUpperCase();
    let forEvent: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { c?: string; e?: string };
      if (parsed.c) code = parsed.c.toUpperCase();
      forEvent = parsed.e;
    } catch {
      // plain code typed or printed on the ticket
    }
    const ticket = tickets.find((t) => t.code === code);
    const guest = attendees.find((a) => a.code === code);
    let next: Result;
    if ((forEvent && forEvent !== eventId) || (ticket && ticket.eventId !== eventId)) {
      next = { kind: 'invalid', title: 'Invalid ticket', sub: `This QR isn’t for ${event?.title ?? 'this event'}` };
    } else if (!ticket && !guest) {
      next = { kind: 'invalid', title: 'Ticket not found', sub: `No ticket with code ${code || '—'}` };
    } else if (checked.includes(code) || ticket?.status === 'used') {
      next = { kind: 'used', title: 'Already used', sub: `#${code} was already checked in tonight` };
    } else if (ticket?.status === 'cancelled') {
      next = { kind: 'invalid', title: 'Cancelled ticket', sub: 'This ticket was refunded' };
    } else {
      setChecked((c) => [...c, code]);
      next = { kind: 'valid', title: `Valid · ${guest?.name ?? ticket?.holder}`, sub: `${guest?.ticketType ?? 'Ticket'} · #${code}` };
    }
    setResult(next);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(next.kind === 'valid' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const look = LOOK[result.kind];
  const canScan = permission?.granted && Platform.OS !== 'web';
  // The demo button tries the next guest who hasn't been checked in yet.
  const demoCode = attendees.find((a) => !checked.includes(a.code))?.code ?? attendees[0].code;
  const reset = () => setResult({ kind: 'ready', title: 'Ready to scan', sub: 'Point the camera at the guest’s e-ticket QR code' });

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
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>Scan tickets</Text>
            <Text style={{ color: colors.lilac, fontFamily: fonts.body, fontSize: 12 }}>{event?.title ?? 'Event'} · Door A</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 }}>{count} in</Text>
          </View>
        </Row>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 }}>
          <View accessibilityLabel="Camera viewfinder" style={{ width: 250, height: 250 }}>
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
                {Platform.OS !== 'web' && !permission?.granted ? <Button title="Allow camera" size="sm" onPress={() => requestPermission()} /> : null}
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

        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
          <Row gap={14} style={{ padding: 14, borderRadius: 18, backgroundColor: look.bg }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: look.iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={look.icon} size={26} color={colors.white} />
            </View>
            <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
              <T v="h3" color={look.fg}>{result.title}</T>
              <T v="small" color={colors.inkSoft}>{result.sub}</T>
            </View>
          </Row>
          <Button title={result.kind === 'ready' ? `Try demo code ${demoCode}` : 'Scan next guest'} onPress={() => (result.kind === 'ready' ? validate(demoCode) : reset())} />
          <Button title="Guest list" variant="ghost" size="md" icon="account-group-outline" onPress={() => router.push(`/pro/attendees/${eventId}`)} />
        </View>
      </SafeAreaView>
    </View>
  );
}
