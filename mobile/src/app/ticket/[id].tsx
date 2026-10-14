import { router, useLocalSearchParams } from 'expo-router';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../../components/layout';
import { Button, IconButton, Photo, Pill, Row, T } from '../../components/ui';
import { venueById } from '../../data/mock';
import { parse, time } from '../../lib/format';
import { useApp, useEvent } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Notch({ side }: { side: 'left' | 'right' }) {
  return <View style={{ position: 'absolute', [side]: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandDeep, top: -22 }} />;
}

export default function ETicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useApp((s) => s.tickets.find((t) => t.id === id));
  const event = useEvent(ticket?.eventId);

  if (!ticket || !event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDeep, padding: 24 }}>
        <T v="h2" color={colors.white}>Ticket not found</T>
      </SafeAreaView>
    );
  }
  const type = event.ticketTypes.find((t) => t.id === ticket.typeId);
  const d = parse(event.start);
  const payload = JSON.stringify({ t: ticket.id, e: event.id, c: ticket.code });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <Row style={{ paddingHorizontal: 8 }} justify="space-between">
        <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/my-bookings?tab=tickets')} />
        <IconButton name="share-variant-outline" label="Share ticket" color={colors.white} onPress={() => Share.share({ message: `My ticket for ${event.title}: ${ticket.code}` }).catch(() => {})} />
      </Row>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#F8F7FB', borderRadius: 18 }}>
          <View style={{ alignItems: 'center', padding: 20, gap: 12 }}>
            <Photo src={event.cover} style={{ width: 200, height: 150 }} radius={18} />
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#7A3BC0' }}>
              {event.title}
              {event.subtitle ? <Text style={{ fontSize: 15 }}> {event.subtitle}</Text> : null}
            </Text>
            <Pill label={ticket.status === 'valid' ? 'Valid' : ticket.status === 'used' ? 'Checked in' : 'Cancelled'} tone={ticket.status === 'valid' ? 'success' : ticket.status === 'used' ? 'neutral' : 'danger'} />
          </View>
          <View style={{ height: 2, backgroundColor: colors.brandDeep }}>
            <Notch side="left" />
            <Notch side="right" />
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <Row justify="space-between" align="flex-start">
              <View style={{ gap: 4 }}><T v="small" color={colors.ink}>Date</T><T v="bodyBold" color={colors.brandDeep}>{DAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} {d.getFullYear()}</T></View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}><T v="small" color={colors.ink}>Time</T><T v="bodyBold" color={colors.brandDeep}>Start {time(event.start)}</T></View>
            </Row>
            <Row justify="space-between" align="flex-start">
              <View style={{ gap: 4 }}><T v="small" color={colors.ink}>Venue</T><T v="bodyBold" color={colors.brandDeep}>{venueById(event.venueId)?.name}</T></View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}><T v="small" color={colors.ink}>Ticket</T><T v="bodyBold" color={colors.brandDeep}>{type?.name ?? 'Entry'} · No seat</T></View>
            </Row>
          </View>
          <View style={{ height: 2, backgroundColor: colors.brandDeep }}>
            <Notch side="left" />
            <Notch side="right" />
          </View>
          <View style={{ alignItems: 'center', padding: 20, gap: 10 }}>
            <T v="title">QR code</T>
            <View style={{ padding: 12, backgroundColor: colors.white, borderRadius: 12, opacity: ticket.status === 'valid' ? 1 : 0.3 }}>
              <QRCode value={payload} size={170} color={colors.brandDeep} backgroundColor={colors.white} />
            </View>
            <T v="smallBold" color={colors.muted} style={{ letterSpacing: 2 }}>{ticket.code}</T>
            <T v="small" center>Holder: {ticket.holder} · show this at the entrance</T>
          </View>
        </View>
      </View>
      <View style={{ padding: 24, paddingTop: 0 }}>
        <Button title="Add to calendar" variant="outlineLight" onPress={() => router.push('/(tabs)/calendar')} />
      </View>
    </SafeAreaView>
  );
}
