// Days and hours. A day is written as "2026-11-28" (the way the database does), in the time of the person's device.
const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
export const slotStart = (key: string, hour: number) => { const d = parseKey(key); d.setHours(hour, 0, 0, 0); return d; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Monday 00:00 of the week `weeks` from now */
export function startOfWeek(weeks = 0, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * weeks);
  return d;
}
export const hourText = (hour: number) => `${pad(hour)}:00`;
export const hourSpan = (hour: number) => `${pad(hour)}:00 – ${pad(hour + 1)}:00`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Zaterdag 28 november" */
export const longDay = (key: string) => cap(parseKey(key).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }));
/** "za" and "28" for the day strip */
export const dayParts = (key: string) => {
  const d = parseKey(key);
  return { week: d.toLocaleDateString("nl-BE", { weekday: "short" }).replace(".", ""), day: d.getDate(), month: d.toLocaleDateString("nl-BE", { month: "short" }).replace(".", "") };
};
/** "vandaag", "morgen", "over 3 dagen" */
export function inDays(key: string, now = new Date()) {
  const n = Math.round((parseKey(key).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400e3);
  return n <= 0 ? "vandaag" : n === 1 ? "morgen" : `over ${n} dagen`;
}
