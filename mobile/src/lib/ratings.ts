import { profileById, type ReviewItem, reviewsFor } from '../data/mock';

/**
 * Musicians (artists, bands, DJs) are not rated with stars. Their score is the share of verified
 * bookings whose customer would book them again, plus counted praise tags. Venues keep stars (ratingFor).
 */
export const PRAISE_TAGS = ['On time', 'Great sound', 'Read the crowd', 'Professional', 'Good value', 'Easy to work with'] as const;
export type PraiseTag = (typeof PRAISE_TAGS)[number];

/** A review of a musician booking. */
export interface MusicianReview {
  recommend: boolean;
  tags: string[];
  text: string;
}

export interface ArtistScore {
  /** Whole percent of verified reviews that would book again; null when there are none. */
  recommendPct: number | null;
  /** Verified reviews counted. */
  total: number;
  recommended: number;
  /** Praise tags with counts, most frequent first. */
  topTags: { tag: string; count: number }[];
}

export interface ArtistScoreOptions {
  /** Extra verified reviews, e.g. your own reviews of completed bookings. */
  extra?: Pick<MusicianReview, 'recommend' | 'tags'>[];
  /** Review authors to leave out, e.g. blocked accounts. */
  exclude?: string[];
  /** How many tags to return (default 5). */
  tagLimit?: number;
}

/** True for profiles rated by "would book again" (musicians, DJs, bands). */
export function isMusician(id: string) {
  const k = profileById(id)?.kind;
  return k === 'musician' || k === 'dj' || k === 'band';
}

/** Verified sample reviews of a musician (only reviews from completed bookings count). */
export function verifiedMusicianReviews(id: string, exclude?: string[]): ReviewItem[] {
  return reviewsFor(id).filter((r) => r.verified && r.recommend != null && !exclude?.includes(r.authorId));
}

export function artistScore(id: string, opts?: ArtistScoreOptions): ArtistScore {
  const all: Pick<MusicianReview, 'recommend' | 'tags'>[] = [
    ...verifiedMusicianReviews(id, opts?.exclude).map((r) => ({ recommend: !!r.recommend, tags: r.tags ?? [] })),
    ...(opts?.extra ?? []),
  ];
  const total = all.length;
  const recommended = all.filter((r) => r.recommend).length;
  const counts = new Map<string, number>();
  all.forEach((r) => r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const topTags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || PRAISE_TAGS.indexOf(a.tag as PraiseTag) - PRAISE_TAGS.indexOf(b.tag as PraiseTag))
    .slice(0, opts?.tagLimit ?? 5);
  return { recommendPct: total ? Math.round((recommended / total) * 100) : null, total, recommended, topTags };
}

/** "92% would book again" or "No verified bookings yet". */
export function scoreLabel(s: ArtistScore) {
  return s.recommendPct == null ? 'No verified bookings yet' : `${s.recommendPct}% would book again`;
}

/** "from 12 verified bookings" */
export function scoreBasis(s: ArtistScore) {
  return s.total === 1 ? 'from 1 verified booking' : `from ${s.total} verified bookings`;
}
