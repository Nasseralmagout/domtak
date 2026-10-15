import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { memo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, Share, type StyleProp, Text, View, type ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ImgKey } from '../data/images';
import { profileById, venueById } from '../data/mock';
import type { Post, ProfileKind } from '../data/types';
import { compact, plural, shortDate, time } from '../lib/format';
import { canBefriend, useFriendStatus } from '../store/social';
import { toast } from '../store/toast';
import { overlayVenue, useApp, useEvent, type VenueListing } from '../store/useApp';
import { colors, fonts } from '../theme';
import { ActionSheet, ReasonSheet, type SheetAction } from './ActionSheet';
import { Avatar, Button, Icon, IconButton, Photo, Row, T } from './ui';

const postLink = (id: string) => `https://domtak.de/p/${id}`;

/** Reasons offered when reporting a post, comment, profile or conversation (F09, F25). */
export const REPORT_REASONS = ['Spam or scam', 'Harassment or bullying', 'Hate speech or symbols', 'Nudity or sexual content', 'Violence or dangerous acts', 'Misleading information', 'Something else'];

/** Copies the link to the clipboard on every platform; only if that fails, opens the share sheet (which has a copy option). */
async function copyLink(url: string) {
  try {
    // On web this resolves false when the browser refuses clipboard access.
    if (await Clipboard.setStringAsync(url)) {
      toast('Link copied');
      return;
    }
  } catch {
    // fall through to the share sheet
  }
  Share.share({ message: url }).catch(() => toast('Could not open the share sheet'));
}

export interface PostAuthor {
  id: string;
  name: string;
  avatar?: ImgKey;
  title: string;
  verified: boolean;
  kind: ProfileKind | 'venue';
}

/**
 * The author of a post or comment: you, a venue (venues post too, e.g. Moon Venue) or a profile.
 * Every venue also has a stand-in account in `profiles`, so venues are resolved first (kind 'venue', links to /venue/<id>).
 * Pass the owner's `listing` to show their edits on their own venue.
 */
export function authorFor(id: string, me: { name: string; avatar?: ImgKey; role: string }, listing?: VenueListing): PostAuthor | undefined {
  if (id === 'me') return { id: 'me', name: me.name, avatar: me.avatar, title: 'You', verified: false, kind: 'fan' };
  const seedVenue = venueById(id);
  if (seedVenue) {
    const v = listing ? overlayVenue(seedVenue, listing) : seedVenue;
    return { id: v.id, name: v.name, avatar: v.cover, title: `Venue · ${v.area}`, verified: !!profileById(id)?.verified, kind: 'venue' };
  }
  const p = profileById(id);
  if (p) return { id: p.id, name: p.name, avatar: p.avatar, title: p.title, verified: !!p.verified, kind: p.kind };
  return undefined;
}

