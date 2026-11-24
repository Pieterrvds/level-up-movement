// Who is logged in. One place that knows the session, the account as the server gives it (my_data) and the role.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { call, friendly, siteUrl, supabase } from "./supabase";
import type { Role } from "../nav";

/** The account as `my_data` returns it. Only the fields the screens built so far use; the server sends more. */
export type Player = {
  id: string;
  name: string;
  email: string;
  xp: number;
  avatarUrl: string | null;
  trainerId: string | null;
  admin: boolean;
  createdAt: string;
  /** true until the first session that counts: the first one has its own price (free today) */
  introEligible?: boolean;
  /** the health questions: asked before a first session and again after a year */
  healthForm?: { valid: boolean; hasRisk: boolean; answers: Record<string, boolean>; notes: string } | null;
  packs?: { status: string; remaining: number }[];
  bookings: Booking[];
};
/** A session of this person with a coach, as the server gives it (`_booking_json`) */
export type Booking = { id: string; trainerId: string; date: string; hour: number; status: string; what: string | null; place: string | null; price: number };

type Status = "loading" | "visitor" | "in";
type Account = {
  status: Status;
  player: Player | null;
  /** set when the account could not be loaded although someone is logged in */
  error: string;
  /** the screens this account can use; an admin who also coaches has two */
  roles: Role[];
  role: Role;
  setRole: (role: Role) => void;
  /** true right after the link of "forgot my password" was opened: a new password must be chosen */
  recovering: boolean;
  logIn: (email: string, password: string) => Promise<void>;
  /** returns true when the account still has to be confirmed by email */
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  logOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const Ctx = createContext<Account | null>(null);
const ROLE_KEY = "lum.weergave";
const cleanEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim());

const rolesOf = (p: Player | null): Role[] => {
  if (!p) return ["klant"];
  const list: Role[] = [];
  if (p.trainerId) list.push("coach");
  if (p.admin) list.push("admin");
  return list.length ? list : ["klant"];
};

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [picked, setPicked] = useState<string>(() => { try { return localStorage.getItem(ROLE_KEY) || ""; } catch { return ""; } });
  const userId = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call<Player | null>("my_data");
      if (!data) throw new Error("Je account werd niet gevonden.");
      setPlayer({ ...data, xp: Number(data.xp) || 0, admin: Boolean(data.admin), trainerId: data.trainerId || null,
        bookings: (data.bookings || []).map((b) => ({ ...b, hour: Number(b.hour), price: Number(b.price) })) });
      setError("");
    } catch (err) {
      setError(friendly(err));
    }
    setStatus("in");
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      const id = session?.user.id || null;
      if (!id) {
        userId.current = null;
        setPlayer(null); setError(""); setRecovering(false); setStatus("visitor");
        return;
      }
      if (id === userId.current) return; // the same person (a refreshed token, the tab came back): nothing to load
      userId.current = id;
      // not inside this callback: Supabase holds a lock while it runs, and a database call here would wait on it
      setTimeout(() => { void load(); if (event === "SIGNED_IN") void call("touch_login").catch(() => {}); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const roles = useMemo(() => rolesOf(player), [player]);
  const role = roles.includes(picked as Role) ? (picked as Role) : roles[0];

  const value: Account = {
    status, player, error, roles, role, recovering,
    setRole: (r) => { setPicked(r); try { localStorage.setItem(ROLE_KEY, r); } catch { /* private window: fine */ } },
    reload: load,
    async logIn(email, password) {
      const { error: e } = await supabase.auth.signInWithPassword({ email: cleanEmail(email), password });
      if (e) throw new Error(friendly(e));
    },
    async signUp(name, email, password) {
      const { data, error: e } = await supabase.auth.signUp({
        email: cleanEmail(email), password,
        options: { data: { name: name.trim().slice(0, 24) }, emailRedirectTo: siteUrl() },
      });
      if (e) throw new Error(friendly(e));
      // an address that already has an account comes back without an identity (the server does not say so out loud)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error(friendly("already registered"));
      return !data.session;
    },
    async resendConfirmation(email) {
      const { error: e } = await supabase.auth.resend({ type: "signup", email: cleanEmail(email), options: { emailRedirectTo: siteUrl() } });
      if (e) throw new Error(friendly(e));
    },
    async requestPasswordReset(email) {
      const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail(email), { redirectTo: siteUrl() });
      if (e) throw new Error(friendly(e));
    },
    async setPassword(password) {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw new Error(friendly(e));
      setRecovering(false);
    },
    async logOut() {
      const { error: e } = await supabase.auth.signOut();
      if (e) throw new Error(friendly(e));
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): Account {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAccount needs <AccountProvider>");
  return value;
}
