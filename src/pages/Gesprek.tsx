// One conversation: the messages, the line to type in, and a small menu (archive, delete, mute).
// The frame hides its bars on a phone while this screen is open, so the keyboard and the messages have the room.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Archive, ArchiveRestore, BellOff, CalendarPlus, Ellipsis, Heart, Trash2, UsersRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Bubble, Button, Card, Composer, Empty, ListRow, Notice, Sheet, Switch } from "../ui";
import { call, friendly } from "../lib/supabase";
import { useBooking } from "../lib/booking";
import { clock, dayLine, roleText, useChat } from "../lib/chat";
import type { Conversation, Message } from "../lib/chat";

const EVERY_MS = 3000;
const Icon = ({ children }: { children: React.ReactNode }) => <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken text-muted">{children}</span>;
const withHearts = (list: Message[], hearts: Conversation["hearts"]) => {
  const by = new Map(hearts.map((h) => [h.id, h]));
  return list.map((m) => ({ ...m, likes: by.get(m.id)?.n || 0, liked: Boolean(by.get(m.id)?.mine) }));
};
/** Web addresses in a message become links */
const linked = (text: string) => text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
  i % 2 ? <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">{part}</a> : part);

/** The height that is really free: on a phone the keyboard takes its part of the screen */
function useFreeHeight() {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () => setH(Math.round(vv.height));
    set();
    vv.addEventListener("resize", set);
    return () => vv.removeEventListener("resize", set);
  }, []);
  return h;
}

