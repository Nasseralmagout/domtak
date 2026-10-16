import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ReasonSheet } from '../../components/ActionSheet';
import { AdminGate } from '../../components/admin';
import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, EmptyState, Icon, type IconName, Photo, Pill, Row, Segmented, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { eventDiscussion, posts as seedPosts, profileById, venueById } from '../../data/mock';
import type { Comment, Conversation, EventItem, Post, Report, ReportStatus } from '../../data/types';
import { REPORT_KIND_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from '../../lib/admin';
import { ago, dateTime } from '../../lib/format';
import { toast } from '../../store/toast';
import { useAllEvents, useApp } from '../../store/useApp';
import { colors, radius } from '../../theme';

type Tab = 'open' | 'decided';
type Decision = Exclude<ReportStatus, 'open'>;

const DECISIONS: { status: Decision; label: string; icon: IconName; variant: 'secondary' | 'light' | 'danger'; title: string; body: string; reasons: string[]; confirm: string }[] = [
  {
    status: 'dismissed',
    label: 'Dismiss',
    icon: 'check',
    variant: 'secondary',
    title: 'Dismiss the report',
    body: 'The content stays as it is. The decision and reason are recorded.',
    reasons: ['No breach of the community rules', 'Not enough context to act', 'Duplicate of an earlier report'],
    confirm: 'Dismiss report',
  },
  {
    status: 'restricted',
    label: 'Restrict',
    icon: 'eye-off-outline',
    variant: 'light',
    title: 'Restrict the content',
    body: 'Limits the content or account while it stays on record. The account is told why and how to appeal.',
    reasons: ['Borderline content, limited while it is reviewed', 'Misleading information that needs correcting', 'First warning for this account'],
    confirm: 'Restrict',
  },
  {
    status: 'removed',
    label: 'Remove',
    icon: 'delete-outline',
    variant: 'danger',
    title: 'Remove the content',
    body: 'Removes it from feeds, discussions and search for everyone. The account is told why and how to appeal.',
    reasons: ['Harassment or bullying', 'Hate or violence', 'Spam or scam', 'Misleading information', 'Other breach of the community rules'],
    confirm: 'Remove content',
  },
];

interface Content {
  label: string;
  text?: string;
  author?: string;
  image?: ImgKey;
  href?: string;
  /** Private conversations: shown only on request. */
  privateText?: string;
}

const profileHref = (id: string) => {
  if (venueById(id)) return `/venue/${id}`;
  const p = profileById(id);
  return p && (p.kind === 'dj' || p.kind === 'musician' || p.kind === 'band') ? `/artist/${id}` : `/profile/${id}`;
};
const nameOf = (id: string) => (id === 'me' ? 'This account' : (profileById(id)?.name ?? venueById(id)?.name ?? 'Unknown account'));

/** The reported content with enough context to judge it (never the reporter). */
function contentOf(r: Report, ctx: { posts: Post[]; extra: Record<string, Comment[]>; events: EventItem[]; conversations: Conversation[] }): Content {
  if (r.kind === 'post') {
    const p = ctx.posts.find((x) => x.id === r.targetId);
    return p ? { label: 'Post', text: p.caption, author: nameOf(p.authorId), image: p.media[0], href: `/post/${p.id}` } : { label: 'Post no longer available' };
  }
  if (r.kind === 'comment') {
    for (const p of ctx.posts) {
      const c = [...p.comments, ...(ctx.extra[p.id] ?? [])].find((x) => x.id === r.targetId);
      if (c) return { label: 'Comment on a post', text: c.text, author: nameOf(c.authorId), image: c.photos?.[0], href: `/post/${p.id}` };
    }
    for (const [eventId, list] of Object.entries(eventDiscussion)) {
      const c = [...list, ...(ctx.extra[`event:${eventId}`] ?? [])].find((x) => x.id === r.targetId);
      const title = ctx.events.find((e) => e.id === eventId)?.title;
      if (c) return { label: `Comment in the ${title ?? 'event'} discussion`, text: c.text, author: nameOf(c.authorId), href: `/event-comments/${eventId}` };
    }
    return { label: 'Comment no longer available' };
  }
  if (r.kind === 'event') {
    const e = ctx.events.find((x) => x.id === r.targetId);
    return e ? { label: 'Event', text: `${e.title}. ${e.description}`, author: nameOf(e.organizerId), image: e.cover, href: `/event/${e.id}` } : { label: 'Event no longer available' };
  }
  if (r.kind === 'profile') {
    const p = profileById(r.targetId);
    const v = venueById(r.targetId);
    if (p) return { label: 'Profile', text: p.bio ?? p.title, author: p.name, image: p.avatar, href: profileHref(p.id) };
    if (v) return { label: 'Venue profile', text: v.description, author: v.name, image: v.cover, href: `/venue/${v.id}` };
    return { label: 'Profile no longer available' };
  }
  const conv = ctx.conversations.find((c) => c.id === r.targetId);
  const last = conv ? [...conv.messages].reverse().find((m) => m.from === 'them' && m.text) : undefined;
  return { label: 'Private conversation', author: conv ? nameOf(conv.withId) : undefined, privateText: last?.text };
}

export default function AdminReports() {
  const adminMode = useApp((s) => s.adminMode);
  const reports = useApp((s) => s.reports);
  const myPosts = useApp((s) => s.myPosts);
  const extra = useApp((s) => s.extraComments);
  const conversations = useApp((s) => s.conversations);
  const moderateReport = useApp((s) => s.moderateReport);
  const events = useAllEvents();
  const [tab, setTab] = useState<Tab>('open');
  const [deciding, setDeciding] = useState<{ id: string; status: Decision }>();
  const [revealed, setRevealed] = useState<string[]>([]);

  const posts = useMemo(() => (myPosts.length ? [...myPosts, ...seedPosts] : seedPosts), [myPosts]);
  const sorted = useMemo(() => [...reports].sort((a, b) => b.at.localeCompare(a.at)), [reports]);

  if (!adminMode) return <AdminGate title="Reports" />;

  const open = sorted.filter((r) => r.status === 'open');
  const decided = sorted.filter((r) => r.status !== 'open');
  const list = tab === 'open' ? open : decided;
  const sheet = deciding ? DECISIONS.find((d) => d.status === deciding.status) : undefined;

  return (
    <Screen header={<ScreenHeader title="Reports" subtitle="Moderation · admin demo" onBack={() => goBack('/admin')} />}>
      <Segmented
        options={[
          { key: 'open', label: `Open · ${open.length}` },
          { key: 'decided', label: `Decided · ${decided.length}` },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Banner icon="incognito">Reporter identities are never shown here or to the reported account. Judge the content against the community rules.</Banner>

      {list.length ? (
        list.map((r) => {
          const c = contentOf(r, { posts, extra, events, conversations });
          const shown = revealed.includes(r.id);
          return (
            <Card key={r.id} style={{ gap: 10 }}>
              <Row justify="space-between" gap={8}>
                <Pill label={REPORT_KIND_LABEL[r.kind]} tone="neutral" icon="flag-outline" />
                <Pill label={REPORT_STATUS_LABEL[r.status]} tone={REPORT_STATUS_TONE[r.status]} />
              </Row>
              <T v="title">{r.reason}</T>
              {r.details ? <T v="small" color={colors.inkSoft}>{`Reporter’s note: ${r.details}`}</T> : null}
              <T v="small" style={{ fontSize: 12 }}>Reported {ago(r.at)} · reporter identity hidden</T>

              <View style={{ padding: 12, gap: 8, borderRadius: radius.md, backgroundColor: colors.chipIdle }}>
                <T v="caption">{c.label.toUpperCase()}</T>
                <Row gap={10} align="flex-start">
                  {c.image ? <Photo src={c.image} style={{ width: 56, height: 56 }} radius={10} /> : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    {c.author ? <T v="bodyBold">{c.author}</T> : null}
                    {c.text ? <T v="body" numberOfLines={4}>{c.text}</T> : null}
                    {r.kind === 'message' ? (
                      shown ? (
                        <T v="body">{c.privateText ?? 'No message text in this conversation.'}</T>
                      ) : (
                        <T v="small">Private messages are opened only when the case needs it.</T>
                      )
                    ) : null}
                  </View>
                </Row>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {c.href ? <Button title="View in context" variant="light" size="sm" icon="open-in-new" onPress={() => router.push(c.href as never)} /> : null}
                  {r.kind === 'message' && !shown && c.privateText ? (
                    <Button title="Show the reported message" variant="light" size="sm" icon="eye-outline" onPress={() => setRevealed([...revealed, r.id])} />
                  ) : null}
                </Row>
              </View>

              {r.status === 'open' ? (
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {DECISIONS.map((d) => (
                    <Button key={d.status} title={d.label} icon={d.icon} size="sm" variant={d.variant} onPress={() => setDeciding({ id: r.id, status: d.status })} />
                  ))}
                </Row>
              ) : (
                <View style={{ gap: 4 }}>
                  <Row gap={6}>
                    <Icon name="gavel" size={16} color={colors.label} />
                    <T v="smallBold">{REPORT_STATUS_LABEL[r.status]}{r.decision ? ` · ${dateTime(r.decision.at)}` : ''}</T>
                  </Row>
                  {r.decision?.note ? <T v="small">{r.decision.note}</T> : null}
                  {r.status !== 'dismissed' ? <T v="small">The account was told the reason and can appeal through Help › Support case.</T> : null}
                </View>
              )}
            </Card>
          );
        })
      ) : (
        <EmptyState
          icon={tab === 'open' ? 'flag-checkered' : 'gavel'}
          title={tab === 'open' ? 'No open reports' : 'No decisions yet'}
          body={tab === 'open' ? 'Reported accounts, posts, comments, messages and events appear here.' : 'Dismissed, restricted and removed reports appear here with the reason.'}
        />
      )}

      <ReasonSheet
        visible={!!sheet}
        title={sheet?.title ?? ''}
        body={sheet?.body}
        reasons={sheet?.reasons ?? []}
        confirmLabel={sheet?.confirm ?? 'Confirm'}
        destructive={sheet?.status === 'removed'}
        notePlaceholder="Note for the record (optional)"
        onSubmit={(reason, note) => {
          if (!deciding) return;
          moderateReport(deciding.id, deciding.status, note ? `${reason}. ${note}` : reason);
          toast(deciding.status === 'dismissed' ? 'Report dismissed · decision recorded' : 'Decision recorded · the account is notified and can appeal');
        }}
        onClose={() => setDeciding(undefined)}
      />
    </Screen>
  );
}
