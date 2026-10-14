import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Button, Chip, Field, Icon, Row, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import { GENRES } from '../data/mock';
import { toast } from '../store/toast';
import { isPro, ROLE_LABEL, useApp } from '../store/useApp';
import { colors } from '../theme';

const AVATARS: ImgKey[] = ['av_leyla', 'av_clara', 'av_finn', 'av_zoe', 'av_tom', 'av_emma'];
/** Recent selfies offered by the camera tile in this build. */
const CAMERA_ROLL: ImgKey[] = ['av_greta', 'av_jule', 'av_maya', 'av_nina'];

export default function ProfileSetup() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === 'edit';
  const user = useApp((s) => s.user);
  const update = useApp((s) => s.updateUser);
  const signIn = useApp((s) => s.signIn);
  const nearby = useApp((s) => s.prefs.nearby);
  const setPref = useApp((s) => s.setPref);
  const feePerHour = useApp((s) => s.availability.feePerHour);
  const setAvailability = useApp((s) => s.setAvailability);
  const venueName = useApp((s) => s.venueListing.name);
  const updateVenueListing = useApp((s) => s.updateVenueListing);

  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const [city, setCity] = useState(user.city);
  const [avatar, setAvatar] = useState<ImgKey | undefined>(user.avatar);
  const [genres, setGenres] = useState<string[]>(user.genres);
  const [fee, setFee] = useState(String(feePerHour));
  const [venue, setVenue] = useState(venueName);
  const [uploads, setUploads] = useState<ImgKey[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cleanHandle = `@${handle.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')}`;

  const finish = () => {
    if (editing) {
      toast('Profile updated');
      goBack('/profile/me');
    } else {
      signIn(user.email);
      router.replace('/(tabs)');
    }
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter at least 2 characters';
    if (cleanHandle.length < 3) e.handle = 'Pick a username with letters or numbers';
    if (user.role === 'musician' && !(Number(fee) > 0)) e.fee = 'Enter your hourly fee in euro';
    if (user.role === 'venue' && venue.trim().length < 2) e.venue = 'Enter your venue’s name';
    setErrors(e);
    if (Object.keys(e).length) return;
    update({ name: name.trim(), handle: cleanHandle, bio: bio.trim(), city: city.trim() || user.city, avatar, genres });
    if (user.role === 'musician') setAvailability({ feePerHour: Number(fee) });
    if (user.role === 'venue') updateVenueListing({ name: venue.trim() });
    finish();
  };

  const takePhoto = () => {
    // Camera capture needs the installed app; here the newest selfie from the camera roll is used.
    const next = CAMERA_ROLL.find((k) => !uploads.includes(k));
    if (!next) {
      toast('All recent photos are already added');
      return;
    }
    setUploads((u) => [next, ...u]);
    setAvatar(next);
    toast('Photo added from your camera roll');
  };

  return (
    <Screen
      keyboard
      edges={['top']}
      header={<ScreenHeader title={editing ? 'Edit profile' : undefined} onBack={() => goBack(editing ? '/profile/me' : '/role')} right={editing ? null : <T v="smallBold" color={colors.muted} style={{ paddingRight: 16 }}>Step 2 of 2</T>} />}
      contentStyle={{ paddingHorizontal: 24, gap: 18 }}
      footer={
        <BottomBar>
          {Object.keys(errors).length ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{Object.values(errors)[0]}</T> : null}
          <Button title={editing ? 'Save changes' : 'Finish & explore'} onPress={save} />
          {!editing ? (
            <Pressable accessibilityRole="button" accessibilityHint="Keeps your current details and opens the app" onPress={finish} style={{ alignItems: 'center', paddingTop: 10, minHeight: 40 }}>
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
        <Pressable accessibilityRole="button" accessibilityLabel="Upload photo" accessibilityHint="Adds your latest photo from the camera roll" onPress={takePhoto} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9C8FC2', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera-outline" size={24} color={colors.brand} />
        </Pressable>
        {[...uploads, ...AVATARS].map((a, i) => (
          <Pressable key={a} accessibilityRole="button" accessibilityLabel={`Profile photo option ${i + 1}`} accessibilityState={{ selected: avatar === a }} onPress={() => setAvatar(a)}>
            <Avatar src={a} size={56} ring={avatar === a ? colors.brand : false} />
          </Pressable>
        ))}
      </ScrollView>

      <Row gap={12}>
        <Field label="Display name" value={name} onChangeText={setName} style={{ flex: 1 }} error={errors.name} maxLength={40} />
        <Field label="Username" value={handle} onChangeText={setHandle} onBlur={() => setHandle(cleanHandle)} autoCapitalize="none" autoCorrect={false} style={{ flex: 1 }} error={errors.handle} maxLength={30} />
      </Row>
      <Field label={`Short bio · ${bio.length}/150`} value={bio} onChangeText={setBio} multiline maxLength={150} placeholder="Techno lover, Kreuzberg regular…" />
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
          {user.role === 'musician' ? <Field label="Booking fee per hour (€)" value={fee} onChangeText={(t) => setFee(t.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" error={errors.fee} /> : null}
          {user.role === 'venue' ? <Field label="Venue name" value={venue} onChangeText={setVenue} placeholder="e.g. Moon Club" error={errors.venue} /> : null}
          {user.role === 'organizer' ? <T v="small">Your display name is shown as the organizer on your events.</T> : null}
          <T v="small">You can complete Pro verification later from Settings to get the purple badge and payouts.</T>
          {editing ? (
            <Button
              title={user.role === 'musician' ? 'Availability & fees' : user.role === 'venue' ? 'Edit venue listing' : 'Your events'}
              variant="light"
              size="sm"
              icon="arrow-right"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => router.push(user.role === 'musician' ? '/pro/availability' : user.role === 'venue' ? '/pro/venue-listing' : '/pro/events')}
            />
          ) : null}
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
