import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AdminGate, QueuePanel, RecordRow } from '../../components/admin';
import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Divider, KeyValue, Pill, Row, T } from '../../components/ui';
import { WORKSPACE_LABEL } from '../../lib/access';
import { adminMetrics, applicationEntries, bookingExceptions, EXCEPTION_ICON, EXCEPTION_LABEL, EXCEPTION_TONE, FINANCE_STATE_LABEL, financeQueue, REPORT_KIND_LABEL } from '../../lib/admin';
import { PAYMENT_TONE, REMINDER_HOURS, RESPONSE_HOURS } from '../../lib/booking';
import { ago, dateTime, euro } from '../../lib/format';
import { PLATFORM_COMMISSION_RATE, SERVICE_FEE_RATE } from '../../lib/pricing';
import { byLastUpdate, CASE_QUEUE_LABEL, CASE_STATUS_TONE, lastUpdate, LINK_KIND_LABEL, pendingMoney } from '../../lib/support';
import { toast } from '../../store/toast';
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, ROLE_LABEL, useApp } from '../../store/useApp';
import { colors } from '../../theme';

const PREVIEW = 3;
const AUDIT_PREVIEW = 8;

export default function AdminDashboard() {
  const adminMode = useApp((s) => s.adminMode);
  const setAdminMode = useApp((s) => s.setAdminMode);
  const user = useApp((s) => s.user);
  const queue = useApp((s) => s.applicationQueue);
  const bookings = useApp((s) => s.bookings);
  const requests = useApp((s) => s.requests);
  const payouts = useApp((s) => s.payouts);
  const cases = useApp((s) => s.supportCases);
  const reports = useApp((s) => s.reports);
  const auditLog = useApp((s) => s.auditLog);
  const [allAudit, setAllAudit] = useState(false);

  const entries = useMemo(() => applicationEntries(user, queue), [user, queue]);
  const exceptions = useMemo(() => bookingExceptions(bookings, requests), [bookings, requests]);
  const finance = useMemo(() => financeQueue(bookings, requests, payouts, cases), [bookings, requests, payouts, cases]);
  const metrics = useMemo(() => adminMetrics(entries, bookings, requests, payouts), [entries, bookings, requests, payouts]);
  const openCases = useMemo(() => cases.filter((c) => c.status !== 'resolved').sort(byLastUpdate), [cases]);
  const openReports = useMemo(() => reports.filter((r) => r.status === 'open'), [reports]);

  if (!adminMode) return <AdminGate />;

  const toReview = entries.filter((e) => e.app.status === 'pending');
  const waitingOnApplicant = entries.filter((e) => e.app.status === 'info');
  const needsReply = openCases.filter((c) => c.status === 'open').length;
  const approvedPro = user.approvedRoles.filter((r) => r !== 'fan');

  const exit = () => {
    setAdminMode(false);
    toast('Admin console (demo) is off');
    goBack('/help');
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title="Admin console"
          subtitle="Demo · records in this app"
          onBack={() => goBack('/help')}
          right={<Button title="Exit" variant="ghost" size="sm" icon="logout" onPress={exit} accessibilityLabel="Exit admin console" />}
        />
      }
    >
      <Banner icon="shield-account-outline">Proposed console for reviewers, support, finance and moderators. Every number comes from records in this app, so an account with no activity shows zero.</Banner>

      <QueuePanel
        icon="file-document-multiple-outline"
        title="Approval queue"
        count={toReview.length}
        countLabel={toReview.length === 1 ? 'application to review' : 'applications to review'}
        tone="warning"
        note={waitingOnApplicant.length ? `${waitingOnApplicant.length} waiting on the applicant for more information.` : undefined}
        action="Review applications"
        onAction={() => router.push('/admin/applications')}
      >
        {[...toReview, ...waitingOnApplicant].slice(0, PREVIEW).map((e) => (
          <RecordRow
            key={e.id}
            icon="account-outline"
            title={`${e.name}${e.mine ? ' (this account)' : ''} · ${WORKSPACE_LABEL[e.app.role]}`}
            sub={`Submitted ${ago(e.app.submittedAt)} · ${e.reviewer ? `Reviewer: ${e.reviewer}` : 'Not assigned'}`}
            pill={APPLICATION_STATUS_LABEL[e.app.status]}
            tone={APPLICATION_STATUS_TONE[e.app.status]}
            onPress={() => router.push(`/admin/applications?id=${e.id}`)}
          />
        ))}
      </QueuePanel>

      <QueuePanel
        icon="calendar-alert"
        title="Booking exceptions"
        count={exceptions.length}
        countLabel={exceptions.length === 1 ? 'exception' : 'exceptions'}
        tone="danger"
        note="Expired requests, payment failures, disputes, date conflicts and change requests."
        action="Investigate bookings"
        onAction={() => router.push('/admin/bookings')}
      >
        {exceptions.slice(0, PREVIEW).map((x) => (
          <RecordRow
            key={x.id}
            icon={EXCEPTION_ICON[x.kind]}
            title={`${x.ref} · ${x.title}`}
            sub={x.sub}
            pill={EXCEPTION_LABEL[x.kind]}
            tone={EXCEPTION_TONE[x.kind]}
            onPress={() => router.push(x.bookingId ? `/admin/bookings?id=${x.bookingId}` : `/admin/bookings?request=${x.requestId}`)}
          />
        ))}
      </QueuePanel>

      <QueuePanel
        icon="bank-transfer"
        title="Finance queue"
        count={finance.length}
        countLabel={finance.length === 1 ? 'item to reconcile' : 'items to reconcile'}
        tone="warning"
        note="Pending captures, releases, refunds, payouts and disputed payments."
        action="Open finance queue"
        onAction={() => router.push('/admin/finance')}
      >
        {finance.slice(0, PREVIEW).map((f) => (
          <RecordRow
            key={f.id}
            icon="cash-multiple"
            title={`${f.ref} · ${f.title}`}
            sub={`${euro(f.amount)} · ${f.sub}`}
            pill={FINANCE_STATE_LABEL[f.state]}
            tone={f.state === 'processing' ? 'warning' : PAYMENT_TONE[f.state]}
            onPress={() => router.push(f.bookingId ? `/admin/finance?id=${f.bookingId}` : '/admin/finance')}
          />
        ))}
      </QueuePanel>

      <QueuePanel
        icon="flag-outline"
        title="Moderation"
        count={openReports.length}
        countLabel={openReports.length === 1 ? 'open report' : 'open reports'}
        tone="warning"
        note="Reported accounts, posts, comments, messages and events. Reporter identities stay hidden."
        action="Review reports"
        onAction={() => router.push('/admin/reports')}
      >
        {openReports.slice(0, PREVIEW).map((r) => (
          <RecordRow key={r.id} icon="flag-outline" title={`${REPORT_KIND_LABEL[r.kind]} · ${r.reason}`} sub={`Reported ${ago(r.at)}`} tone="warning" onPress={() => router.push('/admin/reports')} />
        ))}
      </QueuePanel>

      <QueuePanel
        icon="lifebuoy"
        title="Support cases"
        count={needsReply}
        countLabel={needsReply === 1 ? 'case needs a reply' : 'cases need a reply'}
        tone="brand"
        note={openCases.length - needsReply ? `${openCases.length - needsReply} waiting on the member.` : undefined}
        action="All support cases"
        onAction={() => router.push('/support')}
      >
        {openCases.slice(0, PREVIEW).map((c) => {
          const money = pendingMoney(c, bookings);
          const linked = !c.linked ? 'No record linked' : c.linked.kind === 'account' ? 'Account linked' : `${LINK_KIND_LABEL[c.linked.kind]} linked`;
          return (
            <RecordRow
              key={c.id}
              icon="file-document-outline"
              title={`${c.ref} · ${c.topic}`}
              sub={`${linked}${money ? ` · ${money.payment === 'refund_pending' ? 'refund' : 'release'} pending` : ''} · updated ${ago(lastUpdate(c))}`}
              pill={CASE_QUEUE_LABEL[c.status]}
              tone={CASE_STATUS_TONE[c.status]}
              onPress={() => router.push(`/support/${c.id}`)}
            />
          );
        })}
      </QueuePanel>

      <View style={{ gap: 10 }}>
        <T v="h3" accessibilityRole="header">Operational metrics</T>
        <T v="small">Time range: all records in this app. Each value shows its definition and the records it is based on.</T>
        {metrics.map((m) => (
          <Card key={m.label} style={{ gap: 4 }}>
            <Row justify="space-between" align="flex-start" gap={12}>
              <T v="title" style={{ flex: 1 }}>{m.label}</T>
              <T v="h3" color={m.value === '—' || m.value === 'Not defined' ? colors.subtle : colors.brand}>{m.value}</T>
            </Row>
            <T v="small">{m.definition}</T>
            <T v="smallBold" color={colors.muted}>{m.basis}</T>
          </Card>
        ))}
      </View>

      <Card style={{ gap: 10 }}>
        <T v="title" accessibilityRole="header">Users and roles</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Pill label={`${user.name} · ${user.handle}`} tone="neutral" icon="account-outline" />
          <Pill label={`Active: ${WORKSPACE_LABEL[user.role]}`} tone="brand" />
        </Row>
        <T v="small">{approvedPro.length ? `Approved professional workspaces: ${approvedPro.map((r) => ROLE_LABEL[r]).join(', ')}.` : 'Member account. No professional workspace approved yet.'}</T>
        <T v="small">Roles change only through an application decision. Direct role and policy edits are read-only here: who may approve them is still to be decided.</T>
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="title" accessibilityRole="header">Current configuration</T>
        <T v="small" style={{ marginBottom: 6 }}>Read-only. Existing bookings keep the terms that were agreed.</T>
        <KeyValue k="Provider response window" v={`${RESPONSE_HOURS} h`} />
        <KeyValue k="Reminder without a response" v={`after ${REMINDER_HOURS} h`} />
        <KeyValue k="Application review target" v="24 h" />
        <KeyValue k="Report a problem" v="up to 48 h after the event" />
        <KeyValue k="Service fee (demo)" v={`${Math.round(SERVICE_FEE_RATE * 100)}%`} />
        <KeyValue k="Platform commission" v={`${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`} />
      </Card>

      <Card style={{ gap: 8 }}>
        <T v="title" accessibilityRole="header">Audit history</T>
        {auditLog.length ? (
          (allAudit ? auditLog : auditLog.slice(0, AUDIT_PREVIEW)).map((a, i) => (
            <View key={a.id} style={{ gap: 2 }}>
              {i ? <Divider style={{ marginBottom: 8 }} /> : null}
              <T v="bodyBold">{a.action}</T>
              <T v="small">{a.target}</T>
              {a.note ? <T v="small" color={colors.inkSoft}>{a.note}</T> : null}
              <T v="small" style={{ fontSize: 12 }}>{a.actor} · {dateTime(a.at)}</T>
            </View>
          ))
        ) : (
          <T v="small">No decisions recorded yet. Every decision in this console appears here with who made it and when.</T>
        )}
        {auditLog.length > AUDIT_PREVIEW ? (
          <Button title={allAudit ? 'Show the latest only' : `Show all ${auditLog.length}`} variant="ghost" size="sm" onPress={() => setAllAudit(!allAudit)} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </Card>
    </Screen>
  );
}
