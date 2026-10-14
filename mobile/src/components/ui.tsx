import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageStyle } from 'expo-image';
import { type ComponentProps, isValidElement, type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

import { img, type ImgKey } from '../data/images';
import { colors, fonts, radius, shadow, type } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color = colors.ink, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}

type Variant = keyof typeof type;
export function T({ v = 'body', style, color, center, ...rest }: TextProps & { v?: Variant; color?: string; center?: boolean }) {
  return <Text {...rest} style={[type[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]} />;
}

export function Photo({ src, style, radius: r, contentFit = 'cover', accessibilityLabel }: { src: ImgKey; style?: StyleProp<ImageStyle>; radius?: number; contentFit?: 'cover' | 'contain'; accessibilityLabel?: string }) {
  return (
    <Image
      source={img[src]}
      style={[{ backgroundColor: colors.brandDeep }, r != null ? { borderRadius: r } : null, style]}
      contentFit={contentFit}
      transition={150}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function Avatar({ src, size = 44, ring, label, verified }: { src?: ImgKey; size?: number; ring?: boolean | string; label?: string; verified?: boolean }) {
  const ringColor = typeof ring === 'string' ? ring : colors.brandMid;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: ring ? 2.5 : 0,
          borderWidth: ring ? 2 : 0,
          borderColor: ringColor,
          backgroundColor: colors.surface,
        }}
      >
        {src ? (
          <Photo src={src} style={{ flex: 1, borderRadius: size }} accessibilityLabel={label} />
        ) : (
          <View style={{ flex: 1, borderRadius: size, backgroundColor: colors.brandMid, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: size * 0.36 }}>{label?.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </View>
      {verified ? (
        <View style={[styles.verified, { width: size * 0.36, height: size * 0.36, borderRadius: size }]}>
          <Icon name="check" size={size * 0.24} color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'outlineLight';
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
};

export function Button({ title, variant = 'primary', size = 'lg', icon, loading, style, full, disabled, ...rest }: ButtonProps) {
  const h = size === 'lg' ? 56 : size === 'md' ? 46 : 38;
  const palette: Record<NonNullable<ButtonProps['variant']>, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brand, fg: colors.white },
    secondary: { bg: colors.surface, fg: colors.brand, border: colors.brand },
    ghost: { bg: 'transparent', fg: colors.brand },
    danger: { bg: colors.danger, fg: colors.white },
    light: { bg: colors.brandSoft, fg: colors.brand },
    outlineLight: { bg: 'transparent', fg: colors.white, border: 'rgba(255,255,255,0.35)' },
  };
  const p = disabled ? { bg: colors.track, fg: colors.label } : palette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: h / 2,
          backgroundColor: p.bg,
          borderWidth: 'border' in p && p.border ? 1 : 0,
          borderColor: 'border' in p ? p.border : undefined,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : undefined,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
      <Text style={{ color: p.fg, fontFamily: size === 'lg' ? fonts.displaySemi : fonts.bodyBold, fontSize: size === 'lg' ? 17 : size === 'md' ? 15 : 13 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color = colors.ink, bg = 'transparent', size = 48, iconSize = 24, badge }: { name: IconName; onPress?: () => void; label: string; color?: string; bg?: string; size?: number; iconSize?: number; badge?: number | boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={name} size={iconSize} color={color} />
      {badge ? (
        <View style={[styles.badge, typeof badge === 'number' ? null : styles.badgeDot]}>
          {typeof badge === 'number' ? <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, tone = 'default', style }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; tone?: 'default' | 'dark'; style?: StyleProp<ViewStyle> }) {
  const dark = tone === 'dark';
  const bg = selected ? colors.brand : dark ? colors.brandDeep : colors.surface;
  const fg = selected || dark ? colors.white : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[{ height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: selected ? colors.brand : dark ? colors.brandDeep : colors.borderStrong, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<K extends string>({ options, value, onChange, dark }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; dark?: boolean }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: dark ? colors.brandDeep : '#ECE9F3' }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.surface : 'transparent' }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: on ? colors.brand : dark ? colors.white : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, icon, right, error, style, ...rest }: TextInputProps & { label?: string; icon?: IconName; right?: ReactNode; error?: string; style?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T v="label">{label}</T> : null}
      <View
        style={{
          minHeight: rest.multiline ? 96 : 54,
          borderRadius: radius.md,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? colors.danger : focused ? colors.brand : colors.borderStrong,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: rest.multiline ? 'flex-start' : 'center',
          paddingHorizontal: focused ? 13 : 14,
          gap: 10,
        }}
      >
        <TextInput
          placeholderTextColor={colors.subtle}
          {...rest}
          accessibilityLabel={label ?? rest.placeholder}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={{ flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: rest.multiline ? 12 : 0, minHeight: rest.multiline ? 80 : 50, textAlignVertical: rest.multiline ? 'top' : 'center' }}
        />
        {right}
        {icon ? <Icon name={icon} size={22} color={colors.muted} /> : null}
      </View>
      {error ? <T v="small" color={colors.danger}>{error}</T> : null}
    </View>
  );
}

export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const base: ViewStyle = { backgroundColor: colors.surface, borderRadius: radius.lg, padding: padded ? 16 : 0, ...shadow(1) };
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Row({ children, gap = 8, style, align = 'center', justify, accessibilityLabel }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; accessibilityLabel?: string }) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessible={accessibilityLabel ? true : undefined} style={[{ flexDirection: 'row', alignItems: align, gap, justifyContent: justify }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row justify="space-between" style={{ marginBottom: 10 }}>
      <T v="h3">{title}</T>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <T v="smallBold" color={colors.brand}>{action}</T>
        </Pressable>
      ) : null}
    </Row>
  );
}

const STATUS: Record<string, { bg: string; fg: string }> = {
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  brand: { bg: colors.brandSoft, fg: colors.brand },
  neutral: { bg: colors.chipIdle, fg: colors.label },
};

export function Pill({ label, tone = 'brand', icon }: { label: string; tone?: keyof typeof STATUS; icon?: IconName }) {
  const s = STATUS[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: s.bg }}>
      {icon ? <Icon name={icon} size={13} color={s.fg} /> : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: s.fg }}>{label}</Text>
    </View>
  );
}

