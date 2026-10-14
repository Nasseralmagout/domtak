import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Button, Card, EmptyState, Pill, Row, Segmented, T } from '../../components/ui';
import { profiles, transactions } from '../../data/mock';
import type { IncomingRequest } from '../../data/types';
import { euro } from '../../lib/format';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

export default function Requests() {
  const requests = useApp((s) => s.requests);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const balance = useApp((s) => s.balance);
  const [tab, setTab] = useState<'new' | 'accepted' | 'past'>('new');
  const counts = { new: requests.filter((r) => r.status === 'new').length, accepted: requests.filter((r) => r.status === 'accepted').length };
  const contactOf = (r: IncomingRequest) => profiles.find((p) => p.name === r.requester);
  const list = requests.filter((r) => (tab === 'past' ? r.status === 'past' || r.status === 'declined' : r.status === tab));

  // A completed gig's earnings stay in your available balance until you pay out (same rule as /pro/earnings).
  const inBalance = (r: IncomingRequest) => balance > 0 && transactions.some((t) => t.title === r.title && t.status === 'available');
  const chip = (r: IncomingRequest) =>
    r.status === 'new' ? (
      <Pill label={`Expires ${r.expires}`} tone="warning" />
    ) : r.status === 'accepted' ? (
      <Pill label="Paid · escrow" tone="success" />
    ) : r.status === 'declined' ? (
      <Pill label="Declined" tone="danger" />
    ) : inBalance(r) ? (
      <Pill label="Available" tone="success" />
    ) : (
      <Pill label="Paid out" tone="success" />
    );

  return (
    <Screen header={<ScreenHeader title="Booking requests" onBack={() => goBack('/pro/workspace')} />}>
      <Segmented dark options={[{ key: 'new', label: `New (${counts.new})` }, { key: 'accepted', label: `Accepted (${counts.accepted})` }, { key: 'past', label: 'Past' }]} value={tab} onChange={setTab} />
      {list.length === 0 ? (
        <EmptyState
          icon="inbox-arrow-down"
          title="Nothing here"
          body={tab === 'new' ? 'New booking requests from fans, organizers and venues appear here. Keep your availability up to date to get more.' : 'No requests in this list yet.'}
          action={tab === 'new' ? 'Edit availability' : undefined}
          onAction={() => router.push('/pro/availability')}
        />
      ) : null}
      {list.map((r) => {
        const contact = contactOf(r);
        // A counter offer stays open until the booker answers; once the request is decided it no longer applies.
        const counter = r.status === 'new' ? r.counterOffer : undefined;
        return (
        <Card key={r.id} style={{ gap: 12 }} accessibilityLabel={`${r.title} from ${r.requester}, ${euro(r.offer)}${counter !== undefined ? `, you countered with ${euro(counter)}` : ''}`} onPress={() => router.push(`/pro/request/${r.id}`)}>
          <Row gap={12}>
            <Avatar src={contact?.avatar} label={r.initials} size={44} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{r.requester}</T>
              <T v="small" style={{ fontSize: 12 }}>{r.requesterRole}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {chip(r)}
              {counter !== undefined ? <Pill label={`Counter ${euro(counter)}`} icon="swap-horizontal" tone="brand" /> : null}
            </View>
          </Row>
          <View style={{ gap: 2 }}>
            <T v="h3">{r.title}</T>
            <T v="small">{r.date} · {r.time} · {r.location.split(',')[0]}</T>
          </View>
          <Row justify="space-between" style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 }}>
            <View>
              <T v="small" style={{ fontSize: 12 }}>Offer</T>
              <T v="h3">{euro(r.offer)}</T>
            </View>
            {r.status === 'new' ? (
              <Row gap={8}>
                <Button title="Decline" variant="secondary" size="sm" accessibilityLabel={`Decline ${r.title}`} onPress={() => router.push({ pathname: '/pro/request/[id]', params: { id: r.id, decline: '1' } })} />
                <Button title="Review" size="sm" accessibilityLabel={`Review ${r.title}`} onPress={() => router.push(`/pro/request/${r.id}`)} />
              </Row>
            ) : r.status === 'accepted' && contact ? (
              <Button title="Open chat" icon="message-text-outline" variant="light" size="sm" accessibilityLabel={`Message ${r.requester}`} onPress={() => router.push(`/chat/${ensureConversation(contact.id)}`)} />
            ) : (
              <Button title="Details" variant="light" size="sm" accessibilityLabel={`Details for ${r.title}`} onPress={() => router.push(`/pro/request/${r.id}`)} />
            )}
          </Row>
        </Card>
        );
      })}
    </Screen>
  );
}
