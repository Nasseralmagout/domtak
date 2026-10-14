import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { memo, useRef, useState } from 'react';
import { FlatList, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';

import type { ImgKey } from '../data/images';
import { profileById, venueById } from '../data/mock';
import type { Post, ProfileKind } from '../data/types';
import { compact, shortDate, time } from '../lib/format';
import { toast } from '../store/toast';
import { useApp, useEvent } from '../store/useApp';
import { colors, fonts } from '../theme';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { Avatar, Button, Icon, IconButton, Photo, Row, T } from './ui';

const postLink = (id: string) => `https://domtak.de/p/${id}`;

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

/** The author of a post or comment: you, a profile, or a venue (venues post too, e.g. Moon Venue). */
export function authorFor(id: string, me: { name: string; avatar?: ImgKey; role: string }): PostAuthor | undefined {
  if (id === 'me') return { id: 'me', name: me.name, avatar: me.avatar, title: 'You', verified: false, kind: 'fan' };
  const p = profileById(id);
  if (p) return { id: p.id, name: p.name, avatar: p.avatar, title: p.title, verified: !!p.verified, kind: p.kind };
  const v = venueById(id);
  if (v) return { id: v.id, name: v.name, avatar: v.cover, title: `Venue · ${v.area}`, verified: false, kind: 'venue' };
  return undefined;
}

/** `onComment` replaces the default "open the post" behaviour, e.g. on the post screen itself where it focuses the comment box. */
export const PostCard = memo(function PostCard({ post, onComment }: { post: Post; onComment?: () => void }) {
  const { width } = useWindowDimensions();
  const user = useApp((s) => s.user);
  const liked = useApp((s) => !!s.likes[post.id]);
  const saved = useApp((s) => !!s.saves[post.id]);
  const extra = useApp((s) => s.extraComments[post.id]);
  const toggleLike = useApp((s) => s.toggleLike);
  const toggleSave = useApp((s) => s.toggleSave);
  const followingAuthor = useApp((s) => !!s.following[post.authorId]);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const event = useEvent(post.eventId);
  const [slide, setSlide] = useState(0);
  const [burst, setBurst] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastTap = useRef(0);

  const author = authorFor(post.authorId, user);
  if (!author) return null;
  const mediaH = Math.round(width * 1.12);
  const commentCount = post.comments.length + (extra?.length ?? 0);
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
    ...(!mine ? [{ label: 'Report post', icon: 'flag-outline' as const, destructive: true, onPress: () => toast('Thanks, our team will review this post') }] : []),
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
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${author.name}’s profile`} onPress={() => router.push(authorHref as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
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

      <Pressable accessibilityLabel={`Photo by ${author.name}`} accessibilityHint="Double tap quickly to like" onPress={onMediaPress}>
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
          <Pressable accessibilityRole="button" onPress={() => openComments()} hitSlop={8}>
            <T v="small">{commentCount === 1 ? 'View 1 comment' : `View all ${commentCount} comments`}</T>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Add a comment" onPress={() => openComments(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 36 }}>
          <Avatar src={user.avatar} size={26} label={user.name} />
          <T v="small" color={colors.subtle}>Add a comment…</T>
        </Pressable>
        <T v="small" style={{ fontSize: 11 }} color={colors.subtle}>{post.time === 'now' ? 'Just now' : `${post.time} ago`}</T>
      </View>
    </View>
  );
});
