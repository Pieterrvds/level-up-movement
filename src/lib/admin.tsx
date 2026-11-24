// What the admin sees and decides: members, every session, applications, packs, kinds to approve, what the coaches
// changed. Loaded only for an admin (admin_data and friends); the server checks every action again.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { call, friendly } from "./supabase";
import { useAccount } from "./account";
import { toClass, STALE_MS } from "./booking";
import type { CoachBooking, CoachClass } from "./coach";
import { dateKey, addDays } from "./dates";

export type Member = { id: string; name: string; email: string; xp: number; avatarUrl: string | null; trainerId: string | null; admin: boolean; createdAt: string; lastLogin: string | null };
export type AdminBooking = CoachBooking & { email: string; trainerFee: number; payoutAt: string | null; payMethod: string; refundStatus: string | null };
export type Application = { id: string; name: string; email: string; role: string; specialties: string; bio: string; status: string; trainerId: string | null; createdAt: string };
export type AdminPack = { id: string; size: number; price: number; status: string; remaining: number; name: string; email: string; createdAt: string };
export type Kind = {
  key: string; title: string; status: string; description: string | null; trainerId: string | null; proposedAt: string | null;
  hours: { trainerId: string; weekday: number | null; date: string | null; start: number; end: number }[];
  classes: { id: string; trainerId: string; date: string; time: string; weekly: boolean }[];
};
export type LogItem = { id: number; trainerId: string; title: string; detail: string; at: string; unread: boolean };
export type AdminClass = CoachClass & { trainerFee: number; payoutAt: string | null; refunds: { id: string; name: string; price: number }[] };
export type AdminPricing = { price: number; fee: number; introPrice: number; ownerTrainerId: string; trainers: Record<string, { price: number | null; fee: number | null }> };

type Admin = {
  ready: boolean; error: string;
  members: Member[]; bookings: AdminBooking[]; applications: Application[]; unlinked: string[]; packs: AdminPack[];
  kinds: Kind[]; log: LogItem[]; logUnread: number; classes: AdminClass[]; pricing: AdminPricing;
  reload: () => Promise<void>; refresh: () => void;
};
const NO_PRICING: AdminPricing = { price: 0, fee: 0, introPrice: 0, ownerTrainerId: "", trainers: {} };
const Ctx = createContext<Admin | null>(null);
const num = (v: unknown) => Number(v) || 0;

