import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { RecordRow } from '../components/admin';
import { DemoBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Divider, Field, Icon, Row, T } from '../components/ui';
import { ago } from '../lib/format';
import { applyPromo } from '../lib/promos';
import { byLastUpdate, CASE_STATUS_LABEL, CASE_STATUS_TONE, lastUpdate } from '../lib/support';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

const FAQ = [
  {
    id: 'payments',
    q: 'How does paying for a booking work?',
    a: 'When you send a request, your payment is pending the provider’s decision. They have 24 hours to accept or decline, and we remind them after 12 hours. If they decline or don’t answer in time, the payment is released or refunded. When they accept, we finalize the payment, and the booking is confirmed only once that payment is verified.',
  },
  {
    id: 'refunds',
    q: 'When do I get my refund?',
    a: 'A refund or release starts when a request closes without a booking, or when a cancellation qualifies under the booking’s policy. It is complete only once the payment provider confirms it; until then the booking shows “Refund pending” or “Release pending”. Ticket refunds follow the policy on the event page.',
  },
  { id: 'receipts', q: 'Where are my receipts?', a: 'Open any paid booking under Your bookings to see the itemised price, the payment state and its reference. Ticket purchases are listed under Your tickets.' },
  {
    id: 'disputes',
    q: 'Something went wrong at my event',
    a: 'Open the booking and tap “Report a problem” within 48 hours after the event. Support reviews evidence from both sides. The payment state stays visible while they look into it, and support can’t promise a refund before a decision.',
  },
  { id: 'tickets', q: 'My QR code won’t scan', a: 'Turn your screen brightness up and make sure the ticket says “Valid”. Door staff can also type the 8-character code under the QR. Cancelled, refunded and already used tickets are refused at the door.' },
  { id: 'safety', q: 'How do I block or report someone?', a: 'Open their profile or chat, tap ••• and choose Block or Report. Blocked users can’t message you or see your posts. Moderators review every report, and the account you report isn’t told who reported it.' },
  { id: 'cases', q: 'How do support cases work?', a: 'Open a case here or from a booking. You get a case reference such as DT-4821 and every reply appears in the case timeline. If you disagree with the outcome, you can appeal from the resolved case.' },
  { id: 'promo', q: 'How do promo codes work?', a: 'Check a code below, then enter it in the Promo code box at ticket checkout. Codes work on any paid ticket and come off the ticket price; the service fee stays the same.' },
];

/** Older links used ?section=escrow for the payments answer. */
const SECTION_ALIAS: Record<string, string> = { escrow: 'payments' };

/** Where each answer can take you next. */
const FAQ_LINKS: Record<string, { label: string; href: string }> = {
  payments: { label: 'Your bookings', href: '/my-bookings?tab=musician' },
  refunds: { label: 'Your bookings', href: '/my-bookings?tab=musician' },
  receipts: { label: 'Your bookings', href: '/my-bookings?tab=musician' },
  disputes: { label: 'Open a support case', href: '/support/new?topic=booking' },
  tickets: { label: 'Your tickets', href: '/my-bookings?tab=tickets' },
  safety: { label: 'Blocked accounts', href: '/blocked' },
  cases: { label: 'Your support cases', href: '/support' },
};

const SUPPORT_EMAIL = 'support@domtak.de';

function openMail(address: string) {
  Linking.openURL(`mailto:${address}`).catch(() => toast(`Email us at ${address}`));
}

