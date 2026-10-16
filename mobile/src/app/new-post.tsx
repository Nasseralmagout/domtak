import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Card, Chip, Divider, Field, Icon, type IconName, Photo, Pill, Row, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import type { PostVisibility } from '../data/types';
import { toast } from '../store/toast';
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, canPostToFeed, isPro, ROLE_LABEL, useApp } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

const LIBRARY: ImgKey[] = ['feed_friends', 'feed_crowd', 'ev_dancing', 'feed_rooftop', 'ev_selfie', 'feed_picnic', 'ev_hands', 'feed_street', 'feed_castle'];
/** "Camera roll" shots offered by the upload tile in this build. */
const CAMERA_ROLL: ImgKey[] = ['feed_club', 'ev_lasers2', 'feed_decks', 'ev_red_crowd', 'feed_openair', 'ev_purple_arena'];

/** Where members can still share photos: inside comments (user note 2). */
const PHOTO_PLACES: { icon: IconName; title: string; sub: string; href: string }[] = [
  { icon: 'comment-outline', title: 'Comments on posts', sub: 'Open any post in your feed and tap the photo button', href: '/(tabs)' },
  { icon: 'comment-text-multiple-outline', title: 'Event discussions', sub: 'Share the view from the dance floor with other guests', href: '/(tabs)/events' },
  { icon: 'account-group-outline', title: 'Communities', sub: 'Comment on posts in the music communities you join', href: '/communities' },
];

/**
 * Members (and professionals not working in an approved workspace) cannot post to the feed or stories.
 * Explains why, routes to the professional application, or offers to switch to an approved workspace.
 */
