import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtistTile } from '../../components/cards';
import { DomtakHeader } from '../../components/layout';
import { Icon, Photo, Row, T } from '../../components/ui';
import { artistCategories, profiles } from '../../data/mock';
import { colors, fonts, shadow } from '../../theme';

export default function ArtistsTab() {
  const trending = profiles.filter((p) => ['dj', 'musician', 'band'].includes(p.kind)).sort((a, b) => b.followers - a.followers).slice(0, 8);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader />
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Book an artist for your event" onPress={() => router.push('/artists/all')} style={{ height: 210 }}>
          <Photo src="band_stage" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient colors={['rgba(20,10,40,0.1)', 'rgba(20,10,40,0.92)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 22, gap: 6 }}>
            <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 }}>MUSICIAN MARKETPLACE</Text>
            <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 24 }}>Book Berlin’s best talent</Text>
            <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>Verified profiles, clear fees, payment held safely in escrow.</Text>
          </View>
        </Pressable>

        <View style={{ padding: 16, gap: 14 }}>
          <Pressable accessibilityRole="search" accessibilityLabel="Search musicians, bands, DJs" onPress={() => router.push('/search?type=musician')} style={{ height: 48, borderRadius: 14, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, ...shadow(1) }}>
            <Icon name="magnify" size={22} color={colors.muted} />
            <T v="body" color={colors.subtle}>Search musicians, bands, DJs</T>
          </Pressable>
          <T v="h3" color={colors.brandDeep}>Category</T>
          {artistCategories.map((c) => (
            <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={c.label} onPress={() => router.push(`/artists/${c.key}`)} style={{ height: 150, borderRadius: 22, overflow: 'hidden', ...shadow(2) }}>
              <Photo src={c.image} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,10,40,0.35)' }} />
              <Text style={{ position: 'absolute', alignSelf: 'center', top: 40, color: colors.white, fontFamily: fonts.display, fontSize: 52, lineHeight: 64 }}>{c.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Venues" onPress={() => router.push('/venues')} style={{ height: 110, borderRadius: 22, overflow: 'hidden', ...shadow(2) }}>
            <Photo src="ven_moon" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,10,40,0.45)' }} />
            <Row style={{ position: 'absolute', left: 20, right: 20, top: 0, bottom: 0 }} justify="space-between">
              <View>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }}>Venues</Text>
                <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>Clubs, halls, gardens & lofts</Text>
              </View>
              <Icon name="chevron-right" size={32} color={colors.white} />
            </Row>
          </Pressable>

          <Row justify="space-between" style={{ marginTop: 8 }}>
            <T v="h3" color={colors.brandDeep}>Trending artists</T>
            <Pressable accessibilityRole="button" accessibilityLabel="See all artists" onPress={() => router.push('/artists/all')} hitSlop={12}><T v="smallBold" color={colors.brand}>See all</T></Pressable>
          </Row>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}>
          {trending.map((a) => <ArtistTile key={a.id} artist={a} />)}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}
