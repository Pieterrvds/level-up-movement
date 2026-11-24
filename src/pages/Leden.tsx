// Everyone with an account: look someone up, see what they did, send a message or give XP.
import { useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Card, Empty, Field, Figures, List, ListRow, Notice, Page, Sheet } from "../ui";
import { useAccount } from "../lib/account";
import { useAdmin } from "../lib/admin";
import type { Member } from "../lib/admin";
import { MessageButton } from "../lib/chat";
import { levelOf } from "../lib/level";
import { call, friendly } from "../lib/supabase";

const SHOWN = 40;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }) : "nog nooit");

export default function Leden() {
  const admin = useAdmin();
  const { player } = useAccount();
  const navigate = useNavigate();
  useEffect(() => { admin.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [giving, setGiving] = useState(false);
  const [xp, setXp] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const q = query.trim().toLowerCase();
  const all = [...admin.members].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const found = q ? all.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : all;
  const open: Member | undefined = admin.members.find((m) => m.id === openId);
  const mine = open ? admin.bookings.filter((b) => b.userId === open.id) : [];
  const credits = open ? admin.packs.filter((p) => p.status === "paid" && p.email === open.email).reduce((s, p) => s + p.remaining, 0) : 0;
  const show = (m: Member) => { setError(""); setFlash(""); setGiving(false); setXp(""); setWhy(""); setOpenId(m.id); };
  const give = async () => {
    const n = Math.round(Number(xp));
    if (!n) { setError("Vul in hoeveel XP (een min-getal neemt XP af)."); return; }
    if (why.trim().length < 3) { setError("Schrijf kort waarom; het lid leest dit."); return; }
    setBusy(true); setError("");
    try { await call("admin_grant_xp", { p_user: openId, p_amount: n, p_reason: why.trim() }); await admin.reload(); setGiving(false); setFlash(`${n > 0 ? "+" : ""}${n} XP gegeven.`); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };

  return (
    <Page title="Leden" text={admin.ready ? `${admin.members.length} ${admin.members.length === 1 ? "account" : "accounts"}` : undefined}>
      <div><Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate("/meer")} className="-ml-3">Meer</Button></div>
      {admin.error && <Notice tone="danger">{admin.error}</Notice>}
      <Field label="Zoek op naam of e-mail" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" trail={<span className="grid w-10 place-items-center"><Search size={18} className="text-faint" aria-hidden /></span>} />
      {!admin.ready ? <p role="status" className="py-10 text-center text-sm text-muted">Even laden…</p> : found.length ? (<>
        <List>
          {found.slice(0, SHOWN).map((m) => (
            <ListRow key={m.id} lead={<Avatar name={m.name} src={m.avatarUrl || undefined} />} title={m.name} text={`Level ${levelOf(m.xp).level} · ${m.xp} XP`}
              trail={m.admin ? <Badge>Beheer</Badge> : m.trainerId ? <Badge tone="accent">Coach</Badge> : undefined} onClick={() => show(m)} />
          ))}
        </List>
        {found.length > SHOWN && <p className="text-center text-sm text-muted">De eerste {SHOWN} van {found.length}. Zoek op naam om iemand te vinden.</p>}
      </>) : <Card pad={false}><Empty title="Niemand gevonden" text="Probeer een ander stuk van de naam." /></Card>}

      <Sheet open={Boolean(open)} onClose={() => setOpenId("")} title="Lid">
        {open && (<div className="grid gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={open.name} src={open.avatarUrl || undefined} size={56} />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold tracking-tight">{open.name}</p>
              <p className="truncate text-sm text-muted">{open.email}</p>
            </div>
          </div>
          <Figures rows={[
            { label: "Level", value: `${levelOf(open.xp).level} · ${open.xp} XP` },
            { label: "Sessies gedaan", value: mine.filter((b) => b.status === "completed").length },
            { label: "Sessies gepland", value: mine.filter((b) => ["pending", "confirmed"].includes(b.status)).length },
            { label: "Beurten over", value: credits },
            { label: "Lid sinds", value: day(open.createdAt) },
            { label: "Laatst ingelogd", value: day(open.lastLogin) },
          ]} />
          {flash && <Notice>{flash}</Notice>}
          {giving ? (
            <div className="grid gap-3">
              <Field label="Hoeveel XP?" type="number" inputMode="numeric" placeholder="bv. 50" value={xp} onChange={(e) => setXp(e.target.value)} />
              <Field label="Waarom?" maxLength={140} placeholder="bv. Geholpen op de opendeurdag" hint="Het lid leest dit in de melding." value={why} onChange={(e) => setWhy(e.target.value)} />
              {error && <Notice tone="danger">{error}</Notice>}
              <div className="flex gap-2"><Button block disabled={busy} onClick={() => void give()}>{busy ? "Bezig…" : "Geef XP"}</Button><Button variant="ghost" block onClick={() => { setGiving(false); setError(""); }}>Terug</Button></div>
            </div>
          ) : (
            <div className="grid gap-2">
              {open.id !== player?.id && <MessageButton block user={open.id} label={`Bericht naar ${open.name.split(/\s+/)[0]}`} />}
              <Button variant="secondary" block onClick={() => { setFlash(""); setError(""); setGiving(true); }}>XP geven</Button>
            </div>
          )}
        </div>)}
      </Sheet>
    </Page>
  );
}
