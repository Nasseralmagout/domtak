import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Field, Icon, Row, T } from '../components/ui';
import { applyPromo } from '../lib/promos';
import { toast } from '../store/toast';
import { colors } from '../theme';

const FAQ = [
  { id: 'escrow', q: 'How does escrow protect my booking?', a: 'When a musician or venue accepts, you pay into Domtak escrow. The money is only released to them 24 hours after the event, and you can report a problem for up to 48 hours after it. If they cancel, you get a full refund.' },
  { id: 'refunds', q: 'When do I get my refund?', a: 'Refunds go back to your original payment method within 3–5 business days. Ticket refunds follow the organizer’s policy shown on the event page.' },
  { id: 'receipts', q: 'Where are my receipts?', a: 'Receipts are emailed after each payment. You can also open any paid booking under Your bookings and tap “View receipt”.' },
  { id: 'disputes', q: 'Something went wrong at my event', a: 'Open the booking and tap “Report a problem”. Report within 48 hours; if the payment hasn’t been released yet it stays frozen while we review evidence from both sides. Escrow releases payments 24 hours after the event, so the sooner you report, the better.' },
  { id: 'tickets', q: 'My QR code won’t scan', a: 'Turn your screen brightness up and make sure the ticket says “Valid”. Door staff can also type the 8-character code under the QR.' },
  { id: 'safety', q: 'How do I block or report someone?', a: 'Open their profile or chat, tap ••• and choose Block or Report. Blocked users can’t message you or see your posts.' },
  { id: 'promo', q: 'How do promo codes work?', a: 'Check a code below, then enter it in the Promo code box at ticket checkout. Codes work on any paid ticket and come off the ticket price; the service fee stays the same.' },
];

/** Where each answer can take you next. */
const FAQ_LINKS: Record<string, { label: string; href: string }> = {
  escrow: { label: 'Your bookings', href: '/my-bookings?tab=musician' },
  refunds: { label: 'Your tickets', href: '/my-bookings?tab=tickets' },
  receipts: { label: 'Your bookings', href: '/my-bookings?tab=musician' },
  disputes: { label: 'Your bookings', href: '/my-bookings?tab=musician' },
  tickets: { label: 'Your tickets', href: '/my-bookings?tab=tickets' },
  safety: { label: 'Blocked accounts', href: '/blocked' },
};

const SUPPORT_EMAIL = 'support@domtak.de';

function openMail(address: string) {
  Linking.openURL(`mailto:${address}`).catch(() => toast(`Email us at ${address}`));
}

export default function Help() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [open, setOpen] = useState<string | undefined>(section);
  const [promo, setPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string }>();

  // Deep links (e.g. "View refund details") open the matching answer, also when this screen is reused.
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) {
    setLastSection(section);
    if (section && FAQ.some((f) => f.id === section)) setOpen(section);
  }

  if (section === 'about') {
    return (
      <Screen header={<ScreenHeader title="About Domtak" onBack={() => goBack('/menu')} />}>
        <T v="h2">Music-first social platform</T>
        <T v="body">Domtak connects musicians, event organizers, venues and fans in Berlin and beyond: social networking, ticketing and talent booking in one app.</T>
        <Card style={{ gap: 6 }}>
          <T v="bodyBold">Domtak · Artifexea GmbH</T>
          <T v="small">Berlin, Germany</T>
          <Pressable accessibilityRole="link" accessibilityLabel="Email yourcareer@domtak.de" onPress={() => openMail('yourcareer@domtak.de')} hitSlop={12}>
            <T v="smallBold" color={colors.brand}>yourcareer@domtak.de</T>
          </Pressable>
        </Card>
        <T v="small">Terms of service and privacy policy apply. Version 1.0.0.</T>
        <Button title="Help & support" variant="secondary" icon="lifebuoy" onPress={() => router.replace('/help')} />
      </Screen>
    );
  }

  const check = () => {
    if (!promo.trim()) return setPromoMsg({ ok: false, text: 'Enter a code first.' });
    // Same codes as ticket checkout; checking without a basket just tells whether the code is valid.
    const valid = applyPromo(promo, 0);
    if (valid) setPromoMsg({ ok: true, text: `${valid.code} is valid: ${valid.label}. Enter it at ticket checkout.` });
    else setPromoMsg({ ok: false, text: 'That code isn’t valid. Check the spelling or expiry date.' });
  };

  const showPromo = section === 'promo' || !section || !FAQ.some((f) => f.id === section);

  return (
    <Screen keyboard header={<ScreenHeader title={section === 'promo' ? 'Promo code' : 'Help & support'} onBack={() => goBack('/menu')} />}>
      {showPromo ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Have a promo code?</T>
          <Row gap={10} align="flex-start">
            <Field placeholder="e.g. BERLIN10" value={promo} onChangeText={(t) => { setPromo(t.toUpperCase()); setPromoMsg(undefined); }} autoCapitalize="characters" accessibilityLabel="Promo code" onSubmitEditing={check} style={{ flex: 1 }} />
            <Button title="Check" size="md" style={{ marginTop: 4 }} onPress={check} />
          </Row>
          {promoMsg ? (
            <Row gap={6} align="flex-start">
              <Icon name={promoMsg.ok ? 'check-circle-outline' : 'alert-circle-outline'} size={18} color={promoMsg.ok ? colors.success : colors.danger} />
              <T v="small" color={promoMsg.ok ? colors.success : colors.danger} style={{ flex: 1 }}>{promoMsg.text}</T>
            </Row>
          ) : null}
          {promoMsg?.ok ? <Button title="Find events" variant="light" size="sm" icon="ticket-outline" onPress={() => router.push('/events/all')} style={{ alignSelf: 'flex-start' }} /> : null}
        </Card>
      ) : null}
      <T v="h3" accessibilityRole="header">Frequently asked</T>
      {FAQ.map((f) => {
        const isOpen = open === f.id;
        const link = FAQ_LINKS[f.id];
        return (
          <View key={f.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: isOpen ? 1 : 0, borderColor: colors.brandSoft }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? undefined : f.id)} style={{ padding: 16, minHeight: 52 }}>
              <Row gap={10}>
                <T v="bodyBold" style={{ flex: 1 }}>{f.q}</T>
                <Icon name={isOpen ? 'minus' : 'plus'} size={20} color={colors.brand} />
              </Row>
            </Pressable>
            {isOpen ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
                <T v="body" color={colors.inkSoft}>{f.a}</T>
                {link ? <Button title={link.label} variant="light" size="sm" icon="arrow-right" onPress={() => router.push(link.href as never)} style={{ alignSelf: 'flex-start' }} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={{ gap: 10 }}>
        <Banner icon="email-outline">{`Still stuck? Our support team replies within 24 hours at ${SUPPORT_EMAIL}.`}</Banner>
        <Button title="Contact support" icon="email-outline" variant="secondary" onPress={() => openMail(SUPPORT_EMAIL)} />
      </View>
    </Screen>
  );
}
