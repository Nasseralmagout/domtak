import { Image, type ImageStyle } from 'expo-image';
import { isValidElement, type ReactNode, type Ref, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import type { Booking, BookingStatus, PaymentState } from '../data/types';
import { bookingLabel, bookingTone, deadlineTone, PAYMENT_LABEL, PAYMENT_PROVIDER_LABEL, PAYMENT_TONE, STATUS_LABEL, STATUS_TONE, timeLeft, type Tone } from '../lib/booking';
import { euro, TODAY } from '../lib/format';
import { colors, fonts, radius, shadow, type } from '../theme';
import { Icon, type IconName } from './Icon';

export { Icon, type IconName };

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
      // sm buttons are 38 px tall; reach a 44 px touch target unless the caller sets its own hitSlop.
      hitSlop={size === 'sm' ? 4 : undefined}
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
      <Text numberOfLines={1} style={{ flexShrink: 1, color: p.fg, fontFamily: size === 'lg' ? fonts.displaySemi : fonts.bodyBold, fontSize: size === 'lg' ? 17 : size === 'md' ? 15 : 13 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, onLongPress, label, color = colors.ink, bg = 'transparent', size = 48, iconSize = 24, badge, disabled, selected }: { name: IconName; onPress?: () => void; onLongPress?: () => void; label: string; color?: string; bg?: string; size?: number; iconSize?: number; badge?: number | boolean; disabled?: boolean; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled || selected != null ? { disabled, selected } : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={size < 44 ? (44 - size) / 2 + 2 : 4}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
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

export function Chip({ label, selected, onPress, icon, tone = 'default', style, accessibilityLabel }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; tone?: 'default' | 'dark'; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const dark = tone === 'dark';
  const bg = selected ? colors.brand : dark ? colors.brandDeep : colors.surface;
  const fg = selected || dark ? colors.white : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
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

/** The field draws its own focus border, so drop the browser focus ring on web. */
const webNoOutline: TextStyle | null = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;

export function Field({ label, icon, right, error, style, inputRef, ...rest }: TextInputProps & { label?: string; icon?: IconName; right?: ReactNode; error?: string; style?: StyleProp<ViewStyle>; inputRef?: Ref<TextInput> }) {
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
          ref={inputRef}
          placeholderTextColor={colors.subtle}
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: rest.multiline ? 12 : 0, minHeight: rest.multiline ? 80 : 50, textAlignVertical: rest.multiline ? 'top' : 'center' },
            webNoOutline,
          ]}
        />
        {right}
        {icon ? <Icon name={icon} size={22} color={colors.muted} /> : null}
      </View>
      {error ? <T v="small" color={colors.danger}>{error}</T> : null}
    </View>
  );
}

