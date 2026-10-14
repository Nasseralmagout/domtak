import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { PersonRow } from '../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Chip, EmptyState, Field, IconButton, Row, T } from '../components/ui';
import { profiles } from '../data/mock';
import { compact, eventWhen } from '../lib/format';
import { toast } from '../store/toast';
import { useApp, useEvent } from '../store/useApp';

export default function Invite() {
  const { event: eventId } = useLocalSearchParams<{ event?: string }>();
  const event = useEvent(eventId);
  const following = useApp((s) => s.following);
  const blocked = useApp((s) => s.blocked);
  const [q, setQ] = useState('');
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);

  const t = q.trim().toLowerCase();
  const people = profiles.filter(
    (p) =>
      p.kind === 'fan' &&
      !blocked.includes(p.id) &&
      (!onlyFollowing || following[p.id]) &&
      (!t || `${p.name} ${p.handle}`.toLowerCase().includes(t)),
  );
  const count = invited.length;
  const back = () => goBack(event ? `/event/${event.id}` : '/(tabs)');
  const toggle = (id: string) => setInvited((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const allShown = people.length > 0 && people.every((p) => invited.includes(p.id));

  const shareLink = () => {
    const what = event ? `${event.title} (${eventWhen(event.start, event.end)})` : 'Domtak';
    Share.share({ message: `You’re invited to ${what}. Join me on Domtak: https://domtak.de/e/${event?.id ?? 'invite'}` }).catch(() => toast('Could not open the share sheet'));
  };

  const done = () => {
    if (count) toast(`${count} invite${count === 1 ? '' : 's'} sent${event ? ` for ${event.title}` : ''}`);
    else toast('No invites sent');
    back();
  };

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title="Invite guests"
          subtitle={event ? event.title : count ? `${count} selected` : undefined}
          onBack={back}
          right={<IconButton name="share-variant-outline" label="Share invite link" onPress={shareLink} />}
        />
      }
      footer={
        <BottomBar>
          <Button title={count ? `Send ${count} invite${count === 1 ? '' : 's'}` : 'Done'} icon={count ? 'send' : undefined} onPress={done} />
        </BottomBar>
      }
    >
      <Field placeholder="Search by name or @handle" value={q} onChangeText={setQ} icon="magnify" accessibilityLabel="Search people" />
      <Row gap={8} justify="space-between">
        <Chip label="People you follow" icon="account-heart-outline" selected={onlyFollowing} onPress={() => setOnlyFollowing(!onlyFollowing)} />
        {people.length ? (
          <Button
            title={allShown ? 'Clear' : 'Select all'}
            variant="ghost"
            size="sm"
            onPress={() => setInvited((list) => (allShown ? list.filter((id) => !people.some((p) => p.id === id)) : Array.from(new Set([...list, ...people.map((p) => p.id)]))))}
          />
        ) : null}
      </Row>
      {count ? <T v="small">{count} of {profiles.filter((p) => p.kind === 'fan' && !blocked.includes(p.id)).length} people selected</T> : null}
      {people.map((p) => {
        const on = invited.includes(p.id);
        return (
          <PersonRow
            key={p.id}
            id={p.id}
            subtitle={`${compact(p.followers)} followers · ${p.genres.join(', ') || 'Music lover'}`}
            right={<Button title={on ? 'Invited' : 'Invite'} icon={on ? 'check' : undefined} accessibilityLabel={on ? `Remove invite for ${p.name}` : `Invite ${p.name}`} accessibilityState={{ selected: on }} size="sm" variant={on ? 'secondary' : 'primary'} onPress={() => toggle(p.id)} />}
          />
        );
      })}
      {!people.length ? (
        <EmptyState
          icon="account-search-outline"
          title="No one found"
          body={q ? `No one matches “${q}”.` : 'You don’t follow anyone here yet.'}
          action={onlyFollowing ? 'Show everyone' : 'Share invite link'}
          onAction={() => (onlyFollowing ? setOnlyFollowing(false) : shareLink())}
        />
      ) : null}
      {!eventId ? null : !event ? <Button title="Back to events" variant="ghost" onPress={() => router.replace('/(tabs)/events')} /> : null}
    </Screen>
  );
}
