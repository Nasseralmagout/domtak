import { router } from 'expo-router';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../components/layout';
import { Button, Chip, Row, T, Toggle } from '../components/ui';
import { GENRES } from '../data/mock';
import { euro } from '../lib/format';
import { DEFAULT_FILTERS, type Filters, useFilters } from '../store/filters';
import { colors } from '../theme';

function PriceSlider({ value, onChange, max = 250 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const [w, setW] = useState(1);
  const pct = value / max;
  const setFrom = (x: number) => onChange(Math.max(0, Math.min(max, Math.round(((x / w) * max) / 5) * 5)));
  return (
    <View style={{ gap: 6 }}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Maximum price"
        accessibilityValue={{ min: 0, max, now: value, text: euro(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? 10 : -10))))}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setFrom(e.nativeEvent.locationX)}
        onResponderMove={(e) => setFrom(e.nativeEvent.locationX)}
        style={{ height: 36, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: '#8A8496' }}>
          <View style={{ height: 6, borderRadius: 3, width: `${pct * 100}%`, backgroundColor: colors.brandDeep }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, pct * w - 14), width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandDeep, borderWidth: 3, borderColor: colors.white }} />
      </View>
      <Row justify="space-between">
        <T v="small" color={colors.ink}>€0</T>
        <T v="smallBold" color={colors.brand}>up to {euro(value)}</T>
        <T v="small" color={colors.ink}>{euro(max)}</T>
      </Row>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <T v="title">{title}</T>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{children}</Row>
    </View>
  );
}

export default function FiltersScreen() {
  const current = useFilters((s) => s.filters);
  const apply = useFilters((s) => s.set);
  const [f, setF] = useState<Filters>(current);
  const up = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const toggleIn = (key: 'categories' | 'styles', v: string) => up({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] } as Partial<Filters>);

  return (
    <Screen
      header={<ScreenHeader title="Filters" right={<Pressable accessibilityRole="button" onPress={() => setF(DEFAULT_FILTERS)} style={{ paddingHorizontal: 16 }}><T v="bodyBold" color={colors.brand}>Reset</T></Pressable>} />}
      contentStyle={{ gap: 26, paddingHorizontal: 20 }}
      footer={
        <BottomBar>
          <Button title="Show results" onPress={() => { apply(f); router.back(); }} />
        </BottomBar>
      }
    >
      <Group title="Location">
        <Chip label="Current location" icon="crosshairs-gps" selected={f.location === 'current'} onPress={() => up({ location: 'current' })} />
        <Chip label="Search for location" icon="magnify" selected={f.location === 'search'} onPress={() => up({ location: 'search' })} />
      </Group>
      <Group title="Date">
        {([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['month', 'This month'], ['any', 'Any date']] as const).map(([k, l]) => (
          <Chip key={k} label={l} selected={f.date === k} onPress={() => up({ date: k })} />
        ))}
      </Group>
      <Group title="Time of the day">
        {([['day', 'Day'], ['night', 'Night'], ['any', 'Any time']] as const).map(([k, l]) => (
          <Chip key={k} label={l} selected={f.time === k} onPress={() => up({ time: k })} />
        ))}
      </Group>
      <View style={{ gap: 12 }}>
        <Row justify="space-between">
          <T v="title">Price range</T>
          <Row gap={8}><T v="small">Free only</T><Toggle label="Free events only" value={f.freeOnly} onValueChange={(v) => up({ freeOnly: v })} /></Row>
        </Row>
        <PriceSlider value={f.maxPrice} onChange={(n) => up({ maxPrice: n })} />
      </View>
      <Group title="Categories">
        {['Concerts', 'Parties', 'Electronic', 'Listening', 'Festivals', 'Acoustic', 'Family'].map((c) => (
          <Chip key={c} label={c} selected={f.categories.includes(c)} onPress={() => toggleIn('categories', c)} />
        ))}
      </Group>
      <Group title="Music style">
        {GENRES.map((g) => <Chip key={g} label={g} selected={f.styles.includes(g)} onPress={() => toggleIn('styles', g)} />)}
      </Group>
    </Screen>
  );
}
