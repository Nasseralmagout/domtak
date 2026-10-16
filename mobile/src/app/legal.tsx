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
      'Everyone starts with a member account: discover music, join communities, create private events, buy tickets and book artists or venues. Members share photos inside comments.',
      'Artists, bands, DJs, venues and organizers apply for a professional account, and our team reviews each application before access is granted. Only approved organizers publish public events, and feed posts and stories are for approved professional accounts.',
    ],
  },
  {
    title: '2. Bookings and payments',
    body: [
      'Each booking is with one provider and has its own response deadline and payment record. When you send a request, your payment is pending the provider’s decision.',
      'The provider has 24 hours to accept or decline, and we remind them after 12 hours. If they decline or don’t answer in time, the payment is released or refunded.',
      'Acceptance alone doesn’t confirm a booking: it is confirmed only once the payment is verified. Agreed terms stay the same if the provider changes their prices later.',
      'Cancellations, refunds, no-shows and disputes follow the policy shown on the booking. A refund request is not a completed refund; it completes when the payment provider confirms it.',
    ],
  },
  {
    title: '3. Tickets and invitations',
    body: [
      'Every ticket has its own QR code and is checked once at the door. Cancelled, refunded and already used tickets are refused. Refunds follow the policy on the event page.',
      'Private events can use cost sharing: a guest’s ticket is issued once their contribution payment succeeds. A failed payment never issues a ticket.',
      'Organizers and hosts are responsible for their events, line-ups and refund policies.',
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
      'Post only content you have the rights to. No harassment, hate, scams or spam. You can block and report anyone.',
      'Moderators review reports against these rules and can dismiss a report, restrict content or remove it. The reported account isn’t told who reported it and can appeal a decision through Help.',
    ],
  },
  {
    title: '6. Support',
    body: ['Open a support case from Help or from a booking. Each case has a reference and a timeline of every reply, and you can appeal its outcome. Support can’t promise a refund before an authorized decision.'],
  },
];

const PRIVACY: Section[] = [
  {
    title: 'What we collect',
    body: [
      'Account details (name, email, phone, workspace), your profile, posts, comments and photos, bookings, tickets and messages.',
      'Professional applications and the details you submit for review, support cases and reports you file.',
      'Your location only while you use Nearby or the map, and only if you allow it.',
    ],
  },
  {
    title: 'Payments',
    body: ['Card details go straight to our payment provider and are tokenised. Domtak never stores your full card number.'],
  },
  {
    title: 'Why we use it',
    body: ['To run your account, review professional applications, process bookings, tickets, refunds and payouts through our payment provider, prevent fraud and abuse, and show events near you.'],
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
    body: [
      'Your profile, posts, comments, photos, friends and messages until you delete your account.',
      'Booking, payment, refund, payout and ticket records for the period German tax and commercial law requires, also after you delete your account.',
      'Support cases and moderation decisions under our retention policy, so decisions stay traceable.',
    ],
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
  // A new ?tab= (e.g. "Privacy" from another screen while this one is open) switches the tab.
  const [lastParam, setLastParam] = useState(params.tab);
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (params.tab) setTab(asTab(params.tab));
  }
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
