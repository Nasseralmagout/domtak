import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet, ReasonSheet } from '../../components/ActionSheet';
import { AdminGate } from '../../components/admin';
import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Checklist, Chip, Divider, EmptyState, Field, Pill, Row, Segmented, T } from '../../components/ui';
import type { ApplicationStatus } from '../../data/types';
import { WORKSPACE_LABEL } from '../../lib/access';
import { APPLICATION_GROUP, type ApplicationEntry, applicationEntries, missingRequired, requestableItems, requirementChecks } from '../../lib/admin';
import { ago, dateTime } from '../../lib/format';
import { toast } from '../../store/toast';
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, useApp } from '../../store/useApp';
import { colors, shadow } from '../../theme';

type Group = keyof typeof APPLICATION_GROUP;
type Decision = Exclude<ApplicationStatus, 'pending'>;

const REJECT_REASONS = [
  'We could not verify the identity or business',
  'We could not verify the work, venue or events listed',
  'It does not meet the requirements for this role',
  'Duplicate or suspicious application',
  'Other',
];

const GROUP_EMPTY: Record<Group, { title: string; body: string }> = {
  review: { title: 'Nothing to review', body: 'New professional applications appear here, oldest first.' },
  info: { title: 'No open information requests', body: 'Applications you send back for more information wait here until the applicant resubmits.' },
  decided: { title: 'No decisions yet', body: 'Approved and rejected applications appear here with the reviewer and reason.' },
};

function ApplicationCard({ e, onPress }: { e: ApplicationEntry; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${e.name}, ${WORKSPACE_LABEL[e.app.role]}, ${APPLICATION_STATUS_LABEL[e.app.status]}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1, ...shadow(1) })}
    >
      <Avatar src={e.avatar} size={48} label={e.name} />
      <View style={{ flex: 1, gap: 3 }}>
        <T v="bodyBold" numberOfLines={1}>{e.name}{e.mine ? ' (this account)' : ''}</T>
        <T v="small" numberOfLines={1}>{WORKSPACE_LABEL[e.app.role]} · {e.city}</T>
        <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>Submitted {ago(e.app.submittedAt)} · {e.reviewer ? `Reviewer: ${e.reviewer}` : 'Not assigned'}</T>
      </View>
      <Pill label={APPLICATION_STATUS_LABEL[e.app.status]} tone={APPLICATION_STATUS_TONE[e.app.status]} />
    </Pressable>
  );
}

