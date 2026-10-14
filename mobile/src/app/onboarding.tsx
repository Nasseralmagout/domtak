import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Photo, Row, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

const SLIDES: { image: ImgKey; title: string; tagline: string }[] = [
  { image: 'ill_onboard1', title: 'Discover news about musicians, music and music events', tagline: 'To your desire' },
  { image: 'ill_onboard2', title: 'Book and follow your favourite musicians', tagline: 'To your destination' },
  { image: 'ill_onboard3', title: 'Create and find your events', tagline: 'To your dream night' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const complete = useApp((s) => s.completeOnboarding);

  const finish = (to: '/register' | '/login') => {
    complete();
    router.replace(to);
  };
  const next = () => {
    if (index < SLIDES.length - 1) {
      list.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
    }
    else finish('/register');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Row justify="flex-end" style={{ paddingHorizontal: 20, height: 52 }}>
        <Pressable accessibilityRole="button" onPress={() => finish('/login')} hitSlop={10}>
          <T v="bodyBold" color={colors.brand}>Skip</T>
        </Pressable>
      </Row>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 32, justifyContent: 'center', gap: 36 }}>
            <Photo src={item.image} contentFit="contain" style={{ width: '100%', height: 260, backgroundColor: 'transparent' }} accessibilityLabel="" />
            <T v="h1" style={{ fontSize: 32, lineHeight: 40 }}>{item.title}</T>
          </View>
        )}
      />
      <View style={{ paddingHorizontal: 32, paddingBottom: 32, gap: 20 }}>
        <T v="body" style={{ fontSize: 22, color: colors.inkSoft }}>{SLIDES[index].tagline}</T>
        <Row justify="space-between">
          <Row gap={6} accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <View key={s.title} style={{ width: i === index ? 36 : 18, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.brandDeep : '#A49ADB' }} />
            ))}
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={index === SLIDES.length - 1 ? 'Get started' : 'Next slide'}
            onPress={next}
            style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <Icon name="chevron-right" size={32} color={colors.white} />
          </Pressable>
        </Row>
      </View>
    </SafeAreaView>
  );
}