export function Card({ children, style, onPress, padded = true, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; accessibilityLabel?: string }) {
  const base: ViewStyle = { backgroundColor: colors.surface, borderRadius: radius.lg, padding: padded ? 16 : 0, ...shadow(1) };
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1 }, style]}>
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
        <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} hitSlop={12}>
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
    <Row gap={onChange ? 4 : 2} accessibilityLabel={onChange ? undefined : `Rated ${Math.round(value)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Icon name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? colors.star : colors.disabled} />;
        return onChange ? (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} accessibilityState={{ selected: n === Math.round(value) }} onPress={() => onChange(n)} style={{ padding: 4 }}>
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

export function Stepper({ value, onChange, min = 1, max = 10, step = 1, label, format }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label?: string; format?: (n: number) => string }) {
  const what = label ? ` ${label}` : '';
  return (
    <Row gap={6}>
      <IconButton name="minus" label={`Decrease${what}`} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} bg={colors.surface} size={44} iconSize={20} />
      <Text accessibilityLiveRegion="polite" accessibilityLabel={label ? `${label}: ${format ? format(value) : value}` : undefined} style={{ minWidth: 32, textAlign: 'center', fontFamily: fonts.displaySemi, fontSize: 20, color: colors.ink }}>{format ? format(value) : value}</Text>
      <IconButton name="plus" label={`Increase${what}`} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} bg={colors.brand} color={colors.white} size={44} iconSize={20} />
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
    <Row justify="space-between" align="flex-start" gap={12} style={{ paddingVertical: 4 }}>
      <T v={strong ? 'bodyBold' : 'body'} color={strong ? colors.ink : colors.muted}>{k}</T>
      <T v={strong ? 'h3' : 'bodyBold'} color={color} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
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

// ---------- Blueprint building blocks ----------

/** Booking status pill. Pass `booking` to get quote-aware wording ("Quote received"). */
export function StatusPill({ status, booking }: { status?: BookingStatus; booking?: Pick<Booking, 'status' | 'pricing' | 'quote'> }) {
  if (booking) return <Pill label={bookingLabel(booking)} tone={bookingTone(booking)} />;
  if (!status) return null;
  return <Pill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

/** Payment state pill; `provider` shows the provider / admin wording (e.g. "Payout pending"). */
export function PaymentPill({ state, provider }: { state?: PaymentState; provider?: boolean }) {
  if (!state) return null;
  return <Pill label={provider ? PAYMENT_PROVIDER_LABEL[state] : PAYMENT_LABEL[state]} tone={PAYMENT_TONE[state]} icon="credit-card-outline" />;
}

/** Response deadline pill: "23 h left" / "Expired". Renders nothing without a deadline. */
export function TimeLeft({ deadline, now = TODAY, prefix }: { deadline?: string; now?: Date; prefix?: string }) {
  if (!deadline) return null;
  const left = timeLeft(deadline, now);
  return <Pill label={prefix ? `${prefix} ${left.toLowerCase()}` : left} tone={deadlineTone(deadline, now)} icon="timer-sand" />;
}

export interface LineItem {
  label: string;
  amount: number;
  note?: string;
}

/** Price breakdown with an optional total. Pass total={false} to hide the total row. */
export function LineItems({ items, total, totalLabel = 'Total', cents = false, style }: { items: LineItem[]; total?: number | false; totalLabel?: string; cents?: boolean; style?: StyleProp<ViewStyle> }) {
  const sum = total === undefined ? items.reduce((n, i) => n + i.amount, 0) : total;
  return (
    <View style={[{ gap: 8 }, style]}>
      {items.map((i, idx) => (
        <Row key={`${i.label}-${idx}`} justify="space-between" align="flex-start" gap={12} accessibilityLabel={`${i.label}${i.note ? `, ${i.note}` : ''}: ${euro(i.amount, cents)}`}>
          <View style={{ flex: 1, gap: 1 }}>
            <T v="body">{i.label}</T>
            {i.note ? <T v="small">{i.note}</T> : null}
          </View>
          <T v="bodyBold">{euro(i.amount, cents)}</T>
        </Row>
      ))}
      {sum !== false ? (
        <>
          <Divider style={{ marginVertical: 2 }} />
          <Row justify="space-between" accessibilityLabel={`${totalLabel}: ${euro(sum, cents)}`}>
            <T v="bodyBold">{totalLabel}</T>
            <T v="h3">{euro(sum, cents)}</T>
          </Row>
        </>
      ) : null}
    </View>
  );
}

/** Thin progress bar, value 0–1. */
export function ProgressBar({ value, color = colors.brand, height = 8, label }: { value: number; color?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height, borderRadius: height / 2, backgroundColor: colors.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export interface ChecklistItem {
  label: string;
  done: boolean;
  hint?: string;
  /** Where to fix it; shown as a tappable row while not done. */
  onPress?: () => void;
}

/** Completion checklist with progress (profile readiness, event setup…). */
export function Checklist({ items, title }: { items: ChecklistItem[]; title?: string }) {
  const done = items.filter((i) => i.done).length;
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Row justify="space-between">
          <T v="title">{title}</T>
          <T v="smallBold" color={done === items.length ? colors.success : colors.brand}>{done} of {items.length} done</T>
        </Row>
      ) : null}
      <ProgressBar value={items.length ? done / items.length : 0} color={done === items.length ? colors.success : colors.brand} label={title ? `${title}: ${done} of ${items.length} done` : undefined} />
      {items.map((i) => {
        const body = (
          <Row gap={12} style={{ minHeight: 44 }}>
            <Icon name={i.done ? 'check-circle' : 'checkbox-blank-circle-outline'} size={22} color={i.done ? colors.success : colors.disabled} />
            <View style={{ flex: 1 }}>
              <T v={i.done ? 'body' : 'bodyBold'} color={i.done ? colors.muted : colors.ink}>{i.label}</T>
              {i.hint && !i.done ? <T v="small">{i.hint}</T> : null}
            </View>
            {i.onPress && !i.done ? <Icon name="chevron-right" size={20} color={colors.subtle} /> : null}
          </Row>
        );
        return i.onPress && !i.done ? (
          <Pressable key={i.label} accessibilityRole="button" accessibilityLabel={`${i.label}, to do`} onPress={i.onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            {body}
          </Pressable>
        ) : (
          <View key={i.label} accessible accessibilityLabel={`${i.label}, ${i.done ? 'done' : 'to do'}`}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** Vertical step tracker. `failed` marks the current step as a problem (e.g. payment failed). */
export function Steps({ steps, current, failed }: { steps: { title: string; note?: string }[]; current: number; failed?: boolean }) {
  return (
    <View accessibilityLabel={`Step ${Math.max(0, current) + 1} of ${steps.length}: ${steps[current]?.title ?? ''}${failed ? ', needs attention' : ''}`}>
      {steps.map((st, i) => {
        const done = i < current;
        const cur = i === current;
        const ring = cur ? (failed ? colors.danger : colors.brand) : colors.borderStrong;
        return (
          <Row key={`${st.title}-${i}`} gap={14} align="flex-start">
            <View style={{ alignItems: 'center', width: 24 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? colors.brand : cur && failed ? colors.danger : colors.surface, borderWidth: done || (cur && failed) ? 0 : cur ? 4 : 2, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}>
                {done ? <Icon name="check" size={14} color={colors.white} /> : cur && failed ? <Icon name="exclamation" size={14} color={colors.white} /> : null}
              </View>
              {i < steps.length - 1 ? <View style={{ width: 2, height: 34, backgroundColor: done ? colors.brand : colors.track }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v={cur ? 'bodyBold' : 'body'} color={cur && failed ? colors.danger : i > current ? colors.subtle : colors.ink}>{st.title}</T>
              {st.note ? <T v="small" style={{ fontSize: 12 }}>{st.note}</T> : null}
            </View>
          </Row>
        );
      })}
    </View>
  );
}

/** Musician score badge: "92%" with a thumbs-up (would book again). Shows "New" without verified bookings. */
export function BookAgainBadge({ pct, total, dark = true }: { pct: number | null; total?: number; dark?: boolean }) {
  const label = pct == null ? 'New' : `${pct}%`;
  const a11y = pct == null ? 'No verified bookings yet' : `${pct}% would book again${total != null ? `, from ${total} verified booking${total === 1 ? '' : 's'}` : ''}`;
  return (
    <Row gap={4} accessibilityLabel={a11y} style={{ backgroundColor: dark ? colors.brandDark : colors.brandSoft, paddingHorizontal: 10, height: 30, borderRadius: 15, alignSelf: 'flex-start' }}>
      <Icon name={pct == null ? 'account-music-outline' : 'thumb-up'} size={15} color={dark ? colors.gold : colors.brand} />
      <Text style={{ color: dark ? colors.white : colors.brand, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
    </Row>
  );
}

/** Praise tags with counts, e.g. "On time · 12". */
export function TagCounts({ tags }: { tags: { tag: string; count: number }[] }) {
  if (!tags.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {tags.map((t) => (
        <View key={t.tag} accessible accessibilityLabel={`${t.tag}, mentioned ${t.count} time${t.count === 1 ? '' : 's'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.brand }}>{t.tag}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>{t.count}</Text>
        </View>
      ))}
    </View>
  );
}

/** One fact with an icon, e.g. parking or garden on a venue page. `available={false}` greys it out. */
export function InfoRow({ icon, label, value, available = true }: { icon: IconName; label: string; value?: string; available?: boolean }) {
  return (
    <Row gap={12} align="flex-start" style={{ minHeight: 44, paddingVertical: 4 }} accessibilityLabel={`${label}${value ? `: ${value}` : ''}`}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: available ? colors.brandSoft : colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={available ? colors.brand : colors.disabled} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T v="bodyBold" color={available ? colors.ink : colors.muted}>{label}</T>
        {value ? <T v="small">{value}</T> : null}
      </View>
    </Row>
  );
}

/** Tone names shared with lib/booking (success, warning, danger, brand, neutral). */
export type { Tone };

const styles = StyleSheet.create({
  verified: { position: 'absolute', right: -2, bottom: -2, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.warningStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  badgeDot: { minWidth: 12, width: 12, height: 12, top: 10, right: 11, paddingHorizontal: 0 },
  badgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.bodyBold },
});
