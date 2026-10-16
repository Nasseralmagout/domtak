import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DemoBar, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, EmptyState, Icon, type IconName, Pill, Row, Steps, T, TimeLeft } from '../components/ui';
import type { ApplicationStatus, ProfessionalRole } from '../data/types';
import { DEMO_MISSING, DEMO_REJECT_REASON, PRO_ROLE_TITLE, WORKSPACE_ICON, WORKSPACE_LABEL, WORKSPACE_SUMMARY, workspaceHome } from '../lib/access';
import { addHours, dateTime, hoursUntil } from '../lib/format';
import { toast } from '../store/toast';
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, useApp } from '../store/useApp';
import { colors, radius } from '../theme';

/** Target time for a first decision (blueprint F02). Separate from the 24-hour booking response deadline. */
const REVIEW_TARGET_HOURS = 24;

/** What approval unlocks for each role (section 02): public events are for organizers only. */
const UNLOCKS: Record<ProfessionalRole, string> = {
  musician: 'Feed posts, stories and booking requests from hosts',
  venue: 'Feed posts, stories and venue bookings',
  organizer: 'Feed posts, stories and publishing public events',
};

const HERO: Record<ApplicationStatus, { icon: IconName; title: string }> = {
  pending: { icon: 'clock-outline', title: 'Application in review' },
  info: { icon: 'file-document-edit-outline', title: 'More information required' },
  approved: { icon: 'check-decagram', title: 'You’re approved' },
  rejected: { icon: 'close-octagon-outline', title: 'Application not approved' },
};