export function AdminProvider({ children }: { children: ReactNode }) {
  const { player } = useAccount();
  const isAdmin = Boolean(player?.admin);
  const [state, setState] = useState<Omit<Admin, "reload" | "refresh" | "ready" | "error">>({ members: [], bookings: [], applications: [], unlinked: [], packs: [], kinds: [], log: [], logUnread: 0, classes: [], pricing: NO_PRICING });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const loadedAt = useRef(0);
  const reload = useCallback(async () => {
    loadedAt.current = Date.now();
    if (!isAdmin) { setReady(true); return; }
    try {
      type Raw = { players: Member[]; bookings: AdminBooking[]; applications: Application[]; unlinkedTrainers: string[]; packs: AdminPack[]; pricing: AdminPricing };
      const [d, kinds, log, classes] = await Promise.all([
        call<Raw>("admin_data"),
        call<Kind[]>("training_kinds").catch(() => []),
        call<{ unread: number; items: LogItem[] }>("admin_coach_log", { p_seen: false }).catch(() => ({ unread: 0, items: [] })),
        call<AdminClass[]>("class_manage_list", { p_days: 800 }).catch(() => []),
      ]);
      setState({
        members: (d.players || []).map((m) => ({ ...m, xp: num(m.xp), admin: Boolean(m.admin), trainerId: m.trainerId || null })),
        bookings: (d.bookings || []).map((b) => ({ ...b, hour: num(b.hour), price: num(b.price), trainerFee: num(b.trainerFee) })),
        applications: d.applications || [], unlinked: d.unlinkedTrainers || [],
        packs: (d.packs || []).map((p) => ({ ...p, size: num(p.size), price: num(p.price), remaining: num(p.remaining) })),
        kinds: kinds || [], log: log?.items || [], logUnread: num(log?.unread),
        classes: (classes || []).map((c) => ({ ...toClass(c), trainerFee: num(c.trainerFee), refunds: c.refunds || [] })),
        pricing: { ...NO_PRICING, ...d.pricing, price: num(d.pricing?.price), fee: num(d.pricing?.fee), introPrice: num(d.pricing?.introPrice), trainers: d.pricing?.trainers || {} },
      });
      setError("");
    } catch (err) { setError(friendly(err)); }
    setReady(true);
  }, [isAdmin]);
  useEffect(() => { void reload(); }, [reload]);
  const refresh = useCallback(() => { if (Date.now() - loadedAt.current > STALE_MS) void reload(); }, [reload]);
  useEffect(() => {
    const back = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [refresh]);
  return <Ctx.Provider value={{ ...state, ready, error, reload, refresh }}>{children}</Ctx.Provider>;
}
export function useAdmin(): Admin {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin must be used inside AdminProvider");
  return v;
}

const BILLABLE = ["completed", "no_show", "late_cancel"];
/** A session that still has to be paid at the desk (not with a pack or a free turn) */
export const toCollect = (b: AdminBooking) => !["pack", "reward"].includes(b.payMethod) && b.payStatus === "unpaid" && b.price > 0 && ["pending", "confirmed", ...BILLABLE].includes(b.status);
/** What a coach has earned and not yet received: sessions that count and finished classes. The owner gets nothing paid out. */
export function owedTo(a: Admin, trainerId: string): { amount: number; count: number } {
  if (trainerId === a.pricing.ownerTrainerId) return { amount: 0, count: 0 };
  const fees = [
    ...a.bookings.filter((b) => b.trainerId === trainerId && BILLABLE.includes(b.status) && !b.payoutAt).map((b) => b.trainerFee),
    ...a.classes.filter((c) => c.trainerId === trainerId && c.status === "done" && !c.payoutAt).map((c) => c.trainerFee),
  ];
  return { amount: fees.reduce((s, f) => s + f, 0), count: fees.length };
}
/** Sessions (asked or confirmed) and classes in the next 7 days, for one coach or for everyone */
export function thisWeek(a: Admin, trainerId?: string): number {
  const from = dateKey(new Date()), to = dateKey(addDays(new Date(), 7));
  const mine = (id: string) => !trainerId || id === trainerId;
  return a.bookings.filter((b) => mine(b.trainerId) && ["pending", "confirmed"].includes(b.status) && b.date >= from && b.date < to).length
    + a.classes.filter((c) => mine(c.trainerId) && c.status === "scheduled" && c.date >= from && c.date < to).length;
}
/** What waits on the admin */
export function adminTodo(a: Admin) {
  const kinds = a.kinds.filter((k) => k.status === "pending");
  const applications = a.applications.filter((x) => x.status === "pending");
  const packs = a.packs.filter((p) => p.status === "requested");
  const refunds = [
    ...a.bookings.filter((b) => b.refundStatus === "manual").map((b) => ({ id: b.id, name: b.name, price: b.price, kind: "session" as const })),
    ...a.classes.flatMap((c) => c.refunds.map((r) => ({ id: r.id, name: r.name, price: Number(r.price) || 0, kind: "class" as const }))),
  ];
  return { kinds, applications, packs, refunds, count: kinds.length + applications.length + packs.length + refunds.length };
}

// The coach log is written by the server in English
const LOG: [RegExp, string][] = [
  [/^Session moved/, "Sessie verplaatst"], [/^New hours/, "Nieuwe uren"], [/^Hours changed/, "Uren gewijzigd"], [/^Hours removed/, "Uren verwijderd"],
  [/Active again/, "Weer actief"], [/Away for now/, "Even afwezig"], [/New kind of training to approve/, "Nieuwe soort om goed te keuren"],
  [/^New group class/, "Nieuwe groepsles"], [/^Group class cancelled/, "Groepsles geannuleerd"], [/^Group class changed/, "Groepsles gewijzigd"],
];
const WORDS: Record<string, string> = {
  Mon: "ma", Tue: "di", Wed: "wo", Thu: "do", Fri: "vr", Sat: "za", Sun: "zo", May: "mei", Oct: "okt", Mar: "mrt",
  Jan: "jan", Feb: "feb", Apr: "apr", Jun: "jun", Jul: "jul", Aug: "aug", Sep: "sep", Nov: "nov", Dec: "dec",
  Monday: "maandag", Tuesday: "dinsdag", Wednesday: "woensdag", Thursday: "donderdag", Friday: "vrijdag", Saturday: "zaterdag", Sunday: "zondag",
  every: "elke", closed: "gesloten", weekly: "wekelijks",
};
export const logTitle = (title: string) => LOG.find(([re]) => re.test(title))?.[1] || title;
export const logDetail = (detail: string) => (detail || "").replace(/day off/g, "vrije dag").replace(/Players can book again\./, "Klanten kunnen weer boeken.")
  .replace(/No new bookings until switched back on\. What is planned stays\./, "Geen nieuwe boekingen tot hij weer actief is. Wat gepland is, blijft.")
  .replace(/\b[A-Za-z]+\b/g, (w) => WORDS[w] ?? w);
