// What a client needs to book: the coaches, the hours they open, what is taken, the prices. One load, shared by
// the start screen and the booking screens. The rules below mirror the server (it checks everything again when
// a session is asked for): see `_book` in supabase/schema.sql of the old repository.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { call, friendly } from "./supabase";
import { addDays, dateKey, parseKey, slotStart, startOfWeek } from "./dates";
import { useAccount } from "./account";

export const WEEKS_AHEAD = 4; // booking_weeks_ahead on the server
export const NOTICE_HOURS = 12; // booking_notice_hours on the server
export const NO_KIND = "Personal training"; // hours without a label are the classic 1:1 training

export type Coach = { id: string; name: string; short: string; role: string; bio: string; specialties: string[]; photo: string; available: boolean };
export type HoursRow = { id: string; trainerId: string; weekday: number | null; date: string | null; start: number; end: number; kind: string; activity: string; location: string; pending: boolean };
type Taken = { trainer_id: string; day: string; hour: number; booking_id: string | null; status: string | null };
export type Pricing = { price: number; introPrice: number; place: string; trainers: Record<string, number>; packs: { size: number; price: number }[] };
export type Slot = { coachId: string; day: string; hour: number; what: string; place: string; state: "free" | "mine" | "taken" };

// The first three coaches had their photo and title in the code of the old site, not in the database.
// Until their card is filled in there (Admin → Team → Edit), these stand in.
const FIRST: Record<string, { photo: string; role: string; specialties: string[] }> = {
  pieter: { photo: "coaches/pieter.jpg", role: "Hoofdcoach", specialties: ["CrossFit", "Calisthenics", "HIIT", "Muay Thai"] },
  filip: { photo: "coaches/filip.jpg", role: "Triatloncoach", specialties: ["Triatlon", "Groepstraining"] },
  maxim: { photo: "coaches/maxim.jpg", role: "Wielercoach", specialties: ["Wielrennen", "Groepstraining"] },
};
type CoachRow = { id: string; name: string; role: string | null; bio: string | null; specialties: string | null; linked: boolean; avatar_url: string | null; available?: boolean; edited?: boolean };
const toCoach = (r: CoachRow): Coach => {
  const first = r.edited ? undefined : FIRST[r.id];
  const tags = (r.specialties || "").split(/[,·]/).map((x) => x.trim()).filter(Boolean);
  return {
    id: r.id, name: r.name, short: r.name.trim().split(/\s+/)[0],
    role: r.role || first?.role || "Coach", bio: r.bio || "",
    specialties: tags.length ? tags : first?.specialties || [],
    photo: r.avatar_url || FIRST[r.id]?.photo || "", available: r.available !== false,
  };
};

type Data = {
  ready: boolean;
  error: string;
  coaches: Coach[];
  pricing: Pricing;
  coach: (id: string) => Coach | undefined;
  /** every hour a coach opens on a day, with what is given, where, and whether it can still be asked for */
  slots: (coachId: string, day: string) => Slot[];
  /** the days (from today to the booking horizon) on which a coach has a free hour */
  freeDays: (coachId: string, kind?: string) => { day: string; free: number }[];
  /** what a coach gives, from the labels on his hours */
  kindsOf: (coachId: string) => string[];
  /** the rows of hours of one coach as he set them (for the coach himself: also what waits for approval) */
  hoursOf: (coachId: string) => HoursRow[];
  reload: () => Promise<void>;
};
const Ctx = createContext<Data | null>(null);
const EMPTY: Pricing = { price: 50, introPrice: 0, place: "Grote zaal, Hoogstraat 40, Hofstade (Aalst)", trainers: {}, packs: [] };

