// What a coach needs: the sessions clients asked for or booked with him, his earnings and the kinds of session
// that exist. Loaded once for who has a trainer card, shared by "Vandaag", "Agenda" and the profile.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { call, friendly } from "./supabase";
import { useAccount } from "./account";
import type { Booking } from "./account";
import { slotStart } from "./dates";

/** A session as the coach sees it: the booking plus who it is and what he should know */
export type CoachBooking = Booking & {
  name: string; userId: string; avatar: string | null; note: string;
  health: { hasRisk: boolean; answers: Record<string, boolean>; notes: string; valid: boolean } | null;
};
export type Earnings = { sessions: number; earned: number; paid: number; owed: number; expected: number; isOwner: boolean };
type Coach = { ready: boolean; error: string; bookings: CoachBooking[]; earnings: Earnings | null; kinds: string[]; reload: () => Promise<void> };
const Ctx = createContext<Coach | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const { player } = useAccount();
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [kinds, setKinds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const isCoach = Boolean(player?.trainerId);
  const reload = useCallback(async () => {
    if (!isCoach) { setReady(true); return; }
    try {
      const [rows, money, list] = await Promise.all([
        call<CoachBooking[]>("coach_bookings"), call<Record<string, unknown> | null>("coach_earnings"),
        call<{ title: string; status: string }[]>("training_kinds").catch(() => []),
      ]);
      setBookings((rows || []).map((b) => ({ ...b, hour: Number(b.hour), price: Number(b.price) })));
      setEarnings(money ? { sessions: Number(money.sessions) || 0, earned: Number(money.earned) || 0, paid: Number(money.paid) || 0, owed: Number(money.owed) || 0, expected: Number(money.expected) || 0, isOwner: Boolean(money.isOwner) } : null);
      setKinds((list || []).filter((k) => k.status === "approved").map((k) => k.title));
      setError("");
    } catch (err) { setError(friendly(err)); }
    setReady(true);
  }, [isCoach]);
  useEffect(() => { void reload(); }, [reload]);
  return <Ctx.Provider value={{ ready, error, bookings, earnings, kinds, reload }}>{children}</Ctx.Provider>;
}
export function useCoach(): Coach {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCoach needs <CoachProvider>");
  return value;
}

const started = (b: Booking, now = new Date()) => slotStart(b.date, b.hour) <= now;
/** what waits for the coach: requests to answer (one line per weekly request) and sessions of today or earlier to finish */
export function todo(list: CoachBooking[]) {
  const seen = new Set<string>();
  const requests = list.filter((b) => b.status === "pending" && !started(b)).filter((b) => {
    if (!b.series || b.series.status !== "requested") return true;
    if (seen.has(b.series.id)) return false;
    seen.add(b.series.id); return true;
  });
  const finish = list.filter((b) => b.status === "confirmed" && started(b));
  return { requests, finish };
}
/** sessions that are still to come (asked for or confirmed), soonest first */
export const coming = (list: CoachBooking[]) => list.filter((b) => ["pending", "confirmed"].includes(b.status) && !started(b));
