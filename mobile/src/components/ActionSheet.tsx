import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../store/toast';
import { colors, fonts } from '../theme';
import { Icon, type IconName } from './Icon';

export interface SheetAction {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

/** Bottom sheet with a list of actions (the "•••" menus). */
export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title?: string; actions: SheetAction[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close menu" style={{ flex: 1 }} onPress={onClose} />
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 }} />
          {title ? <Text style={{ fontFamily: fonts.displaySemi, fontSize: 17, color: colors.ink, marginBottom: 6 }}>{title}</Text> : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, opacity: pressed ? 0.7 : 1 })}
            >
              {a.icon ? <Icon name={a.icon} size={22} color={a.destructive ? colors.danger : colors.ink} /> : null}
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: a.destructive ? colors.danger : colors.ink }}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.brand }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Renders the current toast; mounted once in the root layout. */
export function ToastHost() {
  const message = useToast((s) => s.message);
  const id = useToast((s) => s.id);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [message, id, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, alignItems: 'center' }}>
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, maxWidth: 380 }}>
        <Icon name="check" size={18} color={colors.gold} />
        <Text style={{ color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 14, flexShrink: 1 }}>{message}</Text>
      </View>
    </View>
  );
}
