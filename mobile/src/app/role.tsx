import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Button, Icon, type IconName, Radio, Row, T } from '../components/ui';
import type { Role } from '../data/types';
import { ROLE_LABEL, useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

const ROLES: { id: Role; tier: 'Standard' | 'Pro'; desc: string; icon: IconName }[] = [
  { id: 'fan', tier: 'Standard', desc: 'Follow artists, buy tickets, book musicians or venues for your own events.', icon: 'music-note' },
  { id: 'musician', tier: 'Pro', desc: 'Public portfolio, booking fee, gig calendar and payouts.', icon: 'microphone' },
  { id: 'venue', tier: 'Pro', desc: 'List rooms, capacity and equipment. Accept booking requests.', icon: 'storefront-outline' },
  { id: 'organizer', tier: 'Pro', desc: 'Create events, book lineups, sell tickets and scan at the door.', icon: 'calendar-month-outline' },
];

export default function ChooseRole() {
  const current = useApp((s) => s.user.role);
  const update = useApp((s) => s.updateUser);
  const [role, setRole] = useState<Role>(current);

  return (
    <Screen
      header={<ScreenHeader right={<T v="smallBold" color={colors.muted} style={{ paddingRight: 16 }}>Step 1 of 2</T>} />}
      contentStyle={{ paddingHorizontal: 24, gap: 18 }}
    >
      <View style={{ gap: 8 }}>
        <T v="h1">How will you use Domtak?</T>
        <T v="body" color={colors.muted}>Your role sets up your profile and tools. It’s chosen once at registration, so pick the one that fits best.</T>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
        {ROLES.map((r) => {
          const on = r.id === role;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityLabel={`${ROLE_LABEL[r.id]}, ${r.tier}. ${r.desc}`}
              accessibilityState={{ checked: on }}
              onPress={() => setRole(r.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: on ? colors.brand : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} size={24} color={on ? colors.white : colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Row gap={8}>
                  <T v="bodyBold" style={{ fontSize: 16 }}>{ROLE_LABEL[r.id]}</T>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: r.tier === 'Pro' ? colors.brandDark : '#ECE9F3' }}>
                    <T v="caption" style={{ fontFamily: fonts.bodyBold }} color={r.tier === 'Pro' ? colors.gold : colors.label}>{r.tier}</T>
                  </View>
                </Row>
                <T v="small">{r.desc}</T>
              </View>
              <Radio selected={on} />
            </Pressable>
          );
        })}
      </View>
      <Button
        title={`Continue as ${ROLE_LABEL[role]}`}
        onPress={() => {
          update({ role });
          router.push('/profile-setup');
        }}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}
