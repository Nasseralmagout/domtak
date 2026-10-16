import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Button, EmptyState, Icon, IconButton, Pill, Row, Segmented, T } from '../../components/ui';
import { ago } from '../../lib/format';
import { byLastUpdate, CASE_STATUS_LABEL, CASE_STATUS_TONE, lastMessage, lastUpdate, linkedRecord, pendingMoney } from '../../lib/support';
import { useAllEvents, useApp, useInvitedEvents } from '../../store/useApp';
import { colors, shadow } from '../../theme';

type Tab = 'active' | 'resolved';

export default function SupportCases() {
  const cases = useApp((s) => s.supportCases);
  const bookings = useApp((s) => s.bookings);
  const tickets = useApp((s) => s.tickets);
  const allEvents = useAllEvents();
  const invited = useInvitedEvents();
  const [tab, setTab] = useState<Tab>('active');

  const events = useMemo(() => [...allEvents, ...invited.map((x) => x.event)], [allEvents, invited]);
  const sorted = useMemo(() => [...cases].sort(byLastUpdate), [cases]);
  const active = sorted.filter((c) => c.status !== 'resolved');
  const resolved = sorted.filter((c) => c.status === 'resolved');
  const list = tab === 'active' ? active : resolved;

  return (
    <Screen
      header={
        <ScreenHeader
          title="My support cases"
          subtitle={cases.length ? `${active.length} active · ${resolved.length} resolved` : undefined}
          onBack={() => goBack('/help')}
          right={<IconButton name="plus" label="New support case" color={colors.brand} onPress={() => router.push('/support/new')} />}
        />
      }
    >
      {cases.length ? (
        <>
          <Segmented
            options={[
              { key: 'active', label: `Active · ${active.length}` },
              { key: 'resolved', label: `Resolved · ${resolved.length}` },
            ]}
            value={tab}
            onChange={setTab}
          />
          {list.length ? (
            list.map((c) => {
              const last = lastMessage(c);
              const record = linkedRecord(c.linked, { bookings, tickets, events });
              const money = pendingMoney(c, bookings);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Case ${c.ref}, ${c.topic}, ${CASE_STATUS_LABEL[c.status]}`}
                  onPress={() => router.push(`/support/${c.id}`)}
                  style={({ pressed }) => ({ padding: 16, gap: 8, borderRadius: 18, backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1, ...shadow(1) })}
                >
                  <Row justify="space-between" gap={8}>
                    <T v="smallBold" color={colors.muted}>{c.ref}</T>
                    <Pill label={CASE_STATUS_LABEL[c.status]} tone={CASE_STATUS_TONE[c.status]} />
                  </Row>
                  <T v="bodyBold">{c.topic}</T>
                  {record ? (
                    <Row gap={6}>
                      <Icon name={record.icon} size={16} color={colors.brand} />
                      <T v="small" numberOfLines={1} style={{ flex: 1 }}>{record.label}</T>
                    </Row>
                  ) : null}
                  {last ? (
                    <T v="small" numberOfLines={2} color={colors.inkSoft}>
                      {last.from === 'support' ? 'Support: ' : 'You: '}
                      {last.text}
                    </T>
                  ) : null}
                  {money ? <Pill label={money.payment === 'refund_pending' ? 'Refund still pending' : 'Release still pending'} tone="warning" icon="cash-refund" /> : null}
                  <T v="small" style={{ fontSize: 12 }}>Updated {ago(lastUpdate(c))}</T>
                </Pressable>
              );
            })
          ) : (
            <EmptyState
              icon={tab === 'active' ? 'inbox-outline' : 'check-circle-outline'}
              title={tab === 'active' ? 'No active cases' : 'No resolved cases'}
              body={tab === 'active' ? 'Everything you reported has been resolved. Open a new case if something else comes up.' : 'Cases appear here once support resolves them. You can appeal a resolved case from its timeline.'}
              action={tab === 'active' ? 'New case' : undefined}
              onAction={tab === 'active' ? () => router.push('/support/new') : undefined}
            />
          )}
        </>
      ) : (
        <EmptyState icon="lifebuoy" title="No support cases" body="When you contact support, your case and every reply appear here with a case reference." action="New case" onAction={() => router.push('/support/new')} />
      )}
      {cases.length ? (
        <View style={{ alignItems: 'center' }}>
          <Button title="Help & FAQ" variant="ghost" size="md" icon="help-circle-outline" onPress={() => router.push('/help')} />
        </View>
      ) : null}
    </Screen>
  );
}
