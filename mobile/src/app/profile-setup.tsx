import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Button, Chip, Field, Icon, Row, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import { GENRES } from '../data/mock';
import { isPro, ROLE_LABEL, useApp } from '../store/useApp';
import { colors } from '../theme';

const AVATARS: ImgKey[] = ['av_leyla', 'av_clara', 'av_finn', 'av_zoe', 'av_tom', 'av_emma'];

export default function ProfileSetup() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === 'edit';
  const user = useApp((s) => s.user);
  const update = useApp((s) => s.updateUser);
  const signIn = useApp((s) => s.signIn);
  const nearby = useApp((s) => s.prefs.nearby);
  const setPref = useApp((s) => s.setPref);

  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const [city, setCity] = useState(user.city);
  const [avatar, setAvatar] = useState<ImgKey | undefined>(user.avatar);
  const [genres, setGenres] = useState<string[]>(user.genres);
  const [fee, setFee] = useState('300');

  const save = () => {
    update({ name: name.trim() || user.name, handle: handle.startsWith('@') ? handle : `@${handle}`, bio, city, avatar, genres });
    if (editing) router.back();
    else {
      signIn(user.email);
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top']}
      header={<ScreenHeader title={editing ? 'Edit profile' : undefined} right={editing ? null : <T v="smallBold" color={colors.muted} style={{ paddingRight: 16 }}>Step 2 of 2</T>} />}
      contentStyle={{ paddingHorizontal: 24, gap: 18 }}
      footer={
        <BottomBar>
          <Button title={editing ? 'Save changes' : 'Finish & explore'} onPress={save} />
          {!editing ? (
            <Pressable accessibilityRole="button" onPress={save} style={{ alignItems: 'center', paddingTop: 10 }}>
              <T v="smallBold" color={colors.brand}>Skip for now</T>
            </Pressable>
          ) : null}
        </BottomBar>
      }
    >
      {!editing ? <T v="h1">Set up your profile</T> : null}
      <Row gap={16}>
        <Avatar src={avatar} size={84} label={name} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="bodyBold">Profile photo</T>
          <T v="small">A clear photo helps fans and bookers recognise you.</T>
        </View>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Upload photo" style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9C8FC2', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera-outline" size={24} color={colors.brand} />
        </Pressable>
        {AVATARS.map((a) => (
          <Pressable key={a} accessibilityRole="button" accessibilityLabel="Choose this photo" onPress={() => setAvatar(a)}>
            <Avatar src={a} size={56} ring={avatar === a ? colors.brand : false} />
          </Pressable>
        ))}
      </ScrollView>

      <Row gap={12}>
        <Field label="Display name" value={name} onChangeText={setName} style={{ flex: 1 }} />
        <Field label="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" style={{ flex: 1 }} />
      </Row>
      <Field label="Short bio" value={bio} onChangeText={setBio} multiline placeholder="Techno lover, Kreuzberg regular…" />
      <Field label="Location" value={city} onChangeText={setCity} icon="map-marker-outline" />

      <View style={{ gap: 10 }}>
        <T v="label">Music you love</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {GENRES.map((g) => {
            const on = genres.includes(g);
            return <Chip key={g} label={g} selected={on} onPress={() => setGenres(on ? genres.filter((x) => x !== g) : [...genres, g])} />;
          })}
        </Row>
      </View>

      {isPro(user.role) ? (
        <View style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.brandTint }}>
          <T v="title">Professional details · {ROLE_LABEL[user.role]}</T>
          {user.role === 'musician' ? <Field label="Booking fee per hour (€)" value={fee} onChangeText={setFee} keyboardType="number-pad" /> : null}
          {user.role === 'venue' ? <Field label="Venue name" placeholder="e.g. Moon Club" /> : null}
          {user.role === 'organizer' ? <Field label="Organizer / company name" placeholder="e.g. OG Collective" /> : null}
          <T v="small">You can complete Pro verification later from Settings to get the purple badge and payouts.</T>
        </View>
      ) : null}

      <Row gap={12}>
        <View style={{ flex: 1 }}>
          <T v="bodyBold">Notify me about nearby events</T>
          <T v="small">New gigs from people you follow</T>
        </View>
        <Toggle label="Notify me about nearby events" value={nearby} onValueChange={(v) => setPref('nearby', v)} />
      </Row>
    </Screen>
  );
}
