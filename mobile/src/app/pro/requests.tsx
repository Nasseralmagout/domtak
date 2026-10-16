import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { goBack, PermissionNotice, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, EmptyState, PaymentPill, Pill, Row, Segmented, T, TimeLeft } from '../../components/ui';
import { profiles } from '../../data/mock';
import type { IncomingRequest, QuoteStatus } from '../../data/types';
import { quoteState, REMINDER_HOURS, reminderDue, REQUEST_STATUS_LABEL, requestConflict, RESPONSE_HOURS, timeLeft } from '../../lib/booking';
import { euro, parse, plural } from '../../lib/format';
import { canAcceptBookings, useApp } from '../../store/useApp';
import { colors } from '../../theme';

type Tab = 'due' | 'accepted' | 'closed';

const deadlineMs = (r: IncomingRequest) => (r.deadline ? parse(r.deadline).getTime() : Number.MAX_SAFE_INTEGER);
/** Quote states in the provider's words (the customer sees "Quote received"). */
const PROVIDER_QUOTE_LABEL: Record<QuoteStatus, string> = { requested: 'Quote requested', sent: 'Quote sent', revised: 'Revised quote sent', accepted: 'Quote accepted', rejected: 'Quote declined', expired: 'Quote expired' };
const KIND_LABEL: Record<NonNullable<IncomingRequest['kind']>, string> = { performance: 'Performance', venue: 'Venue hire', lesson: 'Lesson' };

/** The price line a provider sees on a request card. */
function priceOf(r: IncomingRequest): { label: string; value: string } {
  if (r.pricing === 'quote') {
    if (!r.quote || r.quote.version === 0) return { label: 'Pricing', value: 'Quote requested' };
    return { label: `Your quote v${r.quote.version}`, value: euro(r.quote.total) };
  }
  return { label: 'Request total', value: euro(r.offer) };
}