export default function Gesprek() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { check } = useChat();
  const { coach } = useBooking();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [gone, setGone] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // you are at the newest message: stay there when one comes in
  const free = useFreeHeight();

  // new messages since the last one we have (the first time: the whole conversation). Opening it marks it as read.
  const pull = useCallback(async (first = false) => {
    try {
      const c = await call<Conversation>("chat_thread", { p_thread: id, p_after: first ? 0 : last.current });
      const fresh = c.messages || [];
      if (fresh.length) last.current = Math.max(last.current, ...fresh.map((m) => m.id));
      setConv((old) => {
        const known = first || !old ? [] : old.messages;
        const seen = new Set(known.map((m) => m.id));
        return { ...c, messages: withHearts([...known, ...fresh.filter((m) => !seen.has(m.id))], c.hearts || []) };
      });
      if (first || fresh.length) check();
    } catch (e) { if (first) setGone(friendly(e)); }
  }, [id, check]);

  useEffect(() => {
    last.current = 0; stick.current = true;
    setConv(null); setGone(""); setError(""); setText("");
    void pull(true);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void pull(); }, EVERY_MS);
    const back = () => { if (document.visibilityState === "visible") void pull(); };
    const pushed = (e: MessageEvent) => { if (e.data?.type === "push") void pull(); };
    document.addEventListener("visibilitychange", back);
    navigator.serviceWorker?.addEventListener("message", pushed);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", back); navigator.serviceWorker?.removeEventListener("message", pushed); };
  }, [pull]);

  // stay at the newest message when one comes in or when the keyboard changes the height
  const count = conv?.messages.length || 0;
  useLayoutEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [count, free]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError("");
    try {
      const m = await call<Message>("chat_send", { p_thread: id, p_body: body });
      last.current = Math.max(last.current, m.id);
      stick.current = true;
      setConv((old) => (old && !old.messages.some((x) => x.id === m.id) ? { ...old, messages: [...old.messages, { ...m, likes: 0, liked: false }] } : old));
      setText("");
    } catch (e) { setError(friendly(e)); }
    setSending(false);
  };
  const heart = async (m: Message) => {
    try {
      const r = await call<{ id: number; likes: number; liked: boolean }>("chat_like", { p_message: m.id });
      setConv((old) => (old ? { ...old, messages: old.messages.map((x) => (x.id === r.id ? { ...x, likes: r.likes, liked: r.liked } : x)) } : old));
    } catch (e) { setError(friendly(e)); }
  };
  // after: "leave" = back to the list, "close" = close the menu, "stay" = the menu stays open (a switch)
  const act = async (action: () => Promise<unknown>, after: "leave" | "close" | "stay") => {
    setBusy(true); setError("");
    try {
      await action(); setSure(false);
      if (after === "leave") { setMenu(false); navigate("/chat"); } else { if (after === "close") setMenu(false); await pull(); }
    } catch (e) { setError(friendly(e)); }
    setBusy(false);
  };

  if (gone) return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8"><Card pad={false}><Empty title="Dit gesprek vinden we niet" text={gone} action={<Button onClick={() => navigate("/chat")}>Naar je gesprekken</Button>} /></Card></div>
  );

  const lastMine = conv ? [...conv.messages].reverse().find((m) => m.mine) : undefined;
  const read = Boolean(conv && !conv.group && lastMine && conv.peerReadId && conv.peerReadId >= lastMine.id);
  let day = "";
  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col sm:border-x sm:border-line" style={free ? { height: free } : undefined}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2">
        <button type="button" onClick={() => navigate("/chat")} aria-label="Terug naar je gesprekken" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken"><ArrowLeft size={22} /></button>
        {conv && (conv.group
          ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink"><UsersRound size={18} aria-hidden /></span>
          : <Avatar name={conv.name || "?"} src={conv.avatarUrl || (conv.trainerId && coach(conv.trainerId)?.photo) || undefined} size={36} />)}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] leading-tight font-semibold">{conv ? conv.name || "Gesprek" : "Even laden…"}</h1>
          {conv && <p className="truncate text-xs text-muted">{roleText(conv)}</p>}
        </div>
        {conv && <button type="button" onClick={() => { setSure(false); setError(""); setMenu(true); }} aria-label="Meer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken"><Ellipsis size={22} /></button>}
      </header>

      <div ref={box} role="log" aria-label="Berichten" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {conv && conv.messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Nog geen berichten. Schrijf het eerste.</p>}
        <div className="grid gap-2">
          {conv?.messages.map((m) => {
            const line = dayLine(m.at), first = line !== day;
            day = line;
            return (
              <div key={m.id} className="grid gap-2">
                {first && <p className="py-1 text-center text-xs font-medium text-muted">{line}</p>}
                <Bubble mine={m.mine} name={!m.mine && conv.group ? `${m.name || "Lid"}${m.coach ? " · coach" : ""}` : undefined} time={clock(m.at)}
                  below={m.mine
                    ? (m.likes || (read && m.id === lastMine?.id)) ? <>{m.likes ? <span className="inline-flex items-center gap-1 text-accent-ink"><Heart size={13} fill="currentColor" aria-hidden />{m.likes}</span> : null}{read && m.id === lastMine?.id ? <span>Gelezen</span> : null}</> : undefined
                    : <button type="button" onClick={() => void heart(m)} aria-pressed={Boolean(m.liked)} aria-label={m.liked ? "Hartje terugnemen" : "Geef een hartje"}
                        className={`inline-flex h-6 items-center gap-1 rounded-full px-1 ${m.liked ? "text-accent-ink" : "text-faint hover:text-muted"}`}><Heart size={14} fill={m.liked ? "currentColor" : "none"} aria-hidden />{m.likes ? m.likes : null}</button>}>
                  {linked(m.body)}
                </Bubble>
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {error && !menu && <div className="mb-2"><Notice tone="danger">{error}</Notice></div>}
        <Composer value={text} onChange={setText} onSend={() => void send()} busy={sending || !conv} />
      </div>

      <Sheet open={menu} onClose={() => { setMenu(false); setSure(false); }} title={conv?.name || "Gesprek"}>
        {conv && (
          <div className="-mx-5 -my-4 divide-y divide-line">
            {conv.side === "client" && conv.trainerId && <ListRow lead={<Icon><CalendarPlus size={20} /></Icon>} title="Boek een sessie" text={`Bij ${conv.name}`} onClick={() => navigate(`/boeken/${conv.trainerId}`)} />}
            {conv.group && <ListRow lead={<Icon><BellOff size={20} /></Icon>} title="Meldingen van deze groep" text={conv.muted ? "Uit: je ziet nieuwe berichten alleen hier." : "Aan"} chevron={false}
              trail={<Switch checked={!conv.muted} label="Meldingen van deze groep" onChange={(on) => void act(() => call("chat_mute", { p_thread: id, p_on: !on }), "stay")} />} />}
            {conv.archived
              ? <ListRow lead={<Icon><ArchiveRestore size={20} /></Icon>} title="Terug naar je gesprekken" text="Haal het uit je archief." chevron={false} onClick={busy ? undefined : () => void act(() => call("chat_archive", { p_thread: id, p_on: false }), "close")} />
              : <ListRow lead={<Icon><Archive size={20} /></Icon>} title="Archiveren" text={conv.group ? "Weg uit je lijst en stil, tot je het terughaalt." : "Weg uit je lijst tot er een nieuw bericht komt."} chevron={false} onClick={busy ? undefined : () => void act(() => call("chat_archive", { p_thread: id, p_on: true }), "leave")} />}
            {!conv.group && (sure
              ? <div className="grid gap-3 px-5 py-4">
                  <p className="text-sm text-muted">Het gesprek verdwijnt alleen bij jou; {conv.name} houdt het zijne. Een nieuw gesprek met {conv.name} begint leeg.</p>
                  <div className="flex gap-2"><Button variant="danger" disabled={busy} onClick={() => void act(() => call("chat_delete", { p_thread: id }), "leave")}>Ja, verwijder</Button><Button variant="secondary" onClick={() => setSure(false)}>Toch niet</Button></div>
                </div>
              : <ListRow lead={<Icon><Trash2 size={20} /></Icon>} title="Gesprek verwijderen" text="Alleen bij jou." chevron={false} onClick={() => setSure(true)} />)}
            {error && <div className="px-5 py-3"><Notice tone="danger">{error}</Notice></div>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
