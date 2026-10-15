import { useMemo } from 'react';

import { communities, profileById, profiles, venueById } from '../data/mock';
import type { Community, FriendRequest, Profile } from '../data/types';
import { useApp } from './useApp';

/**
 * Friends and communities (F09, F10). Select raw store slices and derive here with useMemo,
 * so screens never build arrays inside a zustand selector.
 */

export type FriendStatus = 'self' | 'blocked' | 'friends' | 'requested' | 'incoming' | 'none';

interface FriendSlices {
  friends: string[];
  friendRequests: FriendRequest[];
  blocked: string[];
}

/** Where you stand with `id`: friends, a request either way, blocked, or nothing yet. */
export function friendStatusOf(id: string, s: FriendSlices): { status: FriendStatus; request?: FriendRequest } {
  if (id === 'me') return { status: 'self' };
  if (s.blocked.includes(id)) return { status: 'blocked' };
  if (s.friends.includes(id)) return { status: 'friends' };
  const incoming = s.friendRequests.find((r) => r.status === 'pending' && r.fromId === id && r.toId === 'me');
  if (incoming) return { status: 'incoming', request: incoming };
  const sent = s.friendRequests.find((r) => r.status === 'pending' && r.fromId === 'me' && r.toId === id);
  if (sent) return { status: 'requested', request: sent };
  return { status: 'none' };
}

export function useFriendStatus(id: string) {
  const friends = useApp((s) => s.friends);
  const friendRequests = useApp((s) => s.friendRequests);
  const blocked = useApp((s) => s.blocked);
  return useMemo(() => friendStatusOf(id, { friends, friendRequests, blocked }), [id, friends, friendRequests, blocked]);
}

/** People can be friends; venues (which also have a stand-in profile) cannot. */
export function canBefriend(id: string) {
  return id !== 'me' && !!profileById(id) && !venueById(id);
}

const newestFirst = (a: FriendRequest, b: FriendRequest) => (b.at ?? '').localeCompare(a.at ?? '');

/** Pending requests sent to you (newest first) and the ones you sent, without blocked accounts or unknown profiles. */
export function useFriendRequests() {
  const friendRequests = useApp((s) => s.friendRequests);
  const blocked = useApp((s) => s.blocked);
  return useMemo(() => {
    const open = friendRequests.filter((r) => r.status === 'pending');
    const incoming = open.filter((r) => r.toId === 'me' && r.fromId !== 'me' && !blocked.includes(r.fromId) && !!profileById(r.fromId)).sort(newestFirst);
    const sent = open.filter((r) => r.fromId === 'me' && !blocked.includes(r.toId) && !!profileById(r.toId)).sort(newestFirst);
    return { incoming, sent };
  }, [friendRequests, blocked]);
}

/** Your friends as profiles (blocked accounts are never friends; unknown ids are skipped). */
export function useFriendProfiles(): Profile[] {
  const friends = useApp((s) => s.friends);
  const blocked = useApp((s) => s.blocked);
  return useMemo(() => friends.filter((id) => !blocked.includes(id)).map((id) => profileById(id)).filter((p): p is Profile => !!p), [friends, blocked]);
}

/** Member count shown for a community, including you once you join. */
export function memberCount(c: Community, joined: boolean) {
  return c.members + (joined ? 1 : 0);
}

/** Communities with your joined ones first (in the order you joined), then the rest in platform order. */
export function useCommunities() {
  const joined = useApp((s) => s.joinedCommunities);
  return useMemo(() => {
    const mine = joined.map((id) => communities.find((c) => c.id === id)).filter((c): c is Community => !!c);
    const others = communities.filter((c) => !joined.includes(c.id));
    return { joined: mine, others, joinedIds: joined };
  }, [joined]);
}

/**
 * A preview of people in a community: sample accounts whose music matches the community
 * (venues excluded), your friends first, then by followers. Blocked accounts are left out.
 */
export function communityMembers(c: Community, opts: { friends: string[]; blocked: string[] }): Profile[] {
  const genres = c.genres.map((g) => g.toLowerCase());
  return profiles
    .filter((p) => !venueById(p.id) && !opts.blocked.includes(p.id) && p.genres.some((g) => genres.includes(g.toLowerCase())))
    .sort((a, b) => Number(opts.friends.includes(b.id)) - Number(opts.friends.includes(a.id)) || b.followers - a.followers);
}

/** Communities a profile shares music with (used on profiles to suggest where to meet). */
export function communitiesFor(genres: string[]) {
  const lower = genres.map((g) => g.toLowerCase());
  return communities.filter((c) => c.genres.some((g) => lower.includes(g.toLowerCase())));
}
