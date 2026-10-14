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

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function ticketCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
