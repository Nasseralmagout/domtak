import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Chip, Field, Icon, Row, T } from '../components/ui';
import { GENRES } from '../data/mock';
import { safeNext, WORKSPACE_SUMMARY } from '../lib/access';
import { useApp } from '../store/useApp';
import { colors, radius } from '../theme';

const CITIES = ['Berlin', 'Hamburg', 'Leipzig', 'Munich', 'Cologne'];

/** "Berlin, Germany" -> "Berlin" for matching the city chips. */
const cityName = (c: string) => c.split(',')[0].trim();

/**
 * Sign-up step 1 of 2 (blueprint F01): city and music interests. Every sign-up creates a member;
 * artists, venues and organizers apply for a professional account right after (F02).
 */
export default function ChooseInterests() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const user = useApp((s) => s.user);
  const update = useApp((s) => s.updateUser);
  const initialCity = cityName(user.city);
  // A city chip or a typed city: typing clears the chip, picking a chip clears the text.
  const [chip, setChip] = useState(CITIES.includes(initialCity) ? initialCity : '');
  const [typed, setTyped] = useState(CITIES.includes(initialCity) ? '' : initialCity);
  const city = typed.trim() || chip;
  const [genres, setGenres] = useState<string[]>(user.genres);
  const [errors, setErrors] = useState<{ city?: string; genres?: string }>({});

  const save = () => {
    const e: typeof errors = {};
    if (city.length < 2) e.city = 'Pick or enter your city';
    if (!genres.length) e.genres = 'Pick at least one style so your feed fits you';
    setErrors(e);
    if (e.city || e.genres) return false;
    update({ city: chip && !typed.trim() ? `${chip}, Germany` : city, genres });
    return true;
  };

  const continueAs = (professional: boolean) => {
    if (!save()) return;
    const dest = professional ? '/apply' : safeNext(next);
    router.push({ pathname: '/profile-setup', params: dest ? { next: dest } : {} });
  };

  return (
    <Screen
      keyboard
      header={<ScreenHeader onBack={() => goBack('/verify')} right={<T v="smallBold" color={colors.muted} style={{ paddingRight: 16 }}>Step 1 of 2</T>} />}
      contentStyle={{ paddingHorizontal: 24, gap: 20 }}
    >
      <View style={{ gap: 8 }}>
        <T v="h1">Make Domtak yours</T>
        <T v="body" color={colors.muted}>Tell us where you go out and what you listen to. We use it for nearby events, communities and artists.</T>
      </View>

      <View style={{ gap: 10 }}>
        <T v="label">Your city</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {CITIES.map((c) => (
            <Chip key={c} label={c} icon={chip === c && !typed.trim() ? 'map-marker' : undefined} selected={chip === c && !typed.trim()} onPress={() => { setChip(c); setTyped(''); setErrors((x) => ({ ...x, city: undefined })); }} />
          ))}
        </Row>
        <Field placeholder="Or type another city" accessibilityLabel="City" value={typed} onChangeText={(t) => { setTyped(t); if (t.trim()) setChip(''); setErrors((x) => ({ ...x, city: undefined })); }} icon="map-marker-outline" autoComplete="postal-address-locality" error={errors.city} />
      </View>

      <View style={{ gap: 10 }}>
        <Row justify="space-between">
          <T v="label">Music you love</T>
          <T v="small">{genres.length ? `${genres.length} selected` : 'Pick one or more'}</T>
        </Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {GENRES.map((g) => {
            const on = genres.includes(g);
            return <Chip key={g} label={g} selected={on} onPress={() => { setGenres(on ? genres.filter((x) => x !== g) : [...genres, g]); setErrors((x) => ({ ...x, genres: undefined })); }} />;
          })}
        </Row>
        {errors.genres ? <T v="small" color={colors.danger}>{errors.genres}</T> : null}
      </View>

      <View style={{ gap: 6, padding: 16, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
        <Row gap={10}>
          <Icon name="account-heart-outline" size={22} color={colors.brand} />
          <T v="bodyBold">You’re joining as a member</T>
        </Row>
        <T v="small">{WORKSPACE_SUMMARY.fan}</T>
      </View>

      <Button title="Continue" onPress={() => continueAs(false)} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="I’m an artist, venue or organizer. Apply for a professional account after sign-up"
        onPress={() => continueAs(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="briefcase-outline" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyBold">I’m an artist, venue or organizer</T>
          <T v="small">Apply for a professional account after sign-up. You use Domtak as a member while we review it (target 24 hours).</T>
        </View>
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Pressable>
    </Screen>
  );
}
