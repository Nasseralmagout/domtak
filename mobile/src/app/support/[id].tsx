import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ReasonSheet } from '../../components/ActionSheet';
import { DemoBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Field, Icon, PaymentPill, Pill, Row, StatusPill, T } from '../../components/ui';
import { PAYMENT_NOTE } from '../../lib/booking';
import { dateTime, euro } from '../../lib/format';
import { CASE_STATUS_LABEL, CASE_STATUS_TONE, lastMessage, linkedRecord, pendingMoney } from '../../lib/support';
import { toast } from '../../store/toast';
import { useAllEvents, useApp, useInvitedEvents } from '../../store/useApp';
import { colors, radius } from '../../theme';

const APPEAL_REASONS = ['The problem isn’t fixed', 'I disagree with the decision', 'I have new information', 'Other'];

const NEXT_STEP = {
  open: 'Support has your case and replies here.',
  waiting: 'Support replied. Answer their question, or mark the case as solved.',
  resolved: 'Support resolved this case. You can appeal if you disagree.',
} as const;

const DEMO_ASK = 'Thanks for the details. Could you tell us when it happened and add anything the other side said in chat?';
const DEMO_RESOLVE = 'We looked into this with both sides and recorded the outcome on the linked record. If anything is still wrong, reply here or appeal.';

