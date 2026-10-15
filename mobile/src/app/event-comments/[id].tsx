import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { ReasonSheet } from '../../components/ActionSheet';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { authorFor, CommentPhotos, ComposerPhotos, MAX_COMMENT_PHOTOS, PhotoPickerSheet, REPORT_REASONS, togglePhotoPick } from '../../components/PostCard';
import { Avatar, Button, EmptyState, Icon, IconButton, Photo, Pill, Row, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { eventDiscussion, profileById, venueById } from '../../data/mock';
import type { Comment } from '../../data/types';
import { eventWhen } from '../../lib/format';
import { toast } from '../../store/toast';
import { overlayVenue, useApp, useEvent, type VenueListing } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

/**
 * "@handle" used when replying. Venues come first: every venue also has a stand-in profile,
 * but a venue is addressed by its (possibly renamed) venue name.
 */
function handleFor(authorId: string, name: string, listing: VenueListing) {
  if (authorId === 'me') return '';
  const venue = venueById(authorId);
  if (venue) return `@${overlayVenue(venue, listing).name.toLowerCase().replace(/[^a-z0-9._]/g, '')}`;
  const handle = profileById(authorId)?.handle ?? `@${name.split(' ')[0]}`;
  return handle.startsWith('@') ? handle : `@${handle}`;
}

/** Where tapping a comment author goes: your profile, a venue page, an artist page or a profile. */
function authorHref(authorId: string) {
  if (authorId === 'me') return '/profile/me';
  if (venueById(authorId)) return `/venue/${authorId}`;
  const p = profileById(authorId);
  if (!p) return undefined;
  return p.kind === 'fan' || p.kind === 'organizer' ? `/profile/${p.id}` : `/artist/${p.id}`;
}

export default function EventComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const user = useApp((s) => s.user);
  const extra = useApp((s) => (id ? s.extraComments[`event:${id}`] : undefined));
  const addComment = useApp((s) => s.addComment);
  const tickets = useApp((s) => s.tickets);
  const venueListing = useApp((s) => s.venueListing);
  // Hearts are saved with the rest of your activity, so they survive leaving the screen and restarts.
  const likedComments = useApp((s) => s.likedComments);
  const toggleCommentLike = useApp((s) => s.toggleCommentLike);
  const blocked = useApp((s) => s.blocked);
  const removed = useApp((s) => s.removedContent);
  const reports = useApp((s) => s.reports);
  const reportContent = useApp((s) => s.reportContent);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<ImgKey[]>([]);
  const [picker, setPicker] = useState(false);
  const [reportId, setReportId] = useState<string>();
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<ScrollView>(null);
  const justSent = useRef(false);

  // Removed comments and blocked authors are hidden; comments you reported (still open) show "Reported".
  const comments = useMemo<Comment[]>(
    () => (event ? [...(eventDiscussion[event.id] ?? []), ...(extra ?? [])].filter((c) => !removed.includes(c.id) && !blocked.includes(c.authorId)) : []),
    [event, extra, removed, blocked],
  );
  const reported = useMemo(() => new Set(reports.filter((r) => r.byMe && r.status === 'open').map((r) => r.targetId)), [reports]);

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Discussion" onBack={() => goBack('/(tabs)/events')} />}>
        <EmptyState
          icon="calendar-remove-outline"
          title="Event not found"
          body="This event may have been removed or the link is no longer valid."
          action="Browse events"
          onAction={() => router.replace('/(tabs)/events')}
        />
      </Screen>
    );
  }

  const count = comments.length;
  const myTicket = tickets.find((t) => t.eventId === event.id && t.status === 'valid');
  const canSend = !!text.trim() || photos.length > 0;

  const send = () => {
    if (!canSend) return;
    justSent.current = true;
    addComment(`event:${event.id}`, text.trim(), photos.length ? photos : undefined);
    setText('');
    setPhotos([]);
  };

  const togglePhoto = (k: ImgKey) => {
    const next = togglePhotoPick(photos, k);
    if (next) setPhotos(next);
  };

  const reply = (name: string, authorId: string) => {
    const handle = handleFor(authorId, name, venueListing);
    // Replace a leading @mention from an earlier Reply instead of stacking them.
    setText((cur) => (handle ? `${handle} ${cur.replace(/^@\S+\s+/, '')}` : cur));
    inputRef.current?.focus();
  };

  const openAuthor = (authorId: string) => {
    const href = authorHref(authorId);
    if (href) router.push(href as never);
  };

  return (
    <Screen
      keyboard
      scroll={false}
      header={<ScreenHeader title={event.title} subtitle={`${count} ${count === 1 ? 'comment' : 'comments'} · Discussion`} onBack={() => goBack(`/event/${event.id}`)} />}
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
            <View style={{ flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14 }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
                placeholder={photos.length ? 'Say something about your photos…' : 'Ask a question or say hi…'}
                placeholderTextColor={colors.subtle}
                accessibilityLabel="Write a comment about this event"
                style={{ fontFamily: fonts.body, fontSize: 16, color: colors.ink, minHeight: 46 }}
              />
            </View>
            <IconButton name="send" label="Post comment" color={canSend ? colors.brand : colors.disabled} disabled={!canSend} onPress={send} />
          </Row>
          <PhotoPickerSheet visible={picker} selected={photos} onToggle={togglePhoto} onClose={() => setPicker(false)} />
        </BottomBar>
      }
    >
      <ScrollView
        ref={listRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
        onContentSizeChange={() => {
          if (!justSent.current) return;
          justSent.current = false;
          listRef.current?.scrollToEnd({ animated: true });
        }}
      >
        <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, ...shadow(1) }}>
          <Photo src={event.cover} style={{ width: 64, height: 64 }} radius={12} accessibilityLabel={event.title} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title" numberOfLines={1}>{event.title}</T>
            <T v="small" numberOfLines={1}>{eventWhen(event.start, event.end)}</T>
          </View>
          <Button
            title={myTicket ? 'My ticket' : 'Tickets'}
            size="sm"
            variant="light"
            accessibilityLabel={myTicket ? `Open my ticket for ${event.title}` : `Get tickets for ${event.title}`}
            onPress={() => router.push(myTicket ? `/ticket/${myTicket.id}` : `/tickets/${event.id}`)}
          />
        </Row>

        {count === 0 ? (
          <EmptyState
            icon="comment-text-multiple-outline"
            title="No comments yet"
            body="Ask about set times, the dress code or who else is going, or share a photo. The organizer and other guests will see it."
            action="Write the first comment"
            onAction={() => inputRef.current?.focus()}
          />
        ) : (
          <View style={{ gap: 14 }}>
            {comments.map((c) => {
              const a = authorFor(c.authorId, user, venueListing);
              const name = a?.name ?? 'Guest';
              const isVenue = a?.kind === 'venue';
              const on = !!likedComments[c.id];
              const likes = c.likes + (on ? 1 : 0);
              const isOrganizer = c.authorId === event.organizerId;
              const isHost = isVenue && c.authorId === event.venueId;
              const canOpen = !!authorHref(c.authorId);
              return (
                <Row key={c.id} gap={10} align="flex-start">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={c.authorId === 'me' ? 'Open your profile' : isVenue ? `Open ${name} venue page` : `Open ${name}’s profile`}
                    disabled={!canOpen}
                    onPress={() => openAuthor(c.authorId)}
                    hitSlop={6}
                  >
                    <Avatar src={a?.avatar} size={40} label={name} verified={a?.verified} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ backgroundColor: c.authorId === 'me' ? colors.brandTint : colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, ...shadow(1) }}>
                      <Row gap={6} style={{ marginBottom: 2, flexWrap: 'wrap' }}>
                        <T v="smallBold">{c.authorId === 'me' ? 'You' : name}</T>
                        {isOrganizer ? <Pill label="Organizer" tone="brand" /> : isHost ? <Pill label="Venue" tone="brand" icon="map-marker-outline" /> : null}
                      </Row>
                      {c.text ? <T v="body">{c.text}</T> : null}
                      <CommentPhotos photos={c.photos} author={c.authorId === 'me' ? 'you' : name} size={84} />
                    </View>
                    <Row gap={16} style={{ paddingLeft: 4 }}>
                      <T v="small" style={{ fontSize: 12 }}>{c.time === 'now' ? 'Just now' : c.time}</T>
                      <T v="small" style={{ fontSize: 12 }}>{likes} {likes === 1 ? 'like' : 'likes'}</T>
                      {c.authorId !== 'me' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${name}`} onPress={() => reply(name, c.authorId)} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}>
                          <T v="smallBold" style={{ fontSize: 12 }} color={colors.brand}>Reply</T>
                        </Pressable>
                      ) : null}
                      {c.authorId !== 'me' ? (
                        reported.has(c.id) ? (
                          <T v="small" style={{ fontSize: 12 }} color={colors.subtle}>Reported</T>
                        ) : (
                          <Pressable accessibilityRole="button" accessibilityLabel={`Report comment by ${name}`} onPress={() => setReportId(c.id)} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}>
                            <T v="smallBold" style={{ fontSize: 12 }} color={colors.muted}>Report</T>
                          </Pressable>
                        )
                      ) : null}
                    </Row>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${on ? 'Unlike' : 'Like'} comment by ${c.authorId === 'me' ? 'you' : name}, ${likes} ${likes === 1 ? 'like' : 'likes'}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => toggleCommentLike(c.id)}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.dangerBg : 'transparent' }}>
                      <Icon name={on ? 'heart' : 'heart-outline'} size={18} color={on ? colors.danger : colors.muted} />
                    </View>
                  </Pressable>
                </Row>
              );
            })}
          </View>
        )}
      </ScrollView>
      <ReasonSheet
        visible={!!reportId}
        title="Report comment"
        body="Tell us what is wrong with this comment. The author is not told who reported it."
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