/** `onComment` replaces the default "open the post" behaviour, e.g. on the post screen itself where it focuses the comment box. */
export const PostCard = memo(function PostCard({ post, onComment }: { post: Post; onComment?: () => void }) {
  const { width } = useWindowDimensions();
  const user = useApp((s) => s.user);
  const venueListing = useApp((s) => s.venueListing);
  const liked = useApp((s) => !!s.likes[post.id]);
  const saved = useApp((s) => !!s.saves[post.id]);
  const extra = useApp((s) => s.extraComments[post.id]);
  const removedContent = useApp((s) => s.removedContent);
  const blocked = useApp((s) => s.blocked);
  const toggleLike = useApp((s) => s.toggleLike);
  const toggleSave = useApp((s) => s.toggleSave);
  const followingAuthor = useApp((s) => !!s.following[post.authorId]);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const reportContent = useApp((s) => s.reportContent);
  // A boolean selector stays stable: true while your report on this post is open.
  const reported = useApp((s) => s.reports.some((r) => r.byMe && r.targetId === post.id && r.status === 'open'));
  const [reporting, setReporting] = useState(false);
  const event = useEvent(post.eventId);
  const [slide, setSlide] = useState(0);
  const [burst, setBurst] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastTap = useRef(0);

  const author = authorFor(post.authorId, user, venueListing);
  if (!author) return null;
  const mediaH = Math.round(width * 1.12);
  // Same comments the post screen shows: removed ones and blocked authors are left out.
  const commentCount = [...post.comments, ...(extra ?? [])].filter((c) => !removedContent.includes(c.id) && !blocked.includes(c.authorId)).length;
  const bookable = author.kind === 'dj' || author.kind === 'musician' || author.kind === 'band';
  const authorHref = author.id === 'me' ? '/profile/me' : bookable ? `/artist/${author.id}` : author.kind === 'venue' ? `/venue/${author.id}` : `/profile/${author.id}`;

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike(post.id);
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    lastTap.current = now;
  };

  const openComments = (reply = false) => {
    if (onComment) onComment();
    else router.push({ pathname: '/post/[id]', params: reply ? { id: post.id, reply: '1' } : { id: post.id } });
  };

  const share = () => {
    Share.share({ message: `${author.name} on Domtak: ${post.caption}\n${postLink(post.id)}` }).catch(() => toast('Could not open the share sheet'));
  };

  const mine = author.id === 'me';
  const actions: SheetAction[] = [
    { label: saved ? 'Remove from saved' : 'Save post', icon: saved ? 'bookmark-remove-outline' : 'bookmark-outline', onPress: () => { toggleSave(post.id); toast(saved ? 'Removed from saved' : 'Saved to your collection'); } },
    { label: 'Share', icon: 'share-variant-outline', onPress: share },
    { label: 'Copy link', icon: 'link-variant', onPress: () => { void copyLink(postLink(post.id)); } },
    ...(event ? [{ label: `View ${event.title}`, icon: 'party-popper' as const, onPress: () => router.push(`/event/${event.id}`) }] : []),
    ...(!mine && followingAuthor ? [{ label: `Unfollow ${author.name}`, icon: 'account-minus-outline' as const, onPress: () => { toggleFollow(author.id); toast(`You unfollowed ${author.name}`); } }] : []),
    ...(!mine ? [{ label: 'Hide post', icon: 'eye-off-outline' as const, onPress: () => setHidden(true) }] : []),
    ...(!mine
      ? [
          reported
            ? { label: 'Reported', sub: 'Our team is reviewing this post', icon: 'flag-outline' as const, disabled: true, onPress: () => {} }
            : { label: 'Report post', icon: 'flag-outline' as const, destructive: true, onPress: () => setReporting(true) },
        ]
      : []),
  ];

  if (hidden) {
    return (
      <Row gap={12} style={{ backgroundColor: colors.surface, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
        <Icon name="eye-off-outline" size={22} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold">Post hidden</T>
          <T v="small">This post from {author.name} is hidden from your feed.</T>
        </View>
        <Button title="Undo" variant="light" size="sm" accessibilityLabel="Undo hide post" onPress={() => setHidden(false)} />
      </Row>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface, marginBottom: 10 }}>
      <Row gap={10} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={author.kind === 'venue' ? `Open ${author.name} venue page` : `Open ${author.name}’s profile`} onPress={() => router.push(authorHref as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Avatar src={author.avatar} size={40} label={author.name} ring />
          <View style={{ flex: 1 }}>
            <Row gap={4}>
              <T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{author.name}</T>
              {author.verified ? <Icon name="check-decagram" size={15} color="#8B5CF6" /> : null}
              <T v="small" numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>· {author.title}</T>
            </Row>
            {post.location ? <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>{post.location}</T> : null}
          </View>
        </Pressable>
        <IconButton name="dots-horizontal" label="More options" size={40} onPress={() => setMenu(true)} />
      </Row>
      <ActionSheet visible={menu} title={mine ? 'Your post' : `Post by ${author.name}`} actions={actions} onClose={() => setMenu(false)} />
      <ReasonSheet
        visible={reporting}
        title="Report post"
        body={`Tell us what is wrong with this post by ${author.name}. Reports are private: ${author.name} is not told who reported it.`}
        reasons={REPORT_REASONS}
        confirmLabel="Send report"
        destructive
        notePlaceholder="Add details (optional)"
        onSubmit={(reason, note) => {
          reportContent('post', post.id, reason, note || undefined);
          toast('Thanks. Our team will review this post.');
        }}
        onClose={() => setReporting(false)}
      />

      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${post.media.length > 1 ? `${post.media.length} photos` : post.kind === 'video' ? 'Video' : 'Photo'} by ${author.name}${liked ? ', liked' : ''}`}
        accessibilityHint={liked ? undefined : 'Double tap to like'}
        // Screen readers turn a double tap into one activation, so activating the photo likes the post (like a quick double tap does).
        accessibilityActions={[{ name: 'activate', label: 'Like' }]}
        onAccessibilityAction={() => { if (!liked) toggleLike(post.id); }}
        onPress={onMediaPress}
      >
        {post.media.length > 1 ? (
          <FlatList
            data={post.media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m, i) => `${m}-${i}`}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Photo src={item} style={{ width, height: mediaH }} />}
          />
        ) : (
          <Photo src={post.media[0]} style={{ width, height: mediaH }} />
        )}
        {post.kind === 'video' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play-circle" size={56} color={colors.white} />
            </View>
          </View>
        ) : null}
        {post.media.length > 1 ? (
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 }}>{slide + 1}/{post.media.length}</Text>
          </View>
        ) : null}
        {post.track ? (
          <Row gap={6} style={{ position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, height: 30, borderRadius: 15, maxWidth: width - 24 }}>
            <Icon name="music-note" size={15} color={colors.white} />
            <Text style={{ color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 12 }} numberOfLines={1}>{post.track}</Text>
          </Row>
        ) : null}
        {burst ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="heart" size={110} color="rgba(255,255,255,0.92)" />
          </View>
        ) : null}
      </Pressable>

      {post.media.length > 1 ? (
        <Row gap={5} justify="center" style={{ paddingTop: 8 }}>
          {post.media.map((m, i) => (
            <View key={`${m}-${i}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? colors.brand : colors.track }} />
          ))}
        </Row>
      ) : null}

      {event ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Event: ${event.title}`} onPress={() => router.push(`/event/${event.id}`)} style={{ marginHorizontal: 12, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: colors.brandTint, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="party-popper" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="smallBold" numberOfLines={1}>{event.title}</T>
            <T v="small" style={{ fontSize: 12 }}>{shortDate(event.start)} · {time(event.start)}</T>
          </View>
          <Button title="Tickets" accessibilityLabel={`Tickets for ${event.title}`} size="sm" onPress={() => router.push(`/tickets/${event.id}`)} />
        </Pressable>
      ) : bookable || author.kind === 'venue' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Book ${author.name} for your event`} onPress={() => router.push({ pathname: '/booking/new', params: { type: bookable ? 'musician' : 'venue', id: author.id } })} style={{ marginHorizontal: 12, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: colors.brandTint, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="calendar-plus" size={22} color={colors.brand} />
          <T v="smallBold" style={{ flex: 1 }}>Book {author.name} for your event</T>
          <Icon name="chevron-right" size={20} color={colors.brand} />
        </Pressable>
      ) : null}

      <Row style={{ paddingHorizontal: 4, paddingTop: 4 }} gap={0}>
        <IconButton name={liked ? 'heart' : 'heart-outline'} label={liked ? 'Unlike' : 'Like'} color={liked ? colors.danger : colors.ink} iconSize={27} onPress={() => toggleLike(post.id)} />
        <IconButton name="comment-outline" label="Comments" iconSize={25} onPress={() => openComments()} />
        <IconButton name="send-outline" label="Share" iconSize={25} onPress={share} />
        <View style={{ flex: 1 }} />
        <IconButton name={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Remove from saved' : 'Save'} color={saved ? colors.brand : colors.ink} iconSize={26} onPress={() => toggleSave(post.id)} />
      </Row>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 4 }}>
        <T v="bodyBold">{compact(post.likes + (liked ? 1 : 0))} likes</T>
        {post.caption ? (
          <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Show less of caption' : 'Show full caption'} onPress={() => setExpanded(!expanded)}>
            <T v="body" numberOfLines={expanded ? undefined : 3}>
              <T v="bodyBold">{author.name} </T>
              {post.caption}
            </T>
          </Pressable>
        ) : null}
        {commentCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => openComments()} hitSlop={{ top: 8, bottom: 8 }} style={{ minHeight: 28, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <T v="small">{commentCount === 1 ? 'View 1 comment' : `View all ${commentCount} comments`}</T>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Add a comment" onPress={() => openComments(true)} hitSlop={{ top: 4, bottom: 4 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 36 }}>
          <Avatar src={user.avatar} size={26} label={user.name} />
          <T v="small" color={colors.subtle}>Add a comment…</T>
        </Pressable>
        <T v="small" style={{ fontSize: 11 }} color={colors.subtle}>{post.time === 'now' ? 'Just now' : `${post.time} ago`}</T>
      </View>
    </View>
  );
});

