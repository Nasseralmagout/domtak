import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, type TextInput, View } from 'react-native';

import { ReasonSheet } from '../../components/ActionSheet';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { authorFor, CommentPhotos, ComposerPhotos, MAX_COMMENT_PHOTOS, PhotoPickerSheet, PostCard, REPORT_REASONS, togglePhotoPick } from '../../components/PostCard';
import { Avatar, Button, EmptyState, Field, Icon, IconButton, Row, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { profileById, venueById } from '../../data/mock';
import { compact } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useFeedPosts } from '../../store/useApp';
import { colors } from '../../theme';

/**
 * "@handle " for replies. Venues come first (every venue also has a stand-in profile) and are
 * addressed by their shown name; otherwise the profile handle, else the first name.
 */
function mentionFor(authorId: string, name: string) {
  if (venueById(authorId)) return `@${name.toLowerCase().replace(/[^a-z0-9._]/g, '')} `;
  const handle = profileById(authorId)?.handle ?? `@${name.split(' ')[0]}`;
  return `${handle.startsWith('@') ? handle : `@${handle}`} `;
}

function profileHref(id: string) {
  if (id === 'me') return '/profile/me';
  if (venueById(id)) return `/venue/${id}`;
  const p = profileById(id);
  return p && (p.kind === 'dj' || p.kind === 'musician' || p.kind === 'band') ? `/artist/${id}` : `/profile/${id}`;
}

