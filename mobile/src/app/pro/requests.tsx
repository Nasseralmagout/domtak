import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Button, Card, EmptyState, Pill, Row, Segmented, T } from '../../components/ui';
import type { IncomingRequest } from '../../data/types';
import { euro } from '../../lib/format';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

export default function Requests() {
  const requests = useApp((s) => s.requests);
  const [tab, setTab] = useState<'new' | 'accepted' | 'past'>('new');
  const counts = { new: requests.filter((r) => r.status === 'new').length };
  const list = requests.filter((r) => (tab === 'past' ? r.status === 'past' || r.status === 'declined' : r.status === tab));

  const chip = (r: IncomingRequest) =>
    r.status === 'new' ? <Pill label={`Expires ${r.expires}`} tone="warning" /> : r.status === 'accepted' ? <Pill label="Paid · escrow" tone="success" /> : r.status === 'declined' ? <Pill label="Declined" tone="danger" /> : <Pill label="Paid out" tone="success" />;

  return (
    <Screen header={<ScreenHeader title="Booking requests" />}>
      <Segmented dark options={[{ key: 'new', label: `New (${counts.new})` }, { key: 'accepted', label: 'Accepted' }, { key: 'past', label: 'Past' }]} value={tab} onChange={setTab} />
      {list.length === 0 ? <EmptyState icon="inbox-arrow-down" title="Nothing here" body={tab === 'new' ? 'New booking requests from fans, organizers and venues appear here.' : 'No requests in this list yet.'} /> : null}
      {list.map((r) => (
        <Card key={r.id} style={{ gap: 12 }} onPress={() => router.push(`/pro/request/${r.id}`)}>
          <Row gap={12}>
            <Avatar label={r.initials} size={44} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{r.requester}</T>
              <T v="small" style={{ fontSize: 12 }}>{r.requesterRole}</T>
            </View>
            {chip(r)}
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
                <Button title="Decline" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/pro/request/[id]', params: { id: r.id, decline: '1' } })} />
                <Button title="Review" size="sm" onPress={() => router.push(`/pro/request/${r.id}`)} />
              </Row>
            ) : (
              <Button title={r.status === 'accepted' ? 'Open chat' : 'Details'} variant="light" size="sm" onPress={() => router.push(`/pro/request/${r.id}`)} />
            )}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
