import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../store/toast';
import { colors, fonts } from '../theme';
import { Icon, type IconName } from './Icon';
import { Button, Field, Radio } from './ui';

export interface SheetAction {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
  /** Second line under the label. */
  sub?: string;
  /** Shown greyed out and not tappable. */
  disabled?: boolean;
}

/** Bottom sheet with a list of actions (the "•••" menus). `cancelLabel` names the dismiss button (default "Cancel"). */
export function ActionSheet({ visible, title, actions, onClose, cancelLabel = 'Cancel' }: { visible: boolean; title?: string; actions: SheetAction[]; onClose: () => void; cancelLabel?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={{ flex: 1 }} onPress={onClose} />
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 }} />
          {title ? <Text style={{ fontFamily: fonts.displaySemi, fontSize: 17, color: colors.ink, marginBottom: 6 }}>{title}</Text> : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityState={a.disabled ? { disabled: true } : undefined}
              disabled={a.disabled}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, opacity: a.disabled ? 0.45 : pressed ? 0.7 : 1 })}
            >
              {a.icon ? <Icon name={a.icon} size={22} color={a.destructive ? colors.danger : colors.ink} /> : null}
              <View style={{ flex: 1, paddingVertical: a.sub ? 6 : 0 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: a.destructive ? colors.danger : colors.ink }}>{a.label}</Text>
                {a.sub ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>{a.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onClose} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.brand }}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export interface ReasonSheetProps {
  visible: boolean;
  title: string;
  /** Explanation above the reasons, e.g. what happens to the payment. */
  body?: string;
  reasons: string[];
  confirmLabel: string;
  destructive?: boolean;
  /** Ask for an extra note; required when `noteRequired`. */
  notePlaceholder?: string;
  noteRequired?: boolean;
  onSubmit: (reason: string, note: string) => void;
  onClose: () => void;
}

/** Bottom sheet that asks for a reason (and optional note) before cancelling, reporting, declining… */
export function ReasonSheet(props: ReasonSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {/* Mounted only while open, so each opening starts with a fresh choice. */}
      {props.visible ? <ReasonSheetBody {...props} /> : null}
    </Modal>
  );
}

function ReasonSheetBody({ title, body, reasons, confirmLabel, destructive, notePlaceholder, noteRequired, onSubmit, onClose }: ReasonSheetProps) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string>();
  const [note, setNote] = useState('');
  const ready = !!reason && (!noteRequired || note.trim().length > 0);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
      <View accessibilityViewIsModal style={{ maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 }} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink }}>{title}</Text>
          {body ? <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 6 }}>{body}</Text> : null}
          <View accessibilityRole="radiogroup">
            {reasons.map((r) => (
              <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} onPress={() => setReason(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <Radio selected={reason === r} />
                <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink }}>{r}</Text>
              </Pressable>
            ))}
          </View>
          {notePlaceholder ? <Field placeholder={notePlaceholder} value={note} onChangeText={setNote} multiline accessibilityLabel={noteRequired ? `${notePlaceholder} (required)` : notePlaceholder} /> : null}
          <Button title={confirmLabel} variant={destructive ? 'danger' : 'primary'} size="md" disabled={!ready} onPress={() => { onClose(); onSubmit(reason ?? '', note.trim()); }} style={{ marginTop: 10 }} />
          <Button title="Cancel" variant="ghost" size="md" onPress={onClose} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