export default function Help() {
  const params = useLocalSearchParams<{ section?: string }>();
  const section = params.section ? (SECTION_ALIAS[params.section] ?? params.section) : undefined;
  const [open, setOpen] = useState<string | undefined>(section);
  const [promo, setPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string }>();
  const cases = useApp((s) => s.supportCases);
  const adminMode = useApp((s) => s.adminMode);
  const setAdminMode = useApp((s) => s.setAdminMode);

  const recent = useMemo(() => [...cases].sort(byLastUpdate).slice(0, 3), [cases]);
  const active = useMemo(() => cases.filter((c) => c.status !== 'resolved').length, [cases]);
  const replies = useMemo(() => cases.filter((c) => c.status === 'waiting').length, [cases]);

  // Deep links (e.g. "Refund details") open the matching answer, also when this screen is reused.
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) {
    setLastSection(section);
    if (section && FAQ.some((f) => f.id === section)) setOpen(section);
  }

  if (section === 'about') {
    return (
      <Screen header={<ScreenHeader title="About Domtak" onBack={() => goBack('/menu')} />}>
        <T v="h2">Music-first social platform</T>
        <T v="body">Domtak connects musicians, event organizers, venues and fans in Berlin and beyond: music communities, private and public events, tickets and artist and venue bookings in one app.</T>
        <Card style={{ gap: 6 }}>
          <T v="bodyBold">Domtak · Artifexea GmbH</T>
          <T v="small">Berlin, Germany</T>
          <Pressable accessibilityRole="link" accessibilityLabel="Email yourcareer@domtak.de" onPress={() => openMail('yourcareer@domtak.de')} hitSlop={12}>
            <T v="smallBold" color={colors.brand}>yourcareer@domtak.de</T>
          </Pressable>
        </Card>
        <T v="small">Terms of service and privacy policy apply. Version 1.0.0.</T>
        <Button title="Terms, privacy & imprint" variant="secondary" icon="text-box-outline" onPress={() => router.push('/legal')} />
        <Button title="Help & support" variant="ghost" icon="lifebuoy" onPress={() => router.replace('/help')} />
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

  const promoOnly = section === 'promo';
  const showPromo = promoOnly || !section || !FAQ.some((f) => f.id === section);

  const openAdmin = () => {
    if (!adminMode) {
      setAdminMode(true);
      toast('Admin console (demo) is on');
    }
    router.push('/admin');
  };

  const supportCard = (
    <Card style={{ gap: 12 }}>
      <Row gap={12}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lifebuoy" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="title" accessibilityRole="header">Contact support</T>
          <T v="small">Link a booking, ticket or event so we can find it, and follow every reply in one place.</T>
        </View>
      </Row>
      <Row gap={10}>
        <Button title="New case" icon="plus" size="md" style={{ flex: 1 }} onPress={() => router.push('/support/new')} />
        <Button title={active ? `My cases · ${active}` : 'My cases'} icon="inbox-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/support')} />
      </Row>
      {replies ? (
        <Banner icon="message-text-outline" tone="warning">{`Support replied on ${replies === 1 ? 'one case' : `${replies} cases`}. Open it to answer or confirm it’s solved.`}</Banner>
      ) : null}
      {recent.length ? (
        <View>
          {recent.map((c, i) => (
            <View key={c.id}>
              {i ? <Divider /> : null}
              <RecordRow
                icon="file-document-outline"
                title={c.topic}
                sub={`${c.ref} · updated ${ago(lastUpdate(c))}`}
                pill={CASE_STATUS_LABEL[c.status]}
                tone={CASE_STATUS_TONE[c.status]}
                onPress={() => router.push(`/support/${c.id}`)}
              />
            </View>
          ))}
        </View>
      ) : (
        <T v="small">You haven’t opened any support cases.</T>
      )}
    </Card>
  );

  return (
    <Screen keyboard header={<ScreenHeader title={promoOnly ? 'Promo code' : 'Help & support'} onBack={() => goBack('/menu')} />}>
      {promoOnly ? null : supportCard}
      {promoOnly ? null : (
        <Banner icon="alert-octagon-outline" tone="danger">Urgent safety problem at an event? Call 112 first, then tell the venue or organizer on site. Open a support case afterwards so we can follow up.</Banner>
      )}
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
        <Banner icon="email-outline">{`Prefer email? Write to ${SUPPORT_EMAIL} and include your booking or case reference so we can find it quickly.`}</Banner>
        <Button title="Email support" icon="email-outline" variant="secondary" onPress={() => openMail(SUPPORT_EMAIL)} />
      </View>
      {promoOnly ? null : (
        <DemoBar title="Demo: admin console" note="The proposed console where reviewers, support, finance and moderators work. It runs on the records in this app and every decision is written to the audit log.">
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title={adminMode ? 'Open admin console' : 'Open admin console (demo)'} size="sm" icon="shield-account-outline" onPress={openAdmin} />
            {adminMode ? (
              <Button
                title="Turn off admin console"
                size="sm"
                variant="secondary"
                onPress={() => {
                  setAdminMode(false);
                  toast('Admin console (demo) is off');
                }}
              />
            ) : null}
          </Row>
        </DemoBar>
      )}
    </Screen>
  );
}
