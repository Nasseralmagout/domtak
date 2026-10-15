import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Banner, Card, Divider, Segmented, T } from '../components/ui';
import { toast } from '../store/toast';
import { colors } from '../theme';

type Tab = 'terms' | 'privacy' | 'imprint';
const asTab = (t?: string): Tab => (t === 'privacy' || t === 'imprint' ? t : 'terms');

type Section = { title: string; body: string[] };

// Plain-language summaries of the rules the app already follows. The binding legal text is still to be
// written by counsel; the bracketed fields are company details that only the operator can supply.
const TERMS: Section[] = [
  {
    title: '1. Your account',
    body: [
      'Keep your login details private; you are responsible for activity on your account. Some events are 18+ and the door team may ask for ID.',
      'Fans, musicians and DJs, venue owners and organizers each get the tools for their role. Pro features need verification and a Pro plan.',
    ],
  },
  {
    title: '2. Bookings and escrow',
    body: [
      'A booking request is free until the musician or venue accepts it. After acceptance you pay in the app and the money is held in escrow.',
      'Escrow releases the payment 24 hours after the event. You can report a problem for up to 48 hours after the event; while we review, money that has not been released stays frozen.',
      'Cancellations follow the policy shown on the booking. Declined and expired requests are never charged.',
    ],
  },
  {
    title: '3. Tickets',
    body: [
      'Every ticket has its own QR code and is checked once at the door. Refunds follow the policy on the event page.',
      'Organizers are responsible for their events, line ups and refund policies.',
    ],
  },
  {
    title: '4. Pro plan',
    body: [
      'Pro costs €9,99 per month or €89 per year. The first month is free and you can cancel any time before renewal at no charge.',
      'Booking fees: Domtak keeps 10% of each booking paid through the app.',
    ],
  },
  {
    title: '5. Community rules',
    body: [
      'Post only content you have the rights to. No harassment, hate, scams or spam. You can block and report anyone; reports are reviewed by our team.',
    ],
  },
];

const PRIVACY: Section[] = [
  {
    title: 'What we collect',
    body: [
      'Account details (name, email, phone, role), your profile and posts, bookings, tickets and messages.',
      'Your location only while you use Nearby or the map, and only if you allow it.',
    ],
  },
  {
    title: 'Payments',
    body: ['Card details go straight to our payment provider and are tokenised. Domtak never stores your full card number.'],
  },
  {
    title: 'Why we use it',
    body: ['To run your account, process bookings and tickets, keep payments safe in escrow, prevent fraud, and show events near you.'],
  },
  {
    title: 'Your rights (GDPR)',
    body: [
      'You can access, correct, export or delete your data at any time from Settings › Account & security, or by email.',
      'You can complain to the Berlin data protection authority (Berliner Beauftragte für Datenschutz und Informationsfreiheit).',
    ],
  },
  {
    title: 'How long we keep it',
    body: ['Account data until you delete your account. Payment and booking records for the period German tax law requires.'],
  },
];

const IMPRINT: [string, string][] = [
  ['Company', 'Artifexea GmbH'],
  ['Product', 'Domtak'],
  ['Address', '[STREET AND NUMBER], [POSTCODE] Berlin, Germany'],
  ['Managing director', '[NAME]'],
  ['Commercial register', 'Amtsgericht Berlin-Charlottenburg, [HRB NUMBER]'],
  ['VAT ID', '[DE VAT NUMBER]'],
  ['Email', 'yourcareer@domtak.de'],
];

function Sections({ items }: { items: Section[] }) {
  return (
    <Card style={{ gap: 14 }}>
      {items.map((s, i) => (
        <View key={s.title} style={{ gap: 6 }}>
          {i ? <Divider /> : null}
          <T v="title" accessibilityRole="header" style={{ marginTop: i ? 8 : 0 }}>{s.title}</T>
          {s.body.map((p) => (
            <T key={p} v="body" color={colors.inkSoft}>{p}</T>
          ))}
        </View>
      ))}
    </Card>
  );
}

export default function Legal() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(asTab(params.tab));
  const mail = () => Linking.openURL('mailto:yourcareer@domtak.de').catch(() => toast('Write to yourcareer@domtak.de'));

  return (
    <Screen header={<ScreenHeader title="Legal" subtitle="Last updated 1 October 2026" />}>
      <Segmented
        options={[
          { key: 'terms', label: 'Terms' },
          { key: 'privacy', label: 'Privacy' },
          { key: 'imprint', label: 'Imprint' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'terms' ? <Sections items={TERMS} /> : null}
      {tab === 'privacy' ? (
        <>
          <Sections items={PRIVACY} />
          <Pressable accessibilityRole="button" onPress={() => router.push('/account-security')} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <T v="bodyBold" color={colors.brand}>Export or delete my data</T>
          </Pressable>
        </>
      ) : null}
      {tab === 'imprint' ? (
        <Card style={{ gap: 10 }}>
          <T v="title" accessibilityRole="header">Impressum</T>
          {IMPRINT.map(([k, v]) => (
            <View key={k} style={{ gap: 2 }}>
              <T v="small">{k}</T>
              <T v="bodyBold">{v}</T>
            </View>
          ))}
          <Pressable accessibilityRole="link" accessibilityLabel="Email yourcareer@domtak.de" onPress={mail} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <T v="bodyBold" color={colors.brand}>Contact us by email</T>
          </Pressable>
        </Card>
      ) : null}
      <Banner icon="information-outline">Plain-language summary for the beta. The full legal text replaces it before launch.</Banner>
    </Screen>
  );
}
