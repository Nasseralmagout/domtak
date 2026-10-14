import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Field, Icon, Row, T } from '../components/ui';
import { colors } from '../theme';

const FAQ = [
  { id: 'escrow', q: 'How does escrow protect my booking?', a: 'When a musician or venue accepts, you pay into Domtak escrow. The money is only released to them 24 hours after the event. If they cancel, you get a full refund.' },
  { id: 'refunds', q: 'When do I get my refund?', a: 'Refunds go back to your original payment method within 3–5 business days. Ticket refunds follow the organizer’s policy shown on the event page.' },
  { id: 'receipts', q: 'Where are my receipts?', a: 'Receipts are emailed after each payment and listed under Your bookings → booking details.' },
  { id: 'disputes', q: 'Something went wrong at my event', a: 'Open the booking and tap “Report a problem” within 48 hours. Funds stay frozen while our team reviews evidence from both sides.' },
  { id: 'tickets', q: 'My QR code won’t scan', a: 'Turn your screen brightness up and make sure the ticket says “Valid”. Door staff can also type the 8-character code under the QR.' },
  { id: 'safety', q: 'How do I block or report someone?', a: 'Open their profile, tap ••• and choose Block or Report. Blocked users can’t message you or see your posts.' },
  { id: 'promo', q: 'How do promo codes work?', a: 'Enter a promo code at checkout. Codes from organizers apply to their events only; Domtak codes apply to any ticket.' },
];

export default function Help() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [open, setOpen] = useState<string | undefined>(section);
  const [promo, setPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState<string>();

  if (section === 'about') {
    return (
      <Screen header={<ScreenHeader title="About Domtak" />}>
        <T v="h2">Music-first social platform</T>
        <T v="body">Domtak connects musicians, event organizers, venues and fans in Berlin and beyond — social networking, ticketing and talent booking in one app.</T>
        <Card style={{ gap: 6 }}>
          <T v="bodyBold">Domtak · Artifexea GmbH</T>
          <T v="small">Berlin, Germany</T>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL('mailto:yourcareer@domtak.de').catch(() => {})}><T v="smallBold" color={colors.brand}>yourcareer@domtak.de</T></Pressable>
        </Card>
        <T v="small">Terms of service and privacy policy apply. Version 1.0.0.</T>
      </Screen>
    );
  }

  return (
    <Screen keyboard header={<ScreenHeader title={section === 'promo' ? 'Promo code' : 'Help & support'} />}>
      {section === 'promo' || !section ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Have a promo code?</T>
          <Row gap={10}>
            <Field placeholder="e.g. BERLIN10" value={promo} onChangeText={(t) => setPromo(t.toUpperCase())} autoCapitalize="characters" style={{ flex: 1 }} />
            <Button title="Apply" size="md" onPress={() => setPromoMsg(promo.length >= 4 ? `${promo} saved — it will apply at your next checkout.` : 'That code doesn’t look right.')} />
          </Row>
          {promoMsg ? <T v="small" color={promo.length >= 4 ? colors.success : colors.danger}>{promoMsg}</T> : null}
        </Card>
      ) : null}
      <T v="h3">Frequently asked</T>
      {FAQ.map((f) => {
        const isOpen = open === f.id;
        return (
          <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? undefined : f.id)} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 }}>
            <Row gap={10}>
              <T v="bodyBold" style={{ flex: 1 }}>{f.q}</T>
              <Icon name={isOpen ? 'minus' : 'plus'} size={20} color={colors.brand} />
            </Row>
            {isOpen ? <T v="body" color={colors.inkSoft}>{f.a}</T> : null}
          </Pressable>
        );
      })}
      <View style={{ gap: 10 }}>
        <Banner icon="email-outline">Still stuck? Our support team replies within 24 hours.</Banner>
        <Button title="Contact support" icon="email-outline" variant="secondary" onPress={() => Linking.openURL('mailto:support@domtak.de').catch(() => {})} />
      </View>
    </Screen>
  );
}