export default function SupportCaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useApp((s) => s.supportCases.find((x) => x.id === id));
  const bookings = useApp((s) => s.bookings);
  const tickets = useApp((s) => s.tickets);
  const adminMode = useApp((s) => s.adminMode);
  const replyCase = useApp((s) => s.replyCase);
  const answerCase = useApp((s) => s.answerCase);
  const closeCase = useApp((s) => s.closeCase);
  const allEvents = useAllEvents();
  const invited = useInvitedEvents();
  const [text, setText] = useState('');
  const [supportText, setSupportText] = useState('');
  const [appeal, setAppeal] = useState(false);

  const events = useMemo(() => [...allEvents, ...invited.map((x) => x.event)], [allEvents, invited]);

  if (!c) {
    return (
      <Screen header={<ScreenHeader title="Support case" onBack={() => goBack('/support')} />}>
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <Icon name="file-document-remove-outline" size={48} color={colors.subtle} />
          <T v="h3" center>Case not found</T>
          <T v="body" color={colors.muted} center>It may have been opened on another device that hasn’t synced yet.</T>
          <Button title="My cases" size="md" onPress={() => router.replace('/support')} />
        </View>
      </Screen>
    );
  }

  const record = linkedRecord(c.linked, { bookings, tickets, events });
  const money = pendingMoney(c, bookings);
  const resolved = c.status === 'resolved';
  const resolution = resolved ? [...c.messages].reverse().find((m) => m.from === 'support') : undefined;
  const moneyWord = money?.payment === 'refund_pending' ? 'refund' : 'release';

  const send = () => {
    const t = text.trim();
    if (!t) return toast('Write a reply first');
    replyCase(c.id, t);
    setText('');
    toast('Reply sent to support');
  };

  const markSolved = () => {
    if (closeCase(c.id)) toast(`Case ${c.ref} marked as solved`);
    else toast(`This case stays open until the ${moneyWord} is complete`);
  };

  const supportReply = (resolve: boolean) => {
    if (resolve && money) return toast(`Can’t resolve: the ${moneyWord} on this booking isn’t complete`);
    answerCase(c.id, supportText.trim() || (resolve ? DEMO_RESOLVE : DEMO_ASK), resolve);
    setSupportText('');
    toast(resolve ? 'Support resolved the case' : 'Support replied');
  };

  return (
    <Screen keyboard header={<ScreenHeader title={`Case ${c.ref}`} subtitle={c.topic} onBack={() => goBack('/support')} />}>
      <Card style={{ gap: 10 }}>
        <Row justify="space-between" gap={8}>
          <Pill label={CASE_STATUS_LABEL[c.status]} tone={CASE_STATUS_TONE[c.status]} />
          <T v="small">Opened {dateTime(c.createdAt)}</T>
        </Row>
        <T v="h3">{c.topic}</T>
        <T v="body" color={colors.muted}>{NEXT_STEP[c.status]}</T>
      </Card>

      {record ? (
        <Card onPress={record.href ? () => router.push(record.href as never) : undefined} accessibilityLabel={`Linked record: ${record.label}`} style={{ gap: 10 }}>
          <T v="caption">LINKED RECORD</T>
          <Row gap={12}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={record.icon} size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold" numberOfLines={2}>{record.label}</T>
              <T v="small" numberOfLines={2}>{record.sub}</T>
            </View>
            {record.href ? <Icon name="chevron-right" size={20} color={colors.subtle} /> : null}
          </Row>
          {record.booking ? (
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <StatusPill booking={record.booking} />
              <PaymentPill state={record.booking.payment} />
            </Row>
          ) : null}
        </Card>
      ) : (
        <Banner icon="information-outline">No record linked. This case is handled by general account support.</Banner>
      )}

      {money ? (
        <Banner icon="cash-refund" tone="warning">
          {`A ${moneyWord} of ${euro(money.amount)} on this booking is still pending. ${money.payment ? PAYMENT_NOTE[money.payment] : ''} This case stays open until the payment provider confirms it.`}
        </Banner>
      ) : null}

      <View style={{ gap: 10 }}>
        <T v="h3" accessibilityRole="header">Timeline</T>
        <Row gap={8} justify="center">
          <Icon name="flag-outline" size={14} color={colors.subtle} />
          <T v="small">Case {c.ref} opened · {dateTime(c.createdAt)}</T>
        </Row>
        {c.messages.map((m, i) => {
          const mine = m.from === 'me';
          return (
            <View
              key={`${m.at}-${i}`}
              accessible
              accessibilityLabel={`${mine ? 'You' : 'Domtak support'}, ${dateTime(m.at)}: ${m.text}`}
              style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 4 }}
            >
              <T v="small" style={{ alignSelf: mine ? 'flex-end' : 'flex-start', fontSize: 12 }}>{mine ? 'You' : 'Domtak support'} · {dateTime(m.at)}</T>
              <View style={{ padding: 12, borderRadius: radius.lg, borderBottomRightRadius: mine ? 6 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 6, backgroundColor: mine ? colors.brand : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
                <T v="body" color={mine ? colors.white : colors.ink}>{m.text}</T>
              </View>
            </View>
          );
        })}
        {resolved ? (
          <Row gap={8} justify="center">
            <Icon name="check-circle-outline" size={14} color={colors.success} />
            <T v="small" color={colors.success}>Resolved{lastMessage(c) ? ` · ${dateTime(lastMessage(c).at)}` : ''}</T>
          </Row>
        ) : null}
      </View>

      {resolved ? (
        <Card style={{ gap: 10 }}>
          <T v="title" accessibilityRole="header">Outcome</T>
          <T v="body" color={colors.inkSoft}>{resolution?.text ?? 'This case was marked as solved.'}</T>
          <T v="small">Not happy with the outcome? An appeal reopens the case with your reason so support reviews the decision again.</T>
          <Button title="Appeal this outcome" icon="scale-balance" variant="secondary" size="md" onPress={() => setAppeal(true)} />
          <Button title="Something new? Open another case" variant="ghost" size="sm" onPress={() => router.push('/support/new')} />
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <T v="title" accessibilityRole="header">Reply</T>
          <Field value={text} onChangeText={setText} multiline placeholder={c.status === 'waiting' ? 'Answer support’s question' : 'Add information for support'} accessibilityLabel="Your reply" />
          <Row gap={10}>
            <Button title="Mark as solved" variant="secondary" size="md" style={{ flex: 1 }} onPress={markSolved} />
            <Button title="Send" icon="send" size="md" style={{ flex: 1 }} onPress={send} />
          </Row>
          {money ? <T v="small">{`Marking it solved is possible once the ${moneyWord} is complete.`}</T> : null}
        </Card>
      )}

      {resolved ? null : (
        <DemoBar
          title={adminMode ? 'Admin console (demo): reply as support' : 'Demo: support’s reply'}
          note={money ? `Support can reply, but can’t resolve this case while the ${moneyWord} is pending. Finance completes it in the admin console.` : 'Simulates the support side so you can see replies and resolutions arrive. Leave the text empty to use a sample answer.'}
        >
          <Field value={supportText} onChangeText={setSupportText} multiline placeholder="Support’s answer (optional)" accessibilityLabel="Reply as support" />
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title="Reply as support" size="sm" icon="message-text-outline" onPress={() => supportReply(false)} />
            <Button title="Reply and resolve" size="sm" variant="secondary" icon="check" disabled={!!money} onPress={() => supportReply(true)} />
            {adminMode && money ? <Button title="Open finance queue" size="sm" variant="light" onPress={() => router.push(`/admin/finance?id=${money.id}`)} /> : null}
          </Row>
        </DemoBar>
      )}

      <ReasonSheet
        visible={appeal}
        title={`Appeal case ${c.ref}`}
        body="Tell us why. The case reopens and support reviews the decision again with your reason."
        reasons={APPEAL_REASONS}
        confirmLabel="Send appeal"
        notePlaceholder="What should we look at again?"
        noteRequired
        onSubmit={(reason, note) => {
          replyCase(c.id, `Appeal: ${reason}. ${note}`);
          toast('Appeal sent. The case is open again.');
        }}
        onClose={() => setAppeal(false)}
      />
    </Screen>
  );
}
