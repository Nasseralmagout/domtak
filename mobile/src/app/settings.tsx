import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet } from '../components/ActionSheet';
import { DemoBar, Screen, ScreenHeader } from '../components/layout';
import { Button, Icon, Pill, Row, T, Toggle } from '../components/ui';
import { profileById, venueById } from '../data/mock';
import { SAMPLE_APPLICATION, WORKSPACE_ICON, WORKSPACE_LABEL } from '../lib/access';
import { toast } from '../store/toast';
import { activeWorkspace, APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, isApproved, PROFESSIONAL_ROLES, useApp } from '../store/useApp';
import { colors, radius } from '../theme';

function LinkRow({ label, value, onPress, first }: { label: string; value?: string; onPress: () => void; first?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.divider }}>
      <T v="body" style={{ flex: 1 }}>{label}</T>
      {value ? <T v="small" numberOfLines={1} style={{ maxWidth: 160 }}>{value}</T> : null}
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange, first }: { label: string; value: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  return (
    <Row gap={12} style={{ minHeight: 54, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.divider }}>
      <T v="body" style={{ flex: 1 }}>{label}</T>
      <Toggle label={label} value={value} onValueChange={onChange} />
    </Row>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="caption" color="#6B5F8A" style={{ marginLeft: 4 }}>{title.toUpperCase()}</T>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export default function Settings() {
  const user = useApp((s) => s.user);
  const prefs = useApp((s) => s.prefs);
  const setPref = useApp((s) => s.setPref);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const submitApplication = useApp((s) => s.submitApplication);
  const methods = useApp((s) => s.paymentMethods);
  const selected = useApp((s) => s.selectedPayment);
  const signOut = useApp((s) => s.signOut);
  const resetDemo = useApp((s) => s.resetDemo);
  const blocked = useApp((s) => s.blocked);
  const plan = useApp((s) => s.plan);
  const [confirm, setConfirm] = useState<'reset' | 'delete'>();
  const planLabel = plan === 'free' ? 'Standard (free)' : plan === 'monthly' ? 'Pro · monthly' : 'Pro · yearly';
  // Same rule as the Blocked users screen: only ids that still resolve to an account.
  const blockedCount = blocked.filter((id) => profileById(id) || venueById(id)).length;
  const workspace = activeWorkspace(user);
  const app = user.application;
  const workspaceCount = user.approvedRoles.length;

  const startOver = (message: string) => {
    resetDemo();
    toast(message);
    router.replace('/');
  };

  return (
    <Screen header={<ScreenHeader title="Settings" />}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Active workspace: ${WORKSPACE_LABEL[workspace]}. Switch workspace`} onPress={() => router.push('/workspace')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.xl, backgroundColor: colors.brandDeep }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={WORKSPACE_ICON[workspace]} size={22} color={colors.brandDark} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="small" color={colors.lilacLight}>Active workspace</T>
          <T v="bodyBold" color={colors.white}>{WORKSPACE_LABEL[workspace]}</T>
          <T v="small" color={colors.lilacLight}>{workspaceCount > 1 ? `${workspaceCount} workspaces on this account · Switch` : 'Switch or add a professional workspace'}</T>
        </View>
        <Icon name="swap-horizontal" size={22} color={colors.white} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={app ? `Professional application: ${APPLICATION_STATUS_LABEL[app.status]}` : 'Apply for a professional account'}
        onPress={() => router.push(app ? '/application' : '/apply')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, borderRadius: radius.lg, backgroundColor: colors.surface }}
      >
        <Icon name={app ? 'file-document-outline' : 'check-decagram'} size={22} color={colors.brand} />
        <View style={{ flex: 1, paddingVertical: 10 }}>
          <T v="bodyBold">{app ? 'Professional application' : 'Apply as a professional'}</T>
          <T v="small">{app ? `${WORKSPACE_LABEL[app.role]} · ${APPLICATION_STATUS_LABEL[app.status]}` : 'Artist, band, DJ, venue or organizer: reviewed within 24 hours (target)'}</T>
        </View>
        {app ? <Pill label={APPLICATION_STATUS_LABEL[app.status]} tone={APPLICATION_STATUS_TONE[app.status]} /> : null}
        <Icon name="chevron-right" size={20} color={colors.subtle} />
      </Pressable>

      <Group title="Account">
        <LinkRow first label="Edit profile" onPress={() => router.push('/profile-setup?mode=edit')} />
        <LinkRow label="Workspace" value={WORKSPACE_LABEL[workspace]} onPress={() => router.push('/workspace')} />
        <LinkRow label="Account & security" value={user.email} onPress={() => router.push('/account-security')} />
        <LinkRow label="Payment methods" value={methods.find((m) => m.id === selected)?.label} onPress={() => router.push('/payment-methods')} />
        <LinkRow label="Subscription" value={planLabel} onPress={() => router.push('/subscription')} />
      </Group>

      <Group title="Notifications">
        <ToggleRow first label="Booking updates" value={prefs.bookings} onChange={(v) => setPref('bookings', v)} />
        <ToggleRow label="Messages" value={prefs.messages} onChange={(v) => setPref('messages', v)} />
        <ToggleRow label="Events near me" value={prefs.nearby} onChange={(v) => setPref('nearby', v)} />
        <T v="small" style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
          Essential notices are always sent: booking deadlines and decisions, payment problems, refunds, event cancellations and support replies.
        </T>
      </Group>

      <Group title="Privacy">
        <ToggleRow first label="Private account" value={prefs.privateAccount} onChange={(v) => setPref('privateAccount', v)} />
        <LinkRow label="Blocked users" value={String(blockedCount)} onPress={() => router.push('/blocked')} />
      </Group>

      <Group title="Language">
        <Row gap={12} accessibilityLabel="App language: English" style={{ minHeight: 54, paddingHorizontal: 16 }}>
          <T v="body" style={{ flex: 1 }}>App language</T>
          <T v="bodyBold">English</T>
        </Row>
      </Group>

      <DemoBar
        title="Demo: professional roles"
        note="Professional workspaces need an approved application. Send a complete sample application here, then simulate the review on its status screen."
      >
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {PROFESSIONAL_ROLES.map((r) => {
            if (isApproved(user, r)) {
              const on = workspace === r;
              return (
                <Button
                  key={r}
                  title={on ? `${WORKSPACE_LABEL[r]} · active` : `Switch to ${WORKSPACE_LABEL[r]}`}
                  size="sm"
                  variant={on ? 'primary' : 'secondary'}
                  onPress={() => {
                    if (on) return router.push('/workspace');
                    if (switchWorkspace(r)) toast(`Switched to your ${WORKSPACE_LABEL[r]} workspace`);
                  }}
                />
              );
            }
            if (app?.role === r && app.status !== 'approved') {
              return <Button key={r} title={`${WORKSPACE_LABEL[r]}: ${APPLICATION_STATUS_LABEL[app.status].toLowerCase()}`} size="sm" variant="light" onPress={() => router.push('/application')} />;
            }
            return (
              <Button
                key={r}
                title={`Sample application: ${WORKSPACE_LABEL[r]}`}
                size="sm"
                variant="secondary"
                onPress={() => {
                  // One application is reviewed at a time: open the pending one instead of replacing it.
                  if (app?.status === 'pending') {
                    toast('Your current application is still in review');
                    return router.push('/application');
                  }
                  submitApplication(r, SAMPLE_APPLICATION[r]);
                  toast(`Demo: sample application sent (${WORKSPACE_LABEL[r]})`);
                  router.push('/application');
                }}
              />
            );
          })}
          {workspace !== 'fan' ? (
            <Button title="Back to Member" size="sm" variant="secondary" onPress={() => { if (switchWorkspace('fan')) toast('Switched to your Member workspace'); }} />
          ) : null}
        </Row>
      </DemoBar>

      <Group title="Support">
        <LinkRow first label="Help & FAQ" onPress={() => router.push('/help')} />
        <LinkRow label="Your support cases" onPress={() => router.push('/support')} />
        <LinkRow label="Terms, privacy & imprint" onPress={() => router.push('/legal')} />
      </Group>

      <Row gap={10}>
        <Button title="Log out" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => { signOut(); router.replace('/login'); }} />
        <Button title="Reset demo" variant="ghost" size="md" style={{ flex: 1 }} onPress={() => setConfirm('reset')} />
      </Row>
      <Button title="Delete account" variant="ghost" size="sm" hitSlop={6} style={{ alignSelf: 'center' }} onPress={() => setConfirm('delete')} />
      <T v="small" center>Domtak · Version 1.0.0</T>

      <ActionSheet
        visible={!!confirm}
        title={
          confirm === 'delete'
            ? 'Delete account? Your profile, posts, friends and saved items are removed. Booking, payment and ticket records are kept only as long as the law requires, then deleted.'
            : 'Reset demo data? Tickets, bookings, posts and settings return to the sample data.'
        }
        actions={[
          confirm === 'delete'
            ? { label: 'Delete my account', icon: 'delete-outline', destructive: true, onPress: () => startOver('Your account was deleted') }
            : { label: 'Reset demo data', icon: 'restore', destructive: true, onPress: () => startOver('Demo data reset') },
        ]}
        onClose={() => setConfirm(undefined)}
      />
    </Screen>
  );
}