export default function ApplicationStatusScreen() {
  const user = useApp((s) => s.user);
  const decideApplication = useApp((s) => s.decideApplication);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const [showDetails, setShowDetails] = useState(false);
  const app = user.application;
  const otherApproved = user.approvedRoles.filter((r) => r !== 'fan');

  if (!app) {
    return (
      <Screen header={<ScreenHeader title="Professional application" />}>
        <EmptyState
          icon="file-document-outline"
          title="No application yet"
          body="Artists, bands, DJs, venues and organizers apply for a professional account. Your member account keeps working while we review it."
          action="Apply as a professional"
          onAction={() => router.push('/apply')}
        />
        {otherApproved.length ? (
          <Card style={{ gap: 10 }}>
            <T v="title">Your approved workspaces</T>
            <T v="small">{otherApproved.map((r) => WORKSPACE_LABEL[r]).join(', ')}</T>
            <Button title="Open workspaces" variant="light" size="md" icon="swap-horizontal" onPress={() => router.push('/workspace')} />
          </Card>
        ) : null}
      </Screen>
    );
  }

  const role = app.role;
  const target = addHours(app.submittedAt, REVIEW_TARGET_HOURS);
  const overdue = app.status === 'pending' && hoursUntil(target) < 0;
  const active = user.role === role;
  const hero = HERO[app.status];

  const steps = [
    { title: 'Submitted', note: dateTime(app.submittedAt) },
    {
      title: 'Team review',
      note: app.status === 'pending' ? `Target decision by ${dateTime(target)}` : app.status === 'info' ? 'Waiting for your update' : app.decidedAt ? `Decided ${dateTime(app.decidedAt)}` : undefined,
    },
    { title: 'Decision', note: app.status === 'approved' || app.status === 'rejected' ? APPLICATION_STATUS_LABEL[app.status] : undefined },
    { title: 'Workspace activated', note: app.status === 'approved' && active ? 'In use now' : undefined },
  ];
  const current = app.status === 'pending' || app.status === 'info' ? 1 : app.status === 'rejected' ? 2 : active ? 4 : 3;

  const activate = () => {
    if (!switchWorkspace(role)) {
      toast('This workspace is not approved yet');
      return;
    }
    toast(`Switched to your ${WORKSPACE_LABEL[role]} workspace`);
    router.replace(workspaceHome(role) as never);
  };

  const history = [...(app.history ?? [])].reverse();
  const details = Object.entries(app.details);

  return (
    <Screen header={<ScreenHeader title="Professional application" subtitle={PRO_ROLE_TITLE[role]} />}>
      <View style={{ backgroundColor: colors.brandDeep, borderRadius: radius.xl, padding: 18, gap: 12 }}>
        <Row gap={14}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: app.status === 'approved' ? colors.gold : 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={hero.icon} size={28} color={app.status === 'approved' ? colors.brandDark : colors.white} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3" color={colors.white}>{hero.title}</T>
            <T v="small" color={colors.lilacLight}>{PRO_ROLE_TITLE[role]} · submitted {dateTime(app.submittedAt)}</T>
          </View>
        </Row>
        <Pill label={APPLICATION_STATUS_LABEL[app.status]} tone={APPLICATION_STATUS_TONE[app.status]} />
      </View>

      {app.status === 'pending' ? (
        <Card style={{ gap: 10 }}>
          <Row justify="space-between">
            <T v="title">Review target: 24 hours</T>
            {overdue ? <Pill label="Taking longer" tone="warning" icon="timer-sand" /> : <TimeLeft deadline={target} />}
          </Row>
          <T v="small">
            {overdue
              ? 'This review is taking longer than our 24-hour target. You’ll be notified as soon as there is a decision.'
              : `We aim to decide by ${dateTime(target)}. You’ll be notified of the outcome.`}
          </T>
          <T v="small" color={colors.label}>The review target is separate from the 24-hour response deadline on bookings.</T>
          {overdue ? <Button title="Contact support" variant="light" size="md" icon="lifebuoy" onPress={() => router.push('/support/new?topic=account')} /> : null}
        </Card>
      ) : null}

      {app.status === 'info' ? (
        <Card style={{ gap: 10 }}>
          <T v="title">The reviewer needs</T>
          {(app.missing?.length ? app.missing : ['More detail on your application']).map((m) => (
            <Row key={m} gap={10} align="flex-start">
              <Icon name="alert-circle-outline" size={20} color={colors.warning} />
              <T v="bodyBold" style={{ flex: 1 }}>{m}</T>
            </Row>
          ))}
          {app.reason ? <T v="small">{app.reason}</T> : null}
          <Button title="Update and resubmit" icon="file-document-edit-outline" onPress={() => router.push('/apply')} />
          <T v="small" color={colors.label}>Professional tools stay locked until the application is approved.</T>
        </Card>
      ) : null}

      {app.status === 'approved' ? (
        <Card style={{ gap: 12 }}>
          <Row gap={12}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={WORKSPACE_ICON[role]} size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="title">{active ? `Your ${WORKSPACE_LABEL[role]} workspace is active` : `Your ${WORKSPACE_LABEL[role]} workspace is ready`}</T>
              <T v="small">{WORKSPACE_SUMMARY[role]}</T>
            </View>
          </Row>
          {active ? (
            <Button title="Open workspace" icon="view-grid-outline" onPress={() => router.push(workspaceHome(role) as never)} />
          ) : (
            <Button title="Activate workspace" icon="check-decagram" onPress={activate} />
          )}
          <Button title="All workspaces" variant="ghost" size="md" icon="swap-horizontal" onPress={() => router.push('/workspace')} />
        </Card>
      ) : null}

      {app.status === 'rejected' ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Reason</T>
          <T v="body">{app.reason ?? 'No reason was recorded. Contact support to ask about the decision.'}</T>
          <T v="title" style={{ marginTop: 4 }}>How to apply again</T>
          <T v="small">Update the details the reason mentions and submit again; it goes back into review. You can also apply for a different role, or ask support about the decision.</T>
          <Button title="Update and resubmit" icon="file-document-edit-outline" onPress={() => router.push('/apply')} />
          <Button title="Ask support about the decision" variant="light" size="md" icon="lifebuoy" onPress={() => router.push('/support/new?topic=account')} />
        </Card>
      ) : null}

      {app.status !== 'approved' ? (
        <Banner icon="account-heart-outline">{`Your member account keeps working. ${UNLOCKS[role]} unlock only after approval.`}</Banner>
      ) : null}

      <Card style={{ gap: 12 }}>
        <T v="title">Progress</T>
        {current >= steps.length ? (
          // Every step is done: read that out instead of a step number past the end.
          <View accessible accessibilityLabel="All steps done. Your workspace is activated and in use.">
            <Steps steps={steps} current={current} />
          </View>
        ) : (
          <Steps steps={steps} current={current} failed={app.status === 'info' || app.status === 'rejected'} />
        )}
      </Card>

      {history.length ? (
        <Card style={{ gap: 10 }}>
          <T v="title">History</T>
          {history.map((h, i) => (
            <Row key={`${h.at}-${i}`} gap={10} align="flex-start">
              <View style={{ flex: 1, gap: 2 }}>
                <Pill label={APPLICATION_STATUS_LABEL[h.status]} tone={APPLICATION_STATUS_TONE[h.status]} />
                {h.note ? <T v="small">{h.note}</T> : null}
              </View>
              <T v="small">{dateTime(h.at)}</T>
            </Row>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails(!showDetails)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
          <T v="title" style={{ flex: 1 }}>Submitted details</T>
          <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={22} color={colors.brand} />
        </Pressable>
        {showDetails
          ? details.map(([k, v]) => (
              <View key={k} style={{ gap: 2 }}>
                <T v="label">{k}</T>
                <T v="body">{v}</T>
              </View>
            ))
          : null}
      </Card>

      {app.status === 'pending' ? (
        <DemoBar title="Demo: simulate review outcome" note="Reviews happen in the admin console. These buttons record the same decision so you can try each outcome.">
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title="Approve" size="sm" icon="check" onPress={() => { decideApplication('approved'); toast('Demo: application approved'); }} />
            <Button
              title="Request info"
              size="sm"
              variant="secondary"
              icon="file-document-edit-outline"
              onPress={() => {
                decideApplication('info', { missing: DEMO_MISSING[role], reason: 'Please add these items so we can finish the review.' });
                toast('Demo: more information requested');
              }}
            />
            <Button title="Reject" size="sm" variant="danger" icon="close" onPress={() => { decideApplication('rejected', { reason: DEMO_REJECT_REASON[role] }); toast('Demo: application not approved'); }} />
          </Row>
        </DemoBar>
      ) : null}
    </Screen>
  );
}