function PostingNotAllowed({ isStory }: { isStory: boolean }) {
  const user = useApp((s) => s.user);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const approvedPro = (user.approvedRoles ?? []).find((r) => isPro(r));
  const app = user.application;
  const what = isStory ? 'Stories' : 'Feed posts';

  return (
    <Screen
      header={<ScreenHeader title={isStory ? 'New story' : 'New post'} close onBack={() => goBack('/(tabs)')} />}
      footer={
        <BottomBar>
          <Button title="Back" variant="secondary" onPress={() => goBack('/(tabs)')} />
        </BottomBar>
      }
    >
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 12 }}>
        <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield-account-outline" size={48} color={colors.brand} />
        </View>
        <T v="h2" center>{what} are for verified professionals</T>
        <T v="body" color={colors.muted} center>
          Posting photos and videos to the feed is for verified professionals. You can add photos to comments.
        </T>
      </View>

      {approvedPro ? (
        <Card style={{ gap: 10 }}>
          <Row gap={8}>
            <Icon name="check-decagram" size={20} color={colors.success} />
            <T v="title" style={{ flex: 1 }}>You’re approved as {ROLE_LABEL[approvedPro].toLowerCase()}</T>
          </Row>
          <T v="small">You’re in your member workspace right now. Switch to your professional workspace to post to the feed and share stories.</T>
          <Button
            title={`Switch to ${ROLE_LABEL[approvedPro]}`}
            size="md"
            icon="swap-horizontal"
            onPress={() => {
              if (switchWorkspace(approvedPro)) toast(`Switched to your ${ROLE_LABEL[approvedPro]} workspace`);
              else toast('This workspace is not approved yet');
            }}
          />
        </Card>
      ) : app ? (
        <Card style={{ gap: 10 }}>
          <Row justify="space-between" gap={8}>
            <T v="title" style={{ flex: 1 }}>Your {ROLE_LABEL[app.role].toLowerCase()} application</T>
            <Pill label={APPLICATION_STATUS_LABEL[app.status]} tone={APPLICATION_STATUS_TONE[app.status]} />
          </Row>
          <T v="small">
            {app.status === 'pending'
              ? 'Our team is reviewing it. You can post once it is approved.'
              : app.status === 'info'
                ? `We need more information: ${app.missing?.join(', ') || app.reason || 'open your application to see what is missing'}.`
                : app.status === 'rejected'
                  ? `It was not approved${app.reason ? `: ${app.reason}` : ''}. You can update it and apply again.`
                  : 'Approved. Switch to your professional workspace to post.'}
          </T>
          {/* A pending application opens its status; one that needs changes opens the form again. */}
          <Button
            title={app.status === 'pending' ? 'View application status' : 'Update application'}
            size="md"
            variant="secondary"
            onPress={() => router.push((app.status === 'pending' ? '/pro-verification' : '/apply') as never)}
          />
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <T v="title">Are you an artist, venue or organizer?</T>
          <T v="small">Apply for a professional account. Our team reviews every application, and your member account keeps working meanwhile.</T>
          <Button title="Apply as a professional" size="md" icon="check-decagram" onPress={() => router.push('/apply' as never)} />
        </Card>
      )}

      <T v="label">Where you can share photos</T>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 4, ...shadow(1) }}>
        {PHOTO_PLACES.map((p, i) => (
          <View key={p.href}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${p.title}. ${p.sub}`}
              onPress={() => router.push(p.href as never)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={p.icon} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{p.title}</T>
                <T v="small">{p.sub}</T>
              </View>
              <Icon name="chevron-right" size={22} color={colors.subtle} />
            </Pressable>
          </View>
        ))}
      </View>
    </Screen>
  );
}

export default function NewPost() {
  const { story } = useLocalSearchParams<{ story?: string }>();
  const isStory = story === '1';
  const user = useApp((s) => s.user);
  if (!canPostToFeed(user)) return <PostingNotAllowed isStory={isStory} />;
  return <Composer isStory={isStory} roleLabel={ROLE_LABEL[user.role]} />;
}

/** The full composer for approved professionals in their professional workspace. */
function Composer({ isStory, roleLabel }: { isStory: boolean; roleLabel: string }) {
  const addPost = useApp((s) => s.addPost);
  const [picked, setPicked] = useState<ImgKey[]>(['feed_friends']);
  const [uploads, setUploads] = useState<ImgKey[]>([]);
  const [caption, setCaption] = useState('');
  const [music, setMusic] = useState('');
  const [location, setLocation] = useState('Berlin');
  const [visibility, setVisibility] = useState<PostVisibility>('Public');
  const [addLocation, setAddLocation] = useState(true);
  const max = isStory ? 1 : 6;

  const toggle = (k: ImgKey) => {
    if (picked.includes(k)) return setPicked(picked.filter((x) => x !== k));
    if (isStory) return setPicked([k]);
    if (picked.length >= max) {
      toast(`You can add up to ${max} photos`);
      return;
    }
    setPicked([...picked, k]);
  };

  const upload = () => {
    // Device uploads need the installed app's photo permission; here the next camera-roll shot is added.
    const next = CAMERA_ROLL.find((k) => !uploads.includes(k));
    if (!next) {
      toast('All recent camera photos are already added');
      return;
    }
    setUploads([next, ...uploads]);
    if (!isStory && picked.length >= max) {
      toast(`Added to your photos. Deselect one to use it (max ${max})`);
      return;
    }
    setPicked(isStory ? [next] : [...picked, next]);
    toast('Added your latest photo from the camera roll');
  };

  const publish = () => {
    if (!picked.length) return;
    // Stories have no visibility picker and are always public.
    const vis: PostVisibility = isStory ? 'Public' : visibility;
    addPost(
      {
        kind: picked.length > 1 ? 'carousel' : 'photo',
        media: picked,
        caption: caption.trim() || (isStory ? 'New story' : ''),
        location: addLocation && location.trim() ? location.trim() : undefined,
        track: music.trim() || undefined,
      },
      vis,
    );
    // Stories are published as a post at the top of your feed and on your profile (the stories row shows sample stories only).
    toast(isStory ? 'Story shared. It’s at the top of your feed.' : vis === 'Public' ? 'Post published' : 'Shared with your followers. Find it in the Following feed.');
    router.replace(vis === 'Followers' ? '/(tabs)?tab=following' : '/(tabs)');
  };

  return (
    <Screen
      keyboard
      header={<ScreenHeader title={isStory ? 'New story' : 'New post'} subtitle={`Posting as ${roleLabel}`} close onBack={() => goBack('/(tabs)')} />}
      footer={
        <BottomBar>
          <Button title={isStory ? 'Share story' : 'Publish'} onPress={publish} disabled={!picked.length} />
        </BottomBar>
      }
    >
      <View style={{ borderRadius: 18, overflow: 'hidden' }}>
        {picked[0] ? <Photo src={picked[0]} style={{ height: 260 }} accessibilityLabel="Selected photo preview" /> : (
          <Pressable accessibilityRole="button" accessibilityLabel="Add a photo from the camera roll" onPress={upload} style={{ height: 200, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9C8FC2', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="image-outline" size={34} color={colors.brand} />
            <T v="bodyBold">Choose photos below</T>
            <T v="small">Or tap here to add your latest camera photo</T>
          </Pressable>
        )}
        {picked.length > 1 ? (
          <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <T v="smallBold" color={colors.white}>{picked.length} selected</T>
          </View>
        ) : null}
      </View>
      <Row justify="space-between">
        <T v="label">{isStory ? 'Pick one photo' : `Pick up to ${max} (multi-file)`}</T>
        {!isStory && picked.length ? <T v="smallBold" color={colors.brand}>{picked.length}/{max}</T> : null}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Upload from device" accessibilityHint="Adds your latest camera photo" onPress={upload} style={{ width: '31.5%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Icon name="camera-outline" size={28} color={colors.brand} />
          <T v="smallBold" color={colors.brand} style={{ fontSize: 12 }}>Camera roll</T>
        </Pressable>
        {[...uploads, ...LIBRARY].map((k, idx) => {
          const i = picked.indexOf(k);
          return (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Photo ${idx + 1}${i >= 0 ? `, selected ${i + 1}` : ''}`} accessibilityState={{ selected: i >= 0 }} onPress={() => toggle(k)} style={{ width: '31.5%', aspectRatio: 1 }}>
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
          {addLocation ? <Field value={location} onChangeText={setLocation} icon="map-marker-outline" accessibilityLabel="Location" placeholder="Where was this?" /> : null}
          <T v="label">Visibility</T>
          <Row gap={8}>
            {(['Public', 'Followers'] as const).map((v) => (
              <Chip
                key={v}
                label={v}
                icon={v === 'Public' ? 'earth' : 'account-group-outline'}
                selected={visibility === v}
                accessibilityLabel={v === 'Public' ? 'Visibility: Public' : 'Visibility: Followers only'}
                onPress={() => setVisibility(v)}
              />
            ))}
          </Row>
          <T v="small">
            {visibility === 'Public'
              ? 'Anyone on Domtak can see this post in For you, Following and Nearby.'
              : 'Only your followers see this post, in their Following feed. It won’t appear in For you or Nearby.'}
          </T>
        </>
      ) : (
        <Field label="Text on story" value={caption} onChangeText={setCaption} placeholder="Say something…" />
      )}
    </Screen>
  );
}
