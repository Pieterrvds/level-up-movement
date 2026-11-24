// Your conversations: with a coach, with another member, and the group chats of your classes.
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Plus, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Card, Count, Empty, Field, List, ListRow, Notice, Page, Sheet, Tabs } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { openWithCoach, openWithUser, roleText, shortWhen, useChat } from "../lib/chat";
import type { Person, Thread } from "../lib/chat";

const GroupIcon = () => <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink"><UsersRound size={20} aria-hidden /></span>;

export default function Chat() {
  const { player } = useAccount();
  const { coaches, coach } = useBooking();
  const { check } = useChat();
  const navigate = useNavigate();
  const [list, setList] = useState<Thread[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"open" | "archief">("open");
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const asked = useRef(0);

  const load = useCallback(() => call<Thread[]>("chat_list").then((l) => { setList(l || []); setError(""); }, (e) => setError(friendly(e))), []);
  useEffect(() => {
    void load(); check();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    const back = () => { if (document.visibilityState === "visible") void load(); };
    const pushed = (e: MessageEvent) => { if (e.data?.type === "push") void load(); };
    document.addEventListener("visibilitychange", back);
    navigator.serviceWorker?.addEventListener("message", pushed);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", back); navigator.serviceWorker?.removeEventListener("message", pushed); };
  }, [load, check]);

  // looking for someone by name: a short pause after the last letter, and only the newest answer counts
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setFound(null); return; }
    const n = ++asked.current;
    const timer = setTimeout(() => { call<Person[]>("chat_search", { p_query: q }).then((r) => { if (n === asked.current) setFound(r || []); }, () => { if (n === asked.current) setFound([]); }); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const start = async (open: () => Promise<string>) => {
    setBusy(true); setSheetError("");
    try { const id = await open(); setSheet(false); navigate(`/chat/${id}`); } catch (e) { setSheetError(friendly(e)); }
    setBusy(false);
  };
  const openSheet = () => { setQuery(""); setFound(null); setSheetError(""); setSheet(true); };

  const archived = (list || []).filter((t) => t.archived);
  const open = (list || []).filter((t) => !t.archived);
  const shown = tab === "archief" && archived.length ? archived : open;
  const team = coaches.filter((c) => c.linked && c.id !== player?.trainerId);

  return (
    <Page title="Chat" action={list && list.length > 0 ? <Button size="sm" icon={<Plus size={18} />} onClick={openSheet}>Nieuw</Button> : undefined}>
      {error && <Notice tone="danger">{error}</Notice>}
      {archived.length > 0 && <Tabs label="Gesprekken" value={tab === "archief" ? "archief" : "open"} onChange={setTab} tabs={[{ id: "open", label: "Gesprekken" }, { id: "archief", label: "Archief", count: archived.length }]} />}
      {!list ? (!error && <p role="status" className="py-10 text-center text-sm text-muted">Even laden…</p>) : shown.length === 0 ? (
        <Card pad={false}>
          {list.length === 0
            ? <Empty icon={<MessageCircle size={22} />} title="Nog geen gesprekken" text="Stuur je coach een bericht, of zoek iemand op naam." action={<Button icon={<Plus size={18} />} onClick={openSheet}>Nieuw gesprek</Button>} />
            : <Empty icon={<MessageCircle size={22} />} title="Geen open gesprekken" text="Alles zit in je archief." />}
        </Card>
      ) : (
        <List>
          {shown.map((t) => (
            <ListRow key={t.id} chevron={false} onClick={() => navigate(`/chat/${t.id}`)}
              lead={t.group ? <GroupIcon /> : <Avatar name={t.name || "?"} src={t.avatarUrl || (t.trainerId && coach(t.trainerId)?.photo) || undefined} />}
              title={t.name || "Gesprek"}
              text={t.lastBody ? `${t.lastMine ? "Jij: " : ""}${t.lastBody}` : roleText(t)}
              trail={<span className="grid shrink-0 justify-items-end gap-1"><span className="text-xs text-muted">{shortWhen(t.lastBody ? t.lastAt : null)}</span><Count n={t.unread} label={`${t.unread} nieuw`} /></span>} />
          ))}
        </List>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Nieuw gesprek">
        <Field label="Zoek op naam" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Minstens 2 letters" autoComplete="off" />
        {sheetError && <div className="mt-3"><Notice tone="danger">{sheetError}</Notice></div>}
        <div className="-mx-5 mt-3 divide-y divide-line border-t border-line">
          {found
            ? found.length
              ? found.map((p) => <ListRow key={p.userId} chevron={false} lead={<Avatar name={p.name} src={p.avatarUrl || undefined} />} title={p.name} text={roleText(p)} onClick={busy ? undefined : () => void start(() => openWithUser(p.userId))} />)
              : <p className="px-5 py-6 text-center text-sm text-muted">Niemand gevonden met die naam.</p>
            : team.length
              ? team.map((c) => <ListRow key={c.id} chevron={false} lead={<Avatar name={c.name} src={c.photo || undefined} status={c.available ? "active" : "away"} />} title={c.name} text={c.role} onClick={busy ? undefined : () => void start(() => openWithCoach(c.id))} />)
              : <p className="px-5 py-6 text-center text-sm text-muted">Typ een naam om iemand te zoeken.</p>}
        </div>
      </Sheet>
    </Page>
  );
}
