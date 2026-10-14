import { router } from 'expo-router';
import { memo, useRef, useState } from 'react';
import { FlatList, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';

import { profileById, venueById } from '../data/mock';
import type { Post } from '../data/types';
import { compact, shortDate, time } from '../lib/format';
import { useApp, useEvent } from '../store/useApp';
import { colors, fonts } from '../theme';
import { Avatar, Button, Icon, IconButton, Photo, Row, T } from './ui';

export function authorFor(id: string, me: { name: string; avatar?: import('../data/images').ImgKey; role: string }) {
  if (id === 'me') return { id: 'me', name: me.name, avatar: me.avatar, title: 'You', verified: false, kind: 'fan' as const };
  const p = profileById(id);
  return p ? { id: p.id, name: p.name, avatar: p.avatar, title: p.title, verified: !!p.verified, kind: p.kind } : undefined;
}

export const PostCard = memo(function PostCard({ post }: { post: Post }) {
  const { width } = useWindowDimensions();
  const user = useApp((s) => s.user);
  const liked = useApp((s) => !!s.likes[post.id]);
  const saved = useApp((s) => !!s.saves[post.id]);
  const extra = useApp((s) => s.extraComments[post.id]);
  const toggleLike = useApp((s) => s.toggleLike);
  const toggleSave = useApp((s) => s.toggleSave);
  const event = useEvent(post.eventId);
  const [slide, setSlide] = useState(0);
  const [burst, setBurst] = useState(false);
  const lastTap = useRef(0);

  const author = authorFor(post.authorId, user);
  if (!author) return null;
  const mediaH = Math.round(width * 1.12);
  const commentCount = post.comments.length + (extra?.length ?? 0);
  const bookable = author.kind === 'dj' || author.kind === 'musician' || author.kind === 'band';
  const authorHref = author.id === 'me' ? '/profile/me' : bookable ? `/artist/${author.id}` : venueById(author.id) ? `/venue/${author.id}` : `/profile/${author.id}`;

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike(post.id);
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    lastTap.current = now;
  };

  const share = () => {
    Share.share({ message: `${author.name} on Domtak: ${post.caption}` }).catch(() => {});
  };

  return (
    <View style={{ backgroundColor: colors.surface, marginBottom: 10 }}>
      <Row gap={10} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${author.name}'s profile`} onPress={() => router.push(authorHref as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Avatar src={author.avatar} size={40} label={author.name} ring />
          <View style={{ flex: 1 }}>
            <Row gap={4}>
              <T v="bodyBold" numberOfLines={1}>{author.name}</T>
              {author.verified ? <Icon name="check-decagram" size={15} color="#8B5CF6" /> : null}
              <T v="small" style={{ fontSize: 12 }}>· {author.title}</T>
            </Row>
            {post.location ? <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>{post.location}</T> : null}
          </View>
        </Pressable>
        <IconButton name="dots-horizontal" label="More options" size={40} />
      </Row>

      <Pressable accessibilityLabel="Post media. Double tap to like." onPress={onMediaPress}>
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
        <Pressable accessibilityRole="button" onPress={() => router.push(`/event/${event.id}`)} style={{ marginHorizontal: 12, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: colors.brandTint, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="party-popper" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="smallBold" numberOfLines={1}>{event.title}</T>
            <T v="small" style={{ fontSize: 12 }}>{shortDate(event.start)} · {time(event.start)}</T>
          </View>
          <Button title="Tickets" size="sm" onPress={() => router.push(`/tickets/${event.id}`)} />
        </Pressable>
      ) : bookable ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/booking/new', params: { type: 'musician', id: author.id } })} style={{ marginHorizontal: 12, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: colors.brandTint, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="calendar-plus" size={22} color={colors.brand} />
          <T v="smallBold" style={{ flex: 1 }}>Book {author.name} for your event</T>
          <Icon name="chevron-right" size={20} color={colors.brand} />
        </Pressable>
      ) : null}

      <Row style={{ paddingHorizontal: 4, paddingTop: 4 }} gap={0}>
        <IconButton name={liked ? 'heart' : 'heart-outline'} label={liked ? 'Unlike' : 'Like'} color={liked ? colors.danger : colors.ink} iconSize={27} onPress={() => toggleLike(post.id)} />
        <IconButton name="comment-outline" label="Comments" iconSize={25} onPress={() => router.push(`/post/${post.id}`)} />
        <IconButton name="send-outline" label="Share" iconSize={25} onPress={share} />
        <View style={{ flex: 1 }} />
        <IconButton name={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Remove from saved' : 'Save'} color={saved ? colors.brand : colors.ink} iconSize={26} onPress={() => toggleSave(post.id)} />
      </Row>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 4 }}>
        <T v="bodyBold">{compact(post.likes + (liked ? 1 : 0))} likes</T>
        <T v="body" numberOfLines={3}>
          <T v="bodyBold">{author.name} </T>
          {post.caption}
        </T>
        {commentCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/post/${post.id}`)}>
            <T v="small">View all {commentCount} comments</T>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push(`/post/${post.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Avatar src={user.avatar} size={26} label={user.name} />
          <T v="small" color={colors.subtle}>Add a comment…</T>
        </Pressable>
        <T v="small" style={{ fontSize: 11 }} color={colors.subtle}>{post.time === 'now' ? 'Just now' : `${post.time} ago`}</T>
      </View>
    </View>
  );
});
