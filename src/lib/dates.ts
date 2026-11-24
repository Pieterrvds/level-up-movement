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

const WEEKDAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
/** "elke donderdag" for weekday 1 (Monday) … 7 (Sunday) */
export const everyWeekday = (weekday: number) => `elke ${WEEKDAYS[(weekday + 6) % 7]}`;
/** weekday of a day the way the server counts a weekly session: 1 = Monday … 7 = Sunday */
export const isoWeekday = (key: string) => ((parseKey(key).getDay() + 6) % 7) + 1;
/** "za 28 nov" */
export const shortDay = (key: string) => parseKey(key).toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");

/** A calendar file (.ics) for one session of an hour, to put in the calendar of the phone or computer */
export function calendarFile(id: string, title: string, place: string, day: string, hour: number) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const text = (v: string) => v.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const start = slotStart(day, hour), end = slotStart(day, hour + 1);
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LEVEL-UP movement//NL", "BEGIN:VEVENT", `UID:${id}@level-up-movement`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${text(title)}`, `LOCATION:${text(place)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  link.download = "level-up-sessie.ics";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
