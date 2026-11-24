// The chat: your conversations live on the server (chat_* functions, shared with the old site). This part keeps the
// number of unread messages for the Chat button, and has the small helpers the chat screens share.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, Notice } from "../ui";
import { call, friendly } from "./supabase";
import { useAccount } from "./account";

/** One conversation in your list. A group chat has `group`; the other person otherwise. */
export type Thread = {
  id: string; side: "client" | "trainer" | "group"; direct: boolean;
  name: string; role: string; avatarUrl: string | null; trainerId: string | null; userId?: string;
  group?: boolean; team?: boolean; members?: number; next?: string | null; muted?: boolean;
  lastAt: string | null; lastBody: string | null; lastMine: boolean | null; unread: number; archived: boolean;
};
export type Message = { id: number; mine: boolean; body: string; at: string; name?: string | null; coach?: boolean; likes?: number; liked?: boolean };
/** A conversation with its messages, as chat_thread gives it */
export type Conversation = Omit<Thread, "lastAt" | "lastBody" | "lastMine" | "unread"> & {
  messages: Message[]; hearts: { id: number; n: number; mine: boolean }[]; peerReadId: number | null;
};
export type Person = { name: string; avatarUrl: string | null; userId: string; trainerId: string | null; role: string };

type Chat = { unread: number; check: () => void };
const Ctx = createContext<Chat>({ unread: 0, check: () => {} });
const EVERY_MS = 20000;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { player } = useAccount();
  const [unread, setUnread] = useState(0);
  const id = player?.id;
  const busy = useRef(false);
  const check = useCallback(() => {
    if (!id || busy.current) return;
    busy.current = true;
    call<{ unread: number }>("chat_unread").then((r) => setUnread(Number(r?.unread) || 0), () => {}).finally(() => { busy.current = false; });
  }, [id]);
  useEffect(() => {
    if (!id) { setUnread(0); return; }
    check();
    const timer = setInterval(() => { if (document.visibilityState === "visible") check(); }, EVERY_MS);
    const back = () => { if (document.visibilityState === "visible") check(); };
    // a notification came in while the app is open: the service worker tells the page
    const pushed = (e: MessageEvent) => { if (e.data?.type === "push") check(); };
    document.addEventListener("visibilitychange", back);
    navigator.serviceWorker?.addEventListener("message", pushed);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", back); navigator.serviceWorker?.removeEventListener("message", pushed); };
  }, [id, check]);
  return <Ctx.Provider value={{ unread, check }}>{children}</Ctx.Provider>;
}
export const useChat = () => useContext(Ctx);

/** The server names roles in English; a coach's own title passes as it is */
export const roleText = (t: { role?: string; group?: boolean; team?: boolean; members?: number }) => {
  if (t.group) return t.team ? "Teamchat van de coaches" : `Groepschat${t.members ? ` · ${t.members} ${t.members === 1 ? "lid" : "leden"}` : ""}`;
  if (!t.role || t.role === "Player") return "Lid";
  if (t.role === "Personal trainer") return "Coach";
  return t.role;
};

/** Open (or start) the conversation with a coach or with a member; gives the id of the conversation */
export const openWithCoach = (trainerId: string) => call<string>("chat_open", { p_trainer: trainerId });
export const openWithUser = (userId: string) => call<string>("chat_open_user", { p_user: userId });

/** "Bericht": straight into the conversation with this coach (by card) or this member (by account) */
export function MessageButton({ coach, user, label = "Bericht", block }: { coach?: string; user?: string; label?: string; block?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    try { navigate(`/chat/${await (coach ? openWithCoach(coach) : openWithUser(user || ""))}`); } catch (e) { setError(friendly(e)); setBusy(false); }
  };
  return (
    <>
      <Button variant="secondary" size={block ? "md" : "sm"} block={block} icon={<MessageCircle size={18} />} disabled={busy} onClick={() => void go()}>{label}</Button>
      {error && <Notice tone="danger">{error}</Notice>}
    </>
  );
}

const DAY = 86400000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** "14:05" today, "gisteren", "ma" this week, "3 nov" before that: for the list */
export function shortWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso), days = Math.round((midnight(new Date()) - midnight(d)) / DAY);
  if (days <= 0) return d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "gisteren";
  if (days < 7) return d.toLocaleDateString("nl-BE", { weekday: "short" });
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}
/** "Vandaag", "Gisteren", "maandag 3 november": the line between two days in a conversation */
export function dayLine(iso: string): string {
  const d = new Date(iso), days = Math.round((midnight(new Date()) - midnight(d)) / DAY);
  if (days <= 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  const text = d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", ...(days > 300 ? { year: "numeric" } : {}) });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export const clock = (iso: string) => new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
