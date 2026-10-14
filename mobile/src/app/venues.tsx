import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';

import { VenueCard } from '../components/cards';
import { goBack } from '../components/layout';
import { Chip, EmptyState, IconButton, Photo, Row, T } from '../components/ui';
import { venues } from '../data/mock';
import type { Venue } from '../data/types';
import { colors, fonts } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const TYPES: ('All' | Venue['type'])[] = ['All', 'Club', 'Open air', 'Hall', 'Garden', 'Loft', 'Bar'];

export default function Venues() {
  const [type, setType] = useState<(typeof TYPES)[number]>('All');
  const list = useMemo(() => (type === 'All' ? venues : venues.filter((v) => v.type === type)), [type]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={list}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            <View style={{ height: 220 }}>
              <Photo src="ev_lights" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(20,10,40,0.85)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <SafeAreaView edges={['top']} style={{ paddingHorizontal: 8 }}>
                <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/(tabs)/artists')} />
              </SafeAreaView>
              <View style={{ position: 'absolute', left: 20, bottom: 22, right: 20 }}>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }}>All venues</Text>
                <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>{venues.length} spaces to book in Berlin · escrow protected</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 8 }}>
              {TYPES.map((t) => <Chip key={t} label={t} tone="dark" selected={type === t} onPress={() => setType(t)} />)}
            </ScrollView>
            <Row style={{ paddingHorizontal: 16, paddingBottom: 12 }}><T v="small">{list.length} venue{list.length === 1 ? '' : 's'}</T></Row>
          </View>
        }
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}><VenueCard venue={item} /></View>}
        ListEmptyComponent={<EmptyState icon="storefront-outline" title="No venues of this type" body="Try another category." />}
      />
    </View>
  );
}