export default function AdminApplications() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const adminMode = useApp((s) => s.adminMode);
  const user = useApp((s) => s.user);
  const queue = useApp((s) => s.applicationQueue);
  const decideApplication = useApp((s) => s.decideApplication);
  const reviewApplication = useApp((s) => s.reviewApplication);
  const [group, setGroup] = useState<Group>('review');
  const [sheet, setSheet] = useState<'approve' | 'reject'>();
  const [infoOpen, setInfoOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const entries = useMemo(() => applicationEntries(user, queue), [user, queue]);

  if (!adminMode) return <AdminGate title="Applications" />;

  const entry = id ? entries.find((e) => e.id === id) : undefined;

  // ---------- List ----------
  if (!id) {
    const counts = { review: 0, info: 0, decided: 0 } as Record<Group, number>;
    entries.forEach((e) => {
      (Object.keys(APPLICATION_GROUP) as Group[]).forEach((g) => {
        if (APPLICATION_GROUP[g].includes(e.app.status)) counts[g] += 1;
      });
    });
    const list = entries.filter((e) => APPLICATION_GROUP[group].includes(e.app.status));
    return (
      <Screen header={<ScreenHeader title="Applications" subtitle="Admin · demo" onBack={() => goBack('/admin')} />}>
        <Segmented
          options={[
            { key: 'review', label: `To review · ${counts.review}` },
            { key: 'info', label: `More info · ${counts.info}` },
            { key: 'decided', label: `Decided · ${counts.decided}` },
          ]}
          value={group}
          onChange={setGroup}
        />
        {list.length ? (
          list.map((e) => <ApplicationCard key={e.id} e={e} onPress={() => router.push(`/admin/applications?id=${e.id}`)} />)
        ) : (
          <EmptyState icon="file-document-outline" title={GROUP_EMPTY[group].title} body={GROUP_EMPTY[group].body} />
        )}
        <Banner icon="information-outline">The review target is 24 hours from submission. It is separate from the 24-hour booking response deadline.</Banner>
      </Screen>
    );
  }

  // ---------- Detail ----------
  if (!entry) {
    return (
      <Screen header={<ScreenHeader title="Application" onBack={() => goBack('/admin/applications')} />}>
        <EmptyState icon="file-document-remove-outline" title="Application not found" body="It may have been withdrawn or replaced by a newer submission." action="All applications" onAction={() => router.replace('/admin/applications')} />
      </Screen>
    );
  }

  const { app } = entry;
  const role = WORKSPACE_LABEL[app.role];
  const open = app.status === 'pending' || app.status === 'info';
  const checks = requirementChecks(app.role, app.details);
  const missing = missingRequired(app.role, app.details);
  const items = requestableItems(app.role);

  const decide = (status: Decision, opts?: { reason?: string; missing?: string[] }) => {
    if (entry.mine) decideApplication(status, opts);
    else reviewApplication(entry.id, status, opts);
    setInfoOpen(false);
    if (status === 'approved') toast(`${entry.name} approved · ${role} workspace unlocked`);
    else if (status === 'info') toast('Information requested · the applicant is notified');
    else toast('Not approved · the reason is sent to the applicant');
  };

  const startInfo = () => {
    setPicked(missing.length ? missing : []);
    setNote('');
    setInfoOpen(true);
  };

  const togglePick = (label: string) => setPicked(picked.includes(label) ? picked.filter((x) => x !== label) : [...picked, label]);

  return (
    <Screen keyboard header={<ScreenHeader title={entry.name} subtitle={`${role} application`} onBack={() => goBack('/admin/applications')} />}>
      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <Avatar src={entry.avatar} size={56} label={entry.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3" numberOfLines={1}>{entry.name}</T>
            <T v="small">{entry.handle} · {entry.city}</T>
            <Pill label={APPLICATION_STATUS_LABEL[app.status]} tone={APPLICATION_STATUS_TONE[app.status]} />
          </View>
        </Row>
        <Divider />
        <Row justify="space-between" gap={12}><T v="small">Role</T><T v="bodyBold" style={{ flexShrink: 1, textAlign: 'right' }}>{role}</T></Row>
        <Row justify="space-between" gap={12}><T v="small">Submitted</T><T v="bodyBold" style={{ flexShrink: 1, textAlign: 'right' }}>{dateTime(app.submittedAt)} · {ago(app.submittedAt)}</T></Row>
        <Row justify="space-between" gap={12}><T v="small">Reviewer</T><T v="bodyBold" style={{ flexShrink: 1, textAlign: 'right' }}>{entry.reviewer ?? 'Not assigned'}</T></Row>
      </Card>

      {entry.mine ? <Banner icon="account-circle-outline">This is the application of the account you’re signed in with. Approving it unlocks that workspace in this app.</Banner> : null}

      <Card style={{ gap: 10 }}>
        <T v="title" accessibilityRole="header">Submitted details</T>
        {Object.entries(app.details).length ? (
          Object.entries(app.details).map(([k, v], i) => (
            <View key={k} style={{ gap: 2 }}>
              {i ? <Divider style={{ marginBottom: 8 }} /> : null}
              <T v="small">{k}</T>
              <T v="body">{v}</T>
            </View>
          ))
        ) : (
          <T v="small">No details were submitted.</T>
        )}
      </Card>

      <Card>
        <Checklist title="Role requirements" items={checks.map((c) => ({ label: c.label, done: c.done, hint: 'Required for this role' }))} />
      </Card>

      {app.reason || app.missing?.length ? (
        <Card style={{ gap: 6 }}>
          <T v="title" accessibilityRole="header">Latest decision</T>
          {app.reason ? <T v="body">{app.reason}</T> : null}
          {app.missing?.length ? <T v="small">Missing: {app.missing.join(', ')}</T> : null}
          {app.decidedAt ? <T v="small" style={{ fontSize: 12 }}>{entry.reviewer ?? 'Reviewer'} · {dateTime(app.decidedAt)}</T> : null}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <T v="title" accessibilityRole="header">History</T>
        {(app.history ?? [{ at: app.submittedAt, status: app.status }]).map((h, i) => (
          <Row key={`${h.at}-${i}`} gap={10} align="flex-start">
            <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: colors.brand }} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{h.status === 'pending' ? (h.note ?? 'Submitted') : APPLICATION_STATUS_LABEL[h.status]}</T>
              {h.status !== 'pending' && h.note ? <T v="small">{h.note}</T> : null}
              <T v="small" style={{ fontSize: 12 }}>{dateTime(h.at)}</T>
            </View>
          </Row>
        ))}
      </Card>

      {open ? (
        <Card style={{ gap: 10 }}>
          <T v="title" accessibilityRole="header">Decision</T>
          {app.status === 'info' ? <T v="small">Waiting on the applicant. You can still decide if they sent the items another way.</T> : null}
          {missing.length ? <Banner icon="alert-circle-outline" tone="warning">{`${missing.length} required ${missing.length === 1 ? 'item is' : 'items are'} missing: ${missing.join(', ')}.`}</Banner> : null}
          {infoOpen ? (
            <View style={{ gap: 10 }}>
              <T v="bodyBold">What is missing?</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {items.map((label) => (
                  <Chip key={label} label={label} selected={picked.includes(label)} onPress={() => togglePick(label)} icon={picked.includes(label) ? 'check' : undefined} />
                ))}
              </View>
              <Field value={note} onChangeText={setNote} multiline placeholder="Message to the applicant (optional)" accessibilityLabel="Message to the applicant" />
              <Row gap={10}>
                <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => setInfoOpen(false)} />
                <Button
                  title="Send request"
                  size="md"
                  style={{ flex: 1 }}
                  disabled={!picked.length}
                  onPress={() => decide('info', { missing: picked, reason: note.trim() || 'Please add these items so we can finish the review.' })}
                />
              </Row>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Button title="Approve" icon="check-decagram" size="md" onPress={() => setSheet('approve')} />
              <Button title="Request information" icon="file-document-edit-outline" variant="secondary" size="md" onPress={startInfo} />
              <Button title="Reject" icon="close-octagon-outline" variant="danger" size="md" onPress={() => setSheet('reject')} />
            </View>
          )}
          <T v="small">Each decision records you as the reviewer, the reason and the time, and notifies the applicant.</T>
        </Card>
      ) : (
        <Banner icon={app.status === 'approved' ? 'check-decagram' : 'close-octagon-outline'} tone={app.status === 'approved' ? 'success' : 'danger'}>
          {app.status === 'approved' ? `Approved. The ${role} workspace is available to this account.` : 'Not approved. The applicant can update the application and submit it again.'}
        </Banner>
      )}

      <Button title="Back to the queue" variant="ghost" size="md" onPress={() => router.replace('/admin/applications')} />

      <ActionSheet
        visible={sheet === 'approve'}
        title={`Approve ${entry.name} as ${role.toLowerCase()}?`}
        actions={[
          {
            label: 'Approve and grant access',
            icon: 'check-decagram',
            sub: missing.length ? `Grants the ${role} workspace although ${missing.length} required ${missing.length === 1 ? 'item is' : 'items are'} missing.` : `Grants the ${role} workspace. Recorded with you as reviewer.`,
            onPress: () => decide('approved', { reason: missing.length ? `Approved without: ${missing.join(', ')}` : undefined }),
          },
        ]}
        onClose={() => setSheet(undefined)}
      />
      <ReasonSheet
        visible={sheet === 'reject'}
        title="Reject application"
        body="The applicant sees this reason and can update the application and submit it again."
        reasons={REJECT_REASONS}
        confirmLabel="Reject application"
        destructive
        notePlaceholder="Add details for the applicant (optional)"
        onSubmit={(reason, n) => decide('rejected', { reason: n ? `${reason}. ${n}` : reason })}
        onClose={() => setSheet(undefined)}
      />
    </Screen>
  );
}