// ---------- Photos in comments (user note 2: members share photos only inside comments) ----------

/** Most photos one comment can carry. */
export const MAX_COMMENT_PHOTOS = 3;

/** The small photo library offered when adding photos to a comment. */
export const COMMENT_PHOTO_LIBRARY: ImgKey[] = ['feed_friends', 'feed_crowd', 'ev_dancing', 'feed_rooftop', 'ev_selfie', 'feed_picnic', 'ev_hands', 'feed_street', 'feed_club', 'ev_lasers2', 'feed_decks', 'ev_red_crowd'];

/**
 * Adds or removes `k` from the photos picked for a comment. Returns the new list, or undefined
 * (after telling the user) when the limit is reached.
 */
export function togglePhotoPick(picked: ImgKey[], k: ImgKey, max = MAX_COMMENT_PHOTOS): ImgKey[] | undefined {
  if (picked.includes(k)) return picked.filter((x) => x !== k);
  if (picked.length >= max) {
    toast(`You can add up to ${max} photos to a comment`);
    return undefined;
  }
  return [...picked, k];
}

/** Bottom sheet with the photo library. Taps toggle photos in the parent's selection (numbered in order). */
export function PhotoPickerSheet({ visible, selected, onToggle, onClose, max = MAX_COMMENT_PHOTOS }: { visible: boolean; selected: ImgKey[]; onToggle: (k: ImgKey) => void; onClose: () => void; max?: number }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cell = Math.floor((Math.min(width, 520) - 40 - 16) / 3);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo library" style={{ flex: 1 }} onPress={onClose} />
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 12 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          <Row justify="space-between" gap={12}>
            <View style={{ flex: 1 }}>
              <T v="h3" accessibilityRole="header">Add photos</T>
              <T v="small">Up to {max} photos in one comment</T>
            </View>
            <T v="smallBold" color={colors.brand} accessibilityLabel={`${selected.length} of ${max} selected`}>{selected.length}/{max}</T>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COMMENT_PHOTO_LIBRARY.map((k, idx) => {
              const i = selected.indexOf(k);
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={`Library photo ${idx + 1}${i >= 0 ? `, selected ${i + 1}` : ''}`}
                  accessibilityState={{ selected: i >= 0 }}
                  onPress={() => onToggle(k)}
                  style={{ width: cell, height: cell }}
                >
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
          <Button title={selected.length ? `Done · ${plural(selected.length, 'photo')}` : 'Done'} size="md" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Previews of the photos attached to a comment you are writing, each with a remove button. */
export function ComposerPhotos({ photos, onRemove, max = MAX_COMMENT_PHOTOS }: { photos: ImgKey[]; onRemove: (k: ImgKey) => void; max?: number }) {
  if (!photos.length) return null;
  return (
    <Row gap={10} style={{ marginBottom: 10, paddingTop: 6 }}>
      {photos.map((p, i) => (
        <View key={p} style={{ width: 64, height: 64 }}>
          <Photo src={p} style={{ width: 64, height: 64 }} radius={10} accessibilityLabel={`Attached photo ${i + 1}`} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${i + 1}`}
            onPress={() => onRemove(p)}
            hitSlop={10}
            style={{ position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={14} color={colors.white} />
          </Pressable>
        </View>
      ))}
      <T v="small" style={{ flex: 1 }}>{photos.length}/{max} photos</T>
    </Row>
  );
}

/** Full-screen photo viewer. Open it with the index of the photo to show first; swipe between photos. */
export function PhotoViewer({ photos, index, onClose }: { photos: ImgKey[]; index?: number; onClose: () => void }) {
  return (
    <Modal visible={index != null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Mounted only while open, so it always starts on the tapped photo. */}
      {index != null ? <PhotoViewerBody photos={photos} start={index} onClose={onClose} /> : null}
    </Modal>
  );
}

function PhotoViewerBody({ photos, start, onClose }: { photos: ImgKey[]; start: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(start);
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(m, i) => `${m}-${i}`}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => <Photo src={item} contentFit="contain" style={{ width, height, backgroundColor: colors.black }} accessibilityLabel={`Photo ${i + 1} of ${photos.length}`} />}
      />
      <Row justify="space-between" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 8 }}>
        {photos.length > 1 ? (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 }}>{page + 1} / {photos.length}</Text>
          </View>
        ) : <View />}
        <IconButton name="close" label="Close photo" color={colors.white} bg="rgba(0,0,0,0.45)" size={44} onPress={onClose} />
      </Row>
    </View>
  );
}

/** Thumbnails of the photos in a comment; tapping one opens the full-screen viewer. */
export function CommentPhotos({ photos, author, size = 76 }: { photos?: ImgKey[]; author?: string; size?: number }) {
  const [open, setOpen] = useState<number>();
  if (!photos?.length) return null;
  return (
    <>
      <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
        {photos.map((p, i) => (
          <Pressable
            key={`${p}-${i}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${photos.length}${author ? ` from ${author}` : ''}. Open full screen`}
            onPress={() => setOpen(i)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Photo src={p} style={{ width: size, height: size }} radius={10} />
          </Pressable>
        ))}
      </Row>
      <PhotoViewer photos={photos} index={open} onClose={() => setOpen(undefined)} />
    </>
  );
}

// ---------- Friends (F10) ----------

/**
 * Add friend / Requested / Accept / Friends for a person. Hidden for you, venues and blocked accounts
 * (a blocked account cannot be sent a request).
 */
export function FriendButton({ id, size = 'sm', style }: { id: string; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const { status, request } = useFriendStatus(id);
  const sendFriendRequest = useApp((s) => s.sendFriendRequest);
  const respondFriendRequest = useApp((s) => s.respondFriendRequest);
  const cancelFriendRequest = useApp((s) => s.cancelFriendRequest);
  const removeFriend = useApp((s) => s.removeFriend);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [menu, setMenu] = useState(false);
  const p = profileById(id);
  if (!p || !canBefriend(id) || status === 'self' || status === 'blocked') return null;
  const name = p.name;

  const add = () => {
    if (sendFriendRequest(id)) toast(`Friend request sent to ${name}`);
    else toast(`A request with ${name} is already open`);
  };
  const accept = () => {
    if (!request) return;
    respondFriendRequest(request.id, true);
    toast(`You and ${name} are now friends`);
  };

  const common = { size, style };
  const sheetActions: SheetAction[] =
    status === 'friends'
      ? [
          { label: `Message ${name}`, icon: 'message-text-outline', onPress: () => router.push(`/chat/${ensureConversation(id)}`) },
          { label: 'Remove friend', icon: 'account-minus-outline', destructive: true, onPress: () => { removeFriend(id); toast(`${name} is no longer your friend`); } },
        ]
      : status === 'requested' && request
        ? [{ label: 'Cancel friend request', icon: 'close-circle-outline', destructive: true, onPress: () => { cancelFriendRequest(request.id); toast('Friend request cancelled'); } }]
        : [];

  return (
    <>
      {status === 'none' ? (
        <Button {...common} title="Add friend" icon="account-multiple-plus-outline" variant="light" accessibilityLabel={`Add ${name} as a friend`} onPress={add} />
      ) : status === 'incoming' ? (
        <Button {...common} title="Accept" icon="account-check-outline" accessibilityLabel={`Accept ${name}’s friend request`} onPress={accept} />
      ) : status === 'requested' ? (
        <Button {...common} title="Requested" icon="clock-outline" variant="secondary" accessibilityLabel={`Friend request sent to ${name}. Options`} onPress={() => setMenu(true)} />
      ) : (
        <Button {...common} title="Friends" icon="account-heart-outline" variant="secondary" accessibilityLabel={`You and ${name} are friends. Options`} onPress={() => setMenu(true)} />
      )}
      <ActionSheet visible={menu} title={status === 'friends' ? `You and ${name} are friends` : `Request sent to ${name}`} actions={sheetActions} onClose={() => setMenu(false)} />
    </>
  );
}
