import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../components/layout';
import { Button, Chip, Field, Icon, Photo, Row, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

const LIBRARY: ImgKey[] = ['feed_friends', 'feed_crowd', 'ev_dancing', 'feed_rooftop', 'ev_selfie', 'feed_picnic', 'ev_hands', 'feed_street', 'feed_castle'];

export default function NewPost() {
  const { story } = useLocalSearchParams<{ story?: string }>();
  const isStory = story === '1';
  const addPost = useApp((s) => s.addPost);
  const [picked, setPicked] = useState<ImgKey[]>(['feed_friends']);
  const [caption, setCaption] = useState('');
  const [music, setMusic] = useState('');
  const [location, setLocation] = useState('Berlin');
  const [visibility, setVisibility] = useState<'Public' | 'Followers'>('Public');
  const [addLocation, setAddLocation] = useState(true);

  const toggle = (k: ImgKey) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : isStory ? [k] : [...p, k].slice(0, 6)));

  const publish = () => {
    if (!picked.length) return;
    addPost({
      kind: picked.length > 1 ? 'carousel' : 'photo',
      media: picked,
      caption: caption.trim() || (isStory ? 'New story' : ''),
      location: addLocation ? location : undefined,
      track: music.trim() || undefined,
    });
    router.replace('/(tabs)');
  };

  return (
    <Screen
      keyboard
      header={<ScreenHeader title={isStory ? 'New story' : 'New post'} close />}
      footer={
        <BottomBar>
          <Button title={isStory ? 'Share story' : 'Publish'} onPress={publish} disabled={!picked.length} />
        </BottomBar>
      }
    >
      <View style={{ borderRadius: 18, overflow: 'hidden' }}>
        {picked[0] ? <Photo src={picked[0]} style={{ height: 260 }} /> : (
          <View style={{ height: 200, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9C8FC2', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="image-outline" size={34} color={colors.brand} />
            <T v="bodyBold">Choose photos or a video</T>
            <T v="small">PNG, GIF, WEBP, MP4 or MP3 · max 1 GB</T>
          </View>
        )}
        {picked.length > 1 ? (
          <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <T v="smallBold" color={colors.white}>{picked.length} selected</T>
          </View>
        ) : null}
      </View>
      <T v="label">{isStory ? 'Pick one photo' : 'Pick up to 6 (multi-file)'}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Upload from device" style={{ width: '31.5%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera-outline" size={28} color={colors.brand} />
        </Pressable>
        {LIBRARY.map((k) => {
          const i = picked.indexOf(k);
          return (
            <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: i >= 0 }} onPress={() => toggle(k)} style={{ width: '31.5%', aspectRatio: 1 }}>
              <Photo src={k} style={{ flex: 1, borderRadius: 12, borderWidth: i >= 0 ? 3 : 0, borderColor: colors.brand }} />
              {i >= 0 ? (
                <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="smallBold" color={colors.white}>{i + 1}</T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {!isStory ? (
        <>
          <Field label="Caption" value={caption} onChangeText={setCaption} multiline placeholder="Write something about the night…" />
          <Field label="Music link" value={music} onChangeText={setMusic} placeholder="Song name, SoundCloud or Spotify link" icon="music-note" />
          <Row gap={12}>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">Add location</T>
              <T v="small">Show where this was taken</T>
            </View>
            <Toggle label="Add location" value={addLocation} onValueChange={setAddLocation} />
          </Row>
          {addLocation ? <Field value={location} onChangeText={setLocation} icon="map-marker-outline" /> : null}
          <T v="label">Visibility</T>
          <Row gap={8}>
            {(['Public', 'Followers'] as const).map((v) => <Chip key={v} label={v} selected={visibility === v} onPress={() => setVisibility(v)} />)}
          </Row>
        </>
      ) : (
        <Field label="Text on story" value={caption} onChangeText={setCaption} placeholder="Say something…" />
      )}
    </Screen>
  );
}
