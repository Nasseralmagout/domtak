import { useState } from 'react';

import { PersonRow } from '../components/cards';
import { Screen, ScreenHeader } from '../components/layout';
import { Button, Field, T } from '../components/ui';
import { profiles } from '../data/mock';
import { colors } from '../theme';

export default function Invite() {
  const [q, setQ] = useState('');
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const people = profiles.filter((p) => p.kind === 'fan' && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const count = Object.keys(invited).length;
  return (
    <Screen header={<ScreenHeader title="Invite guests" subtitle={count ? `${count} invited` : undefined} />}>
      <Field placeholder="Search here" value={q} onChangeText={setQ} icon="magnify" />
      {people.map((p) => (
        <PersonRow
          key={p.id}
          id={p.id}
          subtitle={`${p.followers} followers · ${p.genres.join(', ') || 'Music lover'}`}
          right={<Button title={invited[p.id] ? 'Invited' : 'Invite'} size="sm" variant={invited[p.id] ? 'secondary' : 'primary'} onPress={() => setInvited((s) => ({ ...s, [p.id]: !s[p.id] }))} />}
        />
      ))}
      {!people.length ? <T v="body" color={colors.muted}>No one matches “{q}”.</T> : null}
    </Screen>
  );
}
