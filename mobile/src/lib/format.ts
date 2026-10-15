const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Demo "today" so the sample data always looks upcoming. */
export const TODAY = new Date('2026-10-14T12:00:00');

const pad = (n: number) => String(n).padStart(2, '0');

export function parse(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

/** "Thu 22 Oct" */
export function shortDate(iso: string) {
  const d = parse(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "22:00" */
export function time(iso: string) {
  const d = parse(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Thu 22 Oct, 22:00 – 06:00" */
export function eventWhen(start: string, end: string) {
  return `${shortDate(start)}, ${time(start)} – ${time(end)}`;
}

export function monthShort(iso: string) {
  return MONTHS[parse(iso).getMonth()];
}

export function dayOfMonth(iso: string) {
  return parse(iso).getDate();
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local ISO timestamp without a time zone, e.g. "2026-10-14T12:00:00" (parse() reads it back as local time). */
export function isoLocal(d: Date) {
  return `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** The demo clock as a local ISO timestamp. Use for "now" stamps in store actions (never the real clock). */
export function nowIso() {
  return isoLocal(TODAY);
}

/** `iso` (or a Date) moved by `h` hours, as a local ISO timestamp. */
export function addHours(iso: string | Date, h: number) {
  const d = typeof iso === 'string' ? parse(iso) : iso;
  return isoLocal(new Date(d.getTime() + h * 3_600_000));
}

/** Whole hours from `now` until `iso` (negative when it is in the past). */
export function hoursUntil(iso: string, now: Date = TODAY) {
  return (parse(iso).getTime() - now.getTime()) / 3_600_000;
}

/** "just now", "45 min ago", "3 h ago", "2 days ago", or the short date for older times. */
export function ago(iso: string, now: Date = TODAY) {
  const mins = Math.round((now.getTime() - parse(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return shortDate(iso);
}

/** "Thu 22 Oct, 22:00" */
export function dateTime(iso: string) {
  return `${shortDate(iso)}, ${time(iso)}`;
}

/** German-style euro: €1.200 or €25,00 */
export function euro(n: number, cents = false) {
  const fixed = cents ? n.toFixed(2) : Math.round(n).toString();
  const [int, dec] = fixed.split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `€${withDots}${dec ? `,${dec}` : ''}`;
}

/** 50210 -> "50.2K" */
export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function priceRange(prices: number[]) {
  if (prices.length === 0) return 'Free';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max === 0) return 'Free entry';
  if (min === max) return euro(min);
  return `${min === 0 ? 'Free' : euro(min)} – ${euro(max)}`;
}

/** Plural helper: plural(3, 'guest') -> "3 guests". */
export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function ticketCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
