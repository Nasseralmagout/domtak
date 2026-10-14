import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Banner, Button, Photo, Radio, Row, Stepper, T } from '../../components/ui';
import { venueById } from '../../data/mock';
import { euro, eventWhen } from '../../lib/format';
import { useApp, useEvent } from '../../store/useApp';
import { colors, fonts } from '../../theme';

export default function ChooseTicket() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const start = useApp((s) => s.startTicketCheckout);
  const firstAvailable = event?.ticketTypes.find((t) => t.sold < t.capacity)?.id;
  const [typeId, setTypeId] = useState(firstAvailable);
  const [qty, setQty] = useState(1);

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24 }}>
        <T v="h2">Event not found</T>
      </SafeAreaView>
    );
  }
  const type = event.ticketTypes.find((t) => t.id === typeId);
  const total = (type?.price ?? 0) * qty;
  const venue = venueById(event.venueId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 210 }}>
        <Photo src={event.cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <BackOverlay onPress={() => goBack(`/event/${event.id}`)} />
        </SafeAreaView>
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
          <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 26 }}>{event.title}</Text>
          <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>{eventWhen(event.start, event.end)} · {venue?.name}</Text>
        </View>
      </View>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <T v="h3">Choose your ticket</T>
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {event.ticketTypes.map((t) => {
            const soldOut = t.sold >= t.capacity;
            const on = t.id === typeId;
            const left = t.capacity - t.sold;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: soldOut }}
                disabled={soldOut}
                onPress={() => setTypeId(t.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: soldOut ? colors.chipIdle : on ? colors.brandTint : colors.surface }}
              >
                <Radio selected={on} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyBold" color={soldOut ? colors.subtle : colors.ink}>{t.name}</T>
                  <T v="small" color={soldOut ? colors.danger : colors.muted}>{soldOut ? 'Sold out' : t.description}{!soldOut && left < 40 ? ` · only ${left} left` : ''}</T>
                </View>
                <T v="h3" color={soldOut ? colors.subtle : colors.ink}>{t.price === 0 ? 'Free' : euro(t.price)}</T>
              </Pressable>
            );
          })}
        </View>
        <Row justify="space-between" style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}>
          <View>
            <T v="bodyBold">Quantity</T>
            <T v="small">Max 6 per order</T>
          </View>
          <Stepper value={qty} onChange={setQty} max={6} />
        </Row>
        <Banner icon="information-outline">{`${event.ageLimit ? `${event.ageLimit}+ event. ` : ''}${event.refundPolicy}. Each ticket gets its own QR code.`}</Banner>
      </View>
      <BottomBar>
        <Row gap={14}>
          <View>
            <T v="small">Total incl. tax</T>
            <T v="h2">{total === 0 ? 'Free' : euro(total, true)}</T>
          </View>
          <Button
            title={total === 0 ? 'Register' : 'Continue'}
            disabled={!type}
            style={{ flex: 1 }}
            onPress={() => {
              if (!type) return;
              start(event.id, type.id, qty);
              router.push('/checkout');
            }}
          />
        </Row>
      </BottomBar>
    </View>
  );
}
