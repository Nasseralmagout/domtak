import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Icon, Pill, Row, T } from '../components/ui';
import type { Role } from '../data/types';
import { WORKSPACE_ICON, WORKSPACE_LABEL, WORKSPACE_SUMMARY, workspaceHome } from '../lib/access';
import { toast } from '../store/toast';
import { activeWorkspace, APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, isApproved, useApp } from '../store/useApp';
import { colors } from '../theme';

const ORDER: Role[] = ['fan', 'musician', 'venue', 'organizer'];

/** Opens a workspace's dashboard: the member home, or the professional workspace. */
function openHome(role: Role) {
  if (role === 'fan') router.dismissTo('/(tabs)');
  else router.replace(workspaceHome(role) as never);
}

export default function Workspaces() {
  const { signin } = useLocalSearchParams<{ signin?: string }>();
  const user = useApp((s) => s.user);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const active = activeWorkspace(user);
  const app = user.application;
  const afterSignIn = signin === '1';

  const open = (role: Role) => {
    if (role !== user.role) {
      if (!switchWorkspace(role)) {
        toast(`${WORKSPACE_LABEL[role]} needs an approved application first`);
        return;
      }
      toast(`Switched to your ${WORKSPACE_LABEL[role]} workspace`);
    }
    openHome(role);
  };

  return (
    <Screen header={<ScreenHeader title={afterSignIn ? 'Choose a workspace' : 'Workspaces'} onBack={() => goBack('/(tabs)')} />}>
      <T v="body" color={colors.muted}>
        {afterSignIn
          ? 'Your account has more than one workspace. Pick where you want to start; you can switch any time from the menu.'
          : 'Every account has a member workspace, plus one for each approved professional role. Switching changes your tools, not whose data you see: each workspace shows only your own records.'}
      </T>

      {ORDER.map((role) => {
        const approved = isApproved(user, role);
        const isActive = role === active;
        const roleApp = role !== 'fan' && app?.role === role && app.status !== 'approved' ? app : undefined;
        return (
          <Card key={role} style={{ gap: 12, borderWidth: isActive ? 2 : 0, borderColor: colors.brand }}>
            <Row gap={14} align="flex-start">
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isActive ? colors.brand : approved ? colors.brandSoft : colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={WORKSPACE_ICON[role]} size={24} color={isActive ? colors.white : approved ? colors.brand : colors.disabled} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  <T v="bodyBold" style={{ fontSize: 16 }}>{WORKSPACE_LABEL[role]}</T>
                  {isActive ? (
                    <Pill label="Active" tone="success" icon="check" />
                  ) : approved ? (
                    <Pill label="Approved" tone="brand" />
                  ) : roleApp ? (
                    <Pill label={APPLICATION_STATUS_LABEL[roleApp.status]} tone={APPLICATION_STATUS_TONE[roleApp.status]} />
                  ) : (
                    <Pill label="Not applied" tone="neutral" />
                  )}
                </Row>
                <T v="small">{WORKSPACE_SUMMARY[role]}</T>
              </View>
            </Row>
            {isActive ? (
              <Button title={afterSignIn ? `Continue as ${WORKSPACE_LABEL[role]}` : 'Open'} size="md" variant={afterSignIn ? 'primary' : 'light'} icon="arrow-right" onPress={() => open(role)} />
            ) : approved ? (
              <Button title={`Switch to ${WORKSPACE_LABEL[role]}`} size="md" icon="swap-horizontal" onPress={() => open(role)} />
            ) : roleApp ? (
              <Button title="View application" size="md" variant="secondary" icon="file-document-outline" onPress={() => router.push('/application')} />
            ) : (
              <Button
                title="Apply"
                size="md"
                variant="secondary"
                icon="check-decagram"
                accessibilityLabel={`Apply for a ${WORKSPACE_LABEL[role]} account`}
                onPress={() => router.push({ pathname: '/apply', params: { role } })}
              />
            )}
          </Card>
        );
      })}

      <Banner icon="shield-check-outline">
        Professional workspaces open only after our team approves your application, with a target response within 24 hours. One application is reviewed at a time.
      </Banner>
      {app ? <Button title="Application status" variant="ghost" size="md" icon="file-document-outline" onPress={() => router.push('/application')} /> : null}
    </Screen>
  );
}