export default function PostDetail() {
  const { id, reply } = useLocalSearchParams<{ id: string; reply?: string }>();
  const posts = useFeedPosts();
  const post = posts.find((p) => p.id === id);
  const user = useApp((s) => s.user);
  const venueListing = useApp((s) => s.venueListing);
  const extra = useApp((s) => (id ? s.extraComments[id] : undefined));
  const addComment = useApp((s) => s.addComment);
  // Comment hearts are saved in the store (shared with event discussions), so they persist across visits and restarts.
  const liked = useApp((s) => s.likedComments);
  const toggleCommentLike = useApp((s) => s.toggleCommentLike);
  const blocked = useApp((s) => s.blocked);
  const removed = useApp((s) => s.removedContent);
  const reports = useApp((s) => s.reports);
  const reportContent = useApp((s) => s.reportContent);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<ImgKey[]>([]);
  const [picker, setPicker] = useState(false);
  const [reportId, setReportId] = useState<string>();
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  // Comments you reported (still open) show "Reported"; removed comments and blocked authors are hidden.
  const reported = useMemo(() => new Set(reports.filter((r) => r.byMe && r.status === 'open').map((r) => r.targetId)), [reports]);
  const comments = useMemo(
    () => (post ? [...post.comments, ...(extra ?? [])].filter((c) => !removed.includes(c.id) && !blocked.includes(c.authorId)) : []),
    [post, extra, removed, blocked],
  );

  if (!post) {
    return (
      <Screen header={<ScreenHeader title="Post" onBack={() => goBack('/(tabs)')} />}>
        <EmptyState icon="image-off-outline" title="Post not available" body="It may have been removed by its author or by our moderation team." action="Back to feed" onAction={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }
  const canSend = !!text.trim() || photos.length > 0;
  const send = () => {
    if (!canSend) return;
    addComment(post.id, text.trim(), photos.length ? photos : undefined);
    setText('');
    setPhotos([]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  };
  const replyTo = (authorId: string) => {
    const a = authorFor(authorId, user, venueListing);
    if (a && authorId !== 'me') {
      const mention = mentionFor(authorId, a.name);
      // Replace a leading @mention from an earlier Reply instead of stacking them.
      setText((cur) => `${mention}${cur.replace(/^@\S+\s+/, '')}`);
    }
    input.current?.focus();
  };
  const togglePhoto = (k: ImgKey) => {
    const next = togglePhotoPick(photos, k);
    if (next) setPhotos(next);
  };
  const reportTarget = comments.find((c) => c.id === reportId);
  const reportName = reportTarget ? authorFor(reportTarget.authorId, user, venueListing)?.name : undefined;

  return (
    <Screen
      keyboard
      scroll={false}
      header={<ScreenHeader title="Post" onBack={() => goBack('/(tabs)')} />}
      footer={
        <BottomBar style={{ paddingTop: 8 }}>
          <ComposerPhotos photos={photos} onRemove={(k) => setPhotos(photos.filter((x) => x !== k))} />
          <Row gap={8}>
            <IconButton
              name="image-plus"
              label={photos.length ? `Add photo, ${photos.length} of ${MAX_COMMENT_PHOTOS} attached` : 'Add photo to your comment'}
              color={colors.brand}
              bg={photos.length ? colors.brandSoft : 'transparent'}
              size={44}
              onPress={() => setPicker(true)}
            />
            <Field
              inputRef={input}
              placeholder={photos.length ? 'Say something about your photos…' : 'Add a comment…'}
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              returnKeyType="send"
              autoFocus={reply === '1'}
              accessibilityLabel="Comment"
              style={{ flex: 1 }}
            />
            <IconButton name="send" label="Post comment" color={canSend ? colors.brand : colors.disabled} disabled={!canSend} onPress={send} />
          </Row>
          <PhotoPickerSheet visible={picker} selected={photos} onToggle={togglePhoto} onClose={() => setPicker(false)} />
        </BottomBar>
      }
    >
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled">
        <PostCard post={post} onComment={() => input.current?.focus()} />
        <View style={{ padding: 16, gap: 16 }}>
          <T v="h3">Comments{comments.length ? ` (${comments.length})` : ''}</T>
          {comments.length === 0 ? (
            <View style={{ gap: 10, alignItems: 'flex-start' }}>
              <T v="body" color={colors.muted}>No comments yet. Start the conversation, with words or up to {MAX_COMMENT_PHOTOS} photos.</T>
              <Row gap={8}>
                <Button title="Write a comment" variant="light" size="sm" icon="comment-outline" onPress={() => input.current?.focus()} />
                <Button title="Add photo" variant="light" size="sm" icon="image-plus" onPress={() => setPicker(true)} />
              </Row>
            </View>
          ) : null}
          {comments.map((c) => {
            const a = authorFor(c.authorId, user, venueListing);
            const on = !!liked[c.id];
            const likes = c.likes + (on ? 1 : 0);
            const mine = c.authorId === 'me';
            return (
              <Row key={c.id} gap={12} align="flex-start">
                <Pressable accessibilityRole="button" accessibilityLabel={a?.kind === 'venue' ? `Open ${a.name} venue page` : `Open ${a?.name ?? 'author'}’s profile`} onPress={() => router.push(profileHref(c.authorId) as never)} hitSlop={4}>
                  <Avatar src={a?.avatar} size={36} label={a?.name} />
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body"><T v="bodyBold">{a?.name}{c.text ? ' ' : ''}</T>{c.text}</T>
                  <CommentPhotos photos={c.photos} author={a?.name} />
                  <Row gap={14}>
                    <T v="small" style={{ fontSize: 12 }}>{c.time === 'now' ? 'Just now' : c.time}</T>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${a?.name ?? 'comment'}`} onPress={() => replyTo(c.authorId)} hitSlop={14}>
                      <T v="smallBold" style={{ fontSize: 12 }} color={colors.muted}>Reply</T>
                    </Pressable>
                    {!mine ? (
                      reported.has(c.id) ? (
                        <T v="small" style={{ fontSize: 12 }} color={colors.subtle}>Reported</T>
                      ) : (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Report comment by ${a?.name ?? 'author'}`} onPress={() => setReportId(c.id)} hitSlop={14}>
                          <T v="smallBold" style={{ fontSize: 12 }} color={colors.muted}>Report</T>
                        </Pressable>
                      )
                    ) : null}
                  </Row>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${on ? 'Unlike' : 'Like'} comment by ${a?.name ?? 'author'}, ${likes} like${likes === 1 ? '' : 's'}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => toggleCommentLike(c.id)}
                  style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name={on ? 'heart' : 'heart-outline'} size={18} color={on ? colors.danger : colors.muted} />
                  {likes > 0 ? <T v="small" style={{ fontSize: 11 }} color={on ? colors.danger : colors.muted}>{compact(likes)}</T> : null}
                </Pressable>
              </Row>
            );
          })}
        </View>
      </ScrollView>
      <ReasonSheet
        visible={!!reportId}
        title="Report comment"
        body={`Tell us what is wrong with this comment${reportName ? ` by ${reportName}` : ''}. They are not told who reported it.`}
        reasons={REPORT_REASONS}
        confirmLabel="Send report"
        destructive
        notePlaceholder="Add details (optional)"
        onSubmit={(reason, note) => {
          if (!reportId) return;
          reportContent('comment', reportId, reason, note || undefined);
          toast('Thanks. Our team will review this comment.');
        }}
        onClose={() => setReportId(undefined)}
      />
    </Screen>
  );
}