export function Toggle({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label: string }) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.brand, false: colors.disabled }}
      thumbColor={colors.white}
    />
  );
}

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (n: number) => void }) {
  return (
    <Row gap={onChange ? 4 : 2}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Icon name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? colors.star : colors.disabled} />;
        return onChange ? (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} onPress={() => onChange(n)} style={{ padding: 4 }}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </Row>
  );
}

export function RatingBadge({ value }: { value: number }) {
  return (
    <Row gap={4} style={{ backgroundColor: colors.brandDark, paddingHorizontal: 10, height: 30, borderRadius: 15 }}>
      <Icon name="star" size={16} color={colors.gold} />
      <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 14 }}>{value.toFixed(1).replace('.', ',')}</Text>
    </Row>
  );
}

export function Stepper({ value, onChange, min = 1, max = 10 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <Row gap={6}>
      <IconButton name="minus" label="Decrease" onPress={() => onChange(Math.max(min, value - 1))} bg={colors.surface} size={44} iconSize={20} />
      <Text accessibilityLiveRegion="polite" style={{ minWidth: 32, textAlign: 'center', fontFamily: fonts.displaySemi, fontSize: 20, color: colors.ink }}>{value}</Text>
      <IconButton name="plus" label="Increase" onPress={() => onChange(Math.min(max, value + 1))} bg={colors.brand} color={colors.white} size={44} iconSize={20} />
    </Row>
  );
}

export function Radio({ selected }: { selected: boolean }) {
  return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 7 : 2, borderColor: selected ? colors.brand : colors.disabled, backgroundColor: colors.surface }} />;
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 }}>
      <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={52} color={colors.brand} />
      </View>
      <T v="h2" center>{title}</T>
      <T v="body" color={colors.muted} center>{body}</T>
      {action ? <Button title={action} onPress={onAction} size="md" style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.divider }, style]} />;
}

export function KeyValue({ k, v, strong, color }: { k: string; v: string; strong?: boolean; color?: string }) {
  return (
    <Row justify="space-between" style={{ paddingVertical: 4 }}>
      <T v={strong ? 'bodyBold' : 'body'} color={strong ? colors.ink : colors.muted}>{k}</T>
      <T v={strong ? 'h3' : 'bodyBold'} color={color}>{v}</T>
    </Row>
  );
}

export function Banner({ icon, children, tone = 'brand' }: { icon: IconName; children: ReactNode; tone?: keyof typeof STATUS }) {
  const s = STATUS[tone];
  return (
    <Row align="flex-start" gap={10} style={{ padding: 14, borderRadius: radius.md, backgroundColor: s.bg }}>
      <Icon name={icon} size={20} color={s.fg} />
      <View style={{ flex: 1 }}>{isValidElement(children) ? children : <T v="small" color={s.fg === colors.brand ? '#2E1D5E' : s.fg}>{children}</T>}</View>
    </Row>
  );
}

const styles = StyleSheet.create({
  verified: { position: 'absolute', right: -2, bottom: -2, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.warningStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  badgeDot: { minWidth: 12, width: 12, height: 12, top: 10, right: 11, paddingHorizontal: 0 },
  badgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.bodyBold },
});