export function BookingProvider({ children }: { children: ReactNode }) {
  const { player } = useAccount();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [hours, setHours] = useState<HoursRow[]>([]);
  const [taken, setTaken] = useState<Taken[]>([]);
  const [pricing, setPricing] = useState<Pricing>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const from = dateKey(new Date()), to = dateKey(startOfWeek(WEEKS_AHEAD));
      const [list, rows, slots, prices] = await Promise.all([
        call<CoachRow[]>("trainer_list"), call<HoursRow[]>("trainer_hours_list"),
        call<Taken[]>("slot_status", { p_from: from, p_to: to }), call<Partial<Pricing>>("pricing_info"),
      ]);
      setCoaches((list || []).map(toCoach));
      setHours((rows || []).map((r) => ({ ...r, start: Number(r.start), end: Number(r.end), weekday: r.weekday === null ? null : Number(r.weekday) })));
      setTaken((slots || []).map((s) => ({ ...s, hour: Number(s.hour) })));
      setPricing({ price: Number(prices?.price ?? EMPTY.price), introPrice: Number(prices?.introPrice ?? 0), place: prices?.place || EMPTY.place, trainers: prices?.trainers || {},
        packs: (prices?.packs || []).map((o) => ({ size: Number(o.size), price: Number(o.price) })) });
      setError("");
    } catch (err) {
      setError(friendly(err));
    }
    setReady(true);
  }, []);
  useEffect(() => { void reload(); }, [reload, player?.id]);

  const value = useMemo<Data>(() => {
    const byId = new Map(coaches.map((c) => [c.id, c]));
    const key = (t: string, d: string, h: number) => `${t}|${d}|${h}`;
    const busy = new Map<string, Taken>();
    taken.forEach((s) => { const k = key(s.trainer_id, s.day, s.hour); if (!busy.has(k) || s.booking_id) busy.set(k, s); });
    // the big room itself: the standard place, or one of the ways it was written before
    const inRoom = (place: string) => { const v = place.trim().toLowerCase(); return !v || v === pricing.place.toLowerCase() || ["hoogstraat 40, aalst", "hoogstraat 40, 9308 aalst", "level-up hq", "hq"].includes(v); };

    const slots = (coachId: string, day: string): Slot[] => {
      const c = byId.get(coachId);
      if (!c || !c.available) return []; // away: nothing to book
      const weekday = parseKey(day).getDay();
      const mine = hours.filter((r) => r.trainerId === coachId && !r.pending);
      const open = mine.filter((r) => r.kind === "open");
      const set = new Set<number>();
      open.forEach((r) => { if (r.weekday === weekday || r.date === day) for (let h = r.start; h < r.end; h++) set.add(h); });
      mine.forEach((r) => { if (r.kind === "closed" && r.date === day) for (let h = r.start; h < r.end; h++) set.delete(h); });
      const now = new Date(), horizon = startOfWeek(WEEKS_AHEAD, now);
      return [...set].sort((a, b) => a - b).map((hour) => {
        const hit = (r: HoursRow) => hour >= r.start && hour < r.end;
        const row = open.find((r) => hit(r) && r.date === day) || open.find((r) => hit(r) && r.date === null && r.weekday === weekday);
        const label = open.find((r) => hit(r) && r.activity && r.date === day) || open.find((r) => hit(r) && r.activity && r.weekday === weekday);
        const place = row?.location || pricing.place;
        const start = slotStart(day, hour);
        const own = busy.get(key(coachId, day, hour));
        const state: Slot["state"] = own?.booking_id ? "mine"
          : own || (inRoom(place) && busy.has(key("*", day, hour))) || start.getTime() - now.getTime() < NOTICE_HOURS * 3600e3 || start >= horizon ? "taken" : "free";
        return { coachId, day, hour, what: label?.activity || NO_KIND, place, state };
      }).filter((s) => slotStart(s.day, s.hour) > now);
    };
    const freeDays = (coachId: string, kind?: string) => {
      const out: { day: string; free: number }[] = [];
      const end = startOfWeek(WEEKS_AHEAD);
      for (let d = new Date(); d < end; d = addDays(d, 1)) {
        const day = dateKey(d);
        const free = slots(coachId, day).filter((s) => s.state === "free" && (!kind || s.what === kind)).length;
        if (free) out.push({ day, free });
      }
      return out;
    };
    const kindsOf = (coachId: string) => [...new Set(hours.filter((r) => r.trainerId === coachId && r.kind === "open" && !r.pending).map((r) => r.activity || NO_KIND))];
    const hoursOf = (coachId: string) => hours.filter((r) => r.trainerId === coachId);
    return { ready, error, coaches, pricing, coach: (id) => byId.get(id), slots, freeDays, kindsOf, hoursOf, reload };
  }, [coaches, hours, taken, pricing, ready, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking(): Data {
  const value = useContext(Ctx);
  if (!value) throw new Error("useBooking needs <BookingProvider>");
  return value;
}

export const euro = (n: number) => `€ ${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}`;

/** What a session costs this person, and why */
export function quote(player: { introEligible?: boolean; packs?: { status: string; remaining: number }[] } | null, pricing: Pricing, coachId: string) {
  const credits = (player?.packs || []).filter((p) => p.status === "paid" && p.remaining > 0).reduce((n, p) => n + p.remaining, 0);
  if (credits) return { free: true, text: "Met je pakket", note: `Daarna heb je nog ${credits - 1} ${credits - 1 === 1 ? "beurt" : "beurten"}.` };
  if (player?.introEligible) {
    return pricing.introPrice > 0
      ? { free: false, text: `${euro(pricing.introPrice)} · je eerste sessie`, note: "Betalen doe je ter plaatse." }
      : { free: true, text: "Gratis · je eerste sessie", note: "" };
  }
  return { free: false, text: euro(pricing.trainers[coachId] ?? pricing.price), note: "Betalen doe je ter plaatse." };
}