export default function Requests() {
  const user = useApp((s) => s.user);
  const requests = useApp((s) => s.requests);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [tab, setTab] = useState<Tab>('due');

  const venueWorkspace = user.role === 'venue';
  // A venue answers venue-hire requests; artists answer performances and lessons.
  const mine = useMemo(() => requests.filter((r) => (venueWorkspace ? r.kind === 'venue' : r.kind !== 'venue')), [requests, venueWorkspace]);
  const due = useMemo(() => mine.filter((r) => r.status === 'new').sort((a, b) => deadlineMs(a) - deadlineMs(b)), [mine]);
  const accepted = useMemo(() => mine.filter((r) => r.status === 'accepted').sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? '')), [mine]);
  const closed = useMemo(() => mine.filter((r) => r.status === 'declined' || r.status === 'expired' || r.status === 'past').sort((a, b) => (b.isoDate ?? '').localeCompare(a.isoDate ?? '')), [mine]);

  if (!canAcceptBookings(user)) {
    const role = user.role === 'venue' || (user.approvedRoles.includes('venue') && !user.approvedRoles.includes('musician')) ? 'venue' : 'musician';
    return (
      <Screen header={<ScreenHeader title="Booking requests" onBack={() => goBack('/(tabs)')} />}>
        <PermissionNotice role={role} action="respond to booking requests" />
      </Screen>
    );
  }

  const list = tab === 'due' ? due : tab === 'accepted' ? accepted : closed;
  const reminders = due.filter((r) => reminderDue(r)).length;
  const contactOf = (r: IncomingRequest) => profiles.find((p) => p.name === r.requester);

  return (
    <Screen header={<ScreenHeader title="Booking requests" subtitle={venueWorkspace ? 'Venue workspace' : 'Artist workspace'} onBack={() => goBack('/pro/workspace')} />}>
      <Segmented
        dark
        options={[
          { key: 'due', label: `Due (${due.length})` },
          { key: 'accepted', label: `Accepted (${accepted.length})` },
          { key: 'closed', label: 'Closed' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'due' && due.length ? (
        <Banner icon="timer-sand" tone={reminders ? 'warning' : 'brand'}>
          {`${plural(due.length, 'request')} due, soonest deadline first. Next: ${timeLeft(due[0].deadline).toLowerCase() || 'no deadline'}. Each request has ${RESPONSE_HOURS} hours from arrival${reminders ? `; ${plural(reminders, 'reminder')} sent after ${REMINDER_HOURS} hours without a response` : ''}. Unanswered requests expire and the customer’s payment is released.`}
        </Banner>
      ) : null}

      {list.length === 0 ? (
        tab === 'due' ? (
          <EmptyState
            icon="inbox-arrow-down"
            title="No requests waiting"
            body={venueWorkspace ? 'Venue requests appear here with a 24-hour response window. A complete listing with prices, catering and security helps hosts choose you.' : 'Requests appear here with a 24-hour response window. Clear services, prices and availability help people book you.'}
            action={venueWorkspace ? 'Edit venue listing' : 'Services and pricing'}
            onAction={() => router.push(venueWorkspace ? '/pro/venue-listing' : '/pro/services')}
          />
        ) : (
          <EmptyState icon={tab === 'accepted' ? 'calendar-check' : 'archive-outline'} title={tab === 'accepted' ? 'No accepted requests' : 'Nothing closed yet'} body={tab === 'accepted' ? 'Requests you accept show here until the event, with their payment status.' : 'Declined, expired and completed requests show here.'} />
        )
      ) : null}

      {list.map((r) => {
        const contact = contactOf(r);
        const conflict = r.status === 'new' ? requestConflict(r, requests) : undefined;
        const q: QuoteStatus | undefined = r.quote ? (r.status === 'accepted' || r.status === 'past' ? 'accepted' : quoteState(r.quote)) : undefined;
        const price = priceOf(r);
        const reminded = reminderDue(r);
        return (
          <Card key={r.id} style={{ gap: 12 }} accessibilityLabel={`${r.title} from ${r.requester}, ${price.value}${r.status === 'new' ? `, ${timeLeft(r.deadline)}` : ''}`} onPress={() => router.push(`/pro/request/${r.id}`)}>
            <Row gap={12}>
              <Avatar src={contact?.avatar} label={r.initials} size={44} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{r.requester}</T>
                <T v="small" style={{ fontSize: 12 }}>{r.requesterRole}</T>
              </View>
              {r.status === 'new' ? <TimeLeft deadline={r.deadline} /> : r.status === 'accepted' ? <PaymentPill state={r.payment} provider /> : <Pill label={REQUEST_STATUS_LABEL[r.status]} tone={r.status === 'past' ? 'success' : r.status === 'declined' ? 'danger' : 'neutral'} />}
            </Row>
            <View style={{ gap: 2 }}>
              <T v="h3">{r.title}</T>
              <T v="small">{r.date} · {r.time} · {r.location.split(',')[0]} · {plural(r.guests, 'guest')}</T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {r.kind && r.kind !== 'performance' ? <Pill label={KIND_LABEL[r.kind]} tone="neutral" /> : null}
              {r.pricing === 'quote' ? <Pill label={q ? PROVIDER_QUOTE_LABEL[q] : 'Quote requested'} tone="brand" icon="file-document-outline" /> : null}
              {reminded ? <Pill label="Reminder sent" tone="warning" icon="bell-ring-outline" /> : null}
              {conflict ? <Pill label={`Clashes with ${conflict.title}`} tone="danger" icon="calendar-alert" /> : null}
              {r.status === 'past' || r.status === 'declined' || r.status === 'expired' ? <PaymentPill state={r.payment} provider /> : null}
            </View>
            <Row justify="space-between" style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 }}>
              <View>
                <T v="small" style={{ fontSize: 12 }}>{price.label}</T>
                <T v="h3">{price.value}</T>
              </View>
              {r.status === 'new' ? (
                <Row gap={8}>
                  <Button title="Decline" variant="secondary" size="sm" accessibilityLabel={`Decline ${r.title}`} onPress={() => router.push({ pathname: '/pro/request/[id]', params: { id: r.id, decline: '1' } })} />
                  <Button title={r.pricing === 'quote' && (!r.quote || r.quote.version === 0) ? 'Send quote' : 'Review'} size="sm" accessibilityLabel={`Review ${r.title}`} onPress={() => router.push(`/pro/request/${r.id}`)} />
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
