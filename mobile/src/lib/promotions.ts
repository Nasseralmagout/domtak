import type { EventItem } from '../data/types';
import type { Promotion } from '../store/useApp';
import { parse, TODAY } from './format';

/** Event boosts ("featured listings"), on the demo clock. */

export const DAY_MS = 86_400_000;

export interface PromotionChain {
  /** The latest unbroken stretch of boosts for the event, oldest first (empty when never promoted). */
  run: Promotion[];
  /** When that stretch started (ms since epoch, 0 when never promoted). */
  start: number;
  /** When it ends before any cap at doors open (ms since epoch, 0 when never promoted). */
  end: number;
}

type EventRef = Pick<EventItem, 'id' | 'start'>;

/** The event's promotions oldest first. The store prepends new ones, so equal timestamps keep purchase order. */
function chronological(promotions: Promotion[], eventId: string) {
  return promotions
    .filter((p) => p.eventId === eventId)
    .reverse()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * Promotions for one event in order, each extension starting when the previous boost ends.
 * A boost bought after the previous stretch ran out starts a new stretch.
 */
export function promotionChain(promotions: Promotion[], eventId: string): PromotionChain {
  let run: Promotion[] = [];
  let start = 0;
  let end = 0;
  for (const p of chronological(promotions, eventId)) {
    const created = Date.parse(p.createdAt);
    if (created > end) {
      run = [];
      start = created;
    }
    run.push(p);
    end = Math.max(end, created) + p.days * DAY_MS;
  }
  return { run, start, end };
}

/** Doors open at the event start; boosts stop automatically then. */
export const doorsOpenAt = (event: Pick<EventItem, 'start'>) => parse(event.start);

/**
 * When the event's latest boost stretch ends, capped at doors open, or null if the event was never
 * promoted. The date can lie in the past: compare it with the demo clock, or use isPromoted.
 */
export function promotionEnd(promotions: Promotion[], event: EventRef): Date | null {
  const chain = promotionChain(promotions, event.id);
  if (!chain.run.length) return null;
  return new Date(Math.min(chain.end, doorsOpenAt(event).getTime()));
}

/** True while a boost for the event is running (before doors open). */
export function isPromoted(promotions: Promotion[], event: EventRef, now: Date = TODAY): boolean {
  const end = promotionEnd(promotions, event);
  return !!end && end.getTime() > now.getTime();
}

/**
 * The newest boost of the stretch running at `now` (its budget, radius and audience are the defaults
 * for an extension), or null when nothing runs. Pass the event instead of its id to also stop at
 * doors open.
 */
export function activePromotion(promotions: Promotion[], eventOrId: string | EventRef, now: Date = TODAY): Promotion | null {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;
  const chain = promotionChain(promotions, id);
  if (!chain.run.length) return null;
  const end = typeof eventOrId === 'string' ? chain.end : Math.min(chain.end, doorsOpenAt(eventOrId).getTime());
  return end > now.getTime() ? chain.run[chain.run.length - 1] : null;
}

export type PromotionState = { kind: 'none' } | { kind: 'running' | 'covered'; until: Date };

/**
 * One answer for every promote button: nothing running, a boost running until `until`, or 'covered'
 * when the running stretch already lasts until doors open (nothing left to extend).
 */
export function promotionState(promotions: Promotion[], event: EventRef, now: Date = TODAY): PromotionState {
  const end = promotionEnd(promotions, event);
  if (!end || end.getTime() <= now.getTime()) return { kind: 'none' };
  const covered = promotionChain(promotions, event.id).end >= doorsOpenAt(event).getTime();
  return { kind: covered ? 'covered' : 'running', until: end };
}
