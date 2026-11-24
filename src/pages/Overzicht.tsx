// The admin's start: what waits on him (kinds to approve, applications, packs to be paid, money to give back),
// three numbers, the money that is open, and what the coaches changed themselves.
import { useEffect, useState } from "react";
import { ClipboardCheck, HandCoins, Sparkles, Ticket, Undo2, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Badge, Button, Card, CardHead, Empty, Field, Figures, List, ListRow, Notice, Page, Select, Sheet, Stat, TextArea } from "../ui";
import { useBooking, euro } from "../lib/booking";
import { useAdmin, adminTodo, logDetail, logTitle, owedTo, thisWeek, toCollect } from "../lib/admin";
import type { AdminPack, Application, Kind } from "../lib/admin";
import { call, friendly } from "../lib/supabase";
import { hourText, shortDay } from "../lib/dates";
import { shortWhen } from "../lib/chat";

const Icon = ({ children }: { children: ReactNode }) => <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken text-muted">{children}</span>;
const WEEKDAY = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
type Refund = { id: string; name: string; price: number; kind: "session" | "class" };
type Open = { kind: Kind } | { application: Application } | { pack: AdminPack } | { refund: Refund } | null;

export default function Overzicht() {
  const admin = useAdmin();
  const data = useBooking();
  const navigate = useNavigate();
  useEffect(() => { admin.refresh(); data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [card, setCard] = useState("");

  const todo = adminTodo(admin);
  const coachName = (id: string | null) => (id && data.coach(id)?.short) || "een coach";
  const collect = admin.bookings.filter(toCollect).reduce((s, b) => s + b.price, 0) + todo.packs.reduce((s, p) => s + p.price, 0);
  const payOut = data.coaches.reduce((s, c) => s + owedTo(admin, c.id).amount, 0);
  const show = (o: Open) => { setError(""); setFlash(""); setDeclining(false); setReason(""); setCard(""); setTitle(o && "kind" in o ? o.kind.title : ""); setOpen(o); };
  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true); setError("");
    try { await action(); await Promise.all([admin.reload(), data.reload()]); setOpen(null); setFlash(ok); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const seen = async () => { try { await call("admin_coach_log", { p_seen: true }); await admin.reload(); } catch (err) { setError(friendly(err)); } };

  if (!admin.ready) return <Page title="Overzicht"><p role="status" className="py-10 text-center text-sm text-muted">Even laden…</p></Page>;
  const kind = open && "kind" in open ? open.kind : null;
  const app = open && "application" in open ? open.application : null;
  const pack = open && "pack" in open ? open.pack : null;
  const refund = open && "refund" in open ? open.refund : null;
  return (
    <Page title="Overzicht" text="Wat op je wacht en hoe het loopt.">
      {flash && <Notice>{flash}</Notice>}
      {(admin.error || (error && !open)) && <Notice tone="danger">{admin.error || error}</Notice>}
      <div className="grid grid-cols-3 gap-2">
        <Stat value={todo.count} label="te doen" /><Stat value={admin.members.length} label="leden" /><Stat value={thisWeek(admin)} label="deze week" />
      </div>

      <div>
        <h2 className="mb-2 px-1 text-lg font-semibold">Te doen</h2>
        {todo.count ? (
          <List>
            {todo.kinds.map((k) => (
              <ListRow key={k.key} wrap lead={<Icon><Sparkles size={20} /></Icon>} title={`Nieuwe soort: ${k.title}`} text={`Voorgesteld door ${coachName(k.trainerId)}`} below={<Badge tone="warn">Goedkeuren</Badge>} onClick={() => show({ kind: k })} />
            ))}
            {todo.applications.map((a) => (
              <ListRow key={a.id} wrap lead={<Icon><UserPlus size={20} /></Icon>} title={`${a.name} wil coach worden`} text={a.role || "Geen titel opgegeven"} below={<Badge tone="warn">Sollicitatie</Badge>} onClick={() => show({ application: a })} />
            ))}
            {todo.packs.map((p) => (
              <ListRow key={p.id} wrap lead={<Icon><Ticket size={20} /></Icon>} title={`${p.name}: pakket van ${p.size} sessies`} text="Wacht op betaling ter plaatse" trail={<span className="font-semibold whitespace-nowrap tabular-nums">{euro(p.price)}</span>} onClick={() => show({ pack: p })} />
            ))}
            {todo.refunds.map((r) => (
              <ListRow key={r.id} wrap lead={<Icon><Undo2 size={20} /></Icon>} title={`Geld terug voor ${r.name}`} text={r.kind === "class" ? "Groepsles, ter plaatse betaald" : "Sessie, ter plaatse betaald"} trail={<span className="font-semibold whitespace-nowrap tabular-nums">{euro(r.price)}</span>} onClick={() => show({ refund: r })} />
            ))}
          </List>
        ) : <Card pad={false}><Empty icon={<ClipboardCheck size={22} />} title="Alles is gedaan" text="Nieuwe soorten, sollicitaties en pakketten die op je wachten, komen hier." /></Card>}
      </div>

      <Card>
        <CardHead title="Geld" hint="Wat ter plaatse nog betaald moet worden en wat de coaches van je krijgen." />
        <Figures rows={[{ label: "Te ontvangen", value: euro(collect), strong: true }, { label: "Uit te betalen aan coaches", value: euro(payOut) }]} />
        <div className="mt-4"><Button variant="secondary" icon={<HandCoins size={18} />} onClick={() => navigate("/betalingen")}>Naar betalingen</Button></div>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 className="text-lg font-semibold">Wijzigingen van coaches</h2>
          {admin.logUnread > 0 && <Button variant="ghost" size="sm" onClick={() => void seen()}>Alles gezien</Button>}
        </div>
        {admin.log.length ? (
          <List>
            {admin.log.slice(0, 8).map((l) => (
              <ListRow key={l.id} wrap title={`${coachName(l.trainerId)}: ${logTitle(l.title)}`} text={logDetail(l.detail)}
                trail={<span className="grid shrink-0 justify-items-end gap-1"><span className="text-xs text-muted">{shortWhen(l.at)}</span>{l.unread && <Badge tone="accent">nieuw</Badge>}</span>} />
            ))}
          </List>
        ) : <Card pad={false}><Empty title="Nog geen wijzigingen" text="Wat coaches zelf aanpassen (uren, lessen, afwezig), zie je hier." /></Card>}
      </div>

      <Sheet open={Boolean(kind)} onClose={() => setOpen(null)} title="Nieuwe soort">
        {kind && (<div className="grid gap-4">
          <p className="text-muted">{coachName(kind.trainerId)} wil dit geven. Tot je goedkeurt, zien klanten de uren en lessen niet.</p>
          {kind.description && <p className="rounded-field bg-sunken px-4 py-3 text-[15px]">{kind.description}</p>}
          <ul className="grid gap-1 text-sm text-muted">
            {kind.hours.map((h, i) => <li key={`h${i}`}>Sessies: {h.date ? shortDay(h.date) : `elke ${WEEKDAY[h.weekday ?? 0]}`} · {hourText(h.start)} – {h.end === 24 ? "24:00" : hourText(h.end)}</li>)}
            {kind.classes.map((c) => <li key={c.id}>Groepsles: {shortDay(c.date)} · {c.time}{c.weekly ? " · wekelijks" : ""}</li>)}
          </ul>
          {declining
            ? <TextArea label="Waarom niet? (de coach leest dit)" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
            : <Field label="Naam" maxLength={40} hint="Je kan de naam nog aanpassen voor je goedkeurt." value={title} onChange={(e) => setTitle(e.target.value)} />}
          {error && <Notice tone="danger">{error}</Notice>}
          {declining ? (
            <div className="grid gap-2">
              <Button variant="danger" block disabled={busy} onClick={() => void run(() => call("admin_kind_decide", { p_key: kind.key, p_approve: false, p_title: null, p_reason: reason.trim() }), `"${kind.title}" is geweigerd. De uren en lessen zijn weg; de coach krijgt een melding.`)}>Ja, weiger</Button>
              <Button variant="ghost" block onClick={() => setDeclining(false)}>Terug</Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Button block size="lg" disabled={busy} onClick={() => void run(() => call("admin_kind_decide", { p_key: kind.key, p_approve: true, p_title: title.trim() || null }), `"${title.trim() || kind.title}" is goedgekeurd. Klanten kunnen het nu boeken.`)}>{busy ? "Bezig…" : "Goedkeuren"}</Button>
              <Button variant="danger" block onClick={() => { setError(""); setDeclining(true); }}>Weigeren</Button>
            </div>
          )}
        </div>)}
      </Sheet>

      <Sheet open={Boolean(app)} onClose={() => setOpen(null)} title="Sollicitatie">
        {app && (<div className="grid gap-4">
          <div>
            <p className="text-2xl font-semibold tracking-tight">{app.name}</p>
            <p className="text-muted">{app.email}</p>
          </div>
          <Figures rows={[{ label: "Titel", value: app.role || "–" }, { label: "Geeft", value: <span className="whitespace-normal">{app.specialties || "–"}</span> }]} />
          {app.bio && <p className="rounded-field bg-sunken px-4 py-3 text-[15px]">{app.bio}</p>}
          {admin.unlinked.length > 0 && (
            <Select label="Kaart" value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="">Nieuwe kaart maken</option>
              {admin.unlinked.map((id) => <option key={id} value={id}>Koppel aan de kaart van {data.coach(id)?.name || id}</option>)}
            </Select>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="grid gap-2">
            <Button block size="lg" disabled={busy} onClick={() => void run(() => call("review_trainer_application", { p_id: app.id, p_approve: true, p_trainer: card || null }), `${app.name} is nu coach en krijgt een melding.`)}>{busy ? "Bezig…" : "Goedkeuren"}</Button>
            <Button variant="danger" block disabled={busy} onClick={() => void run(() => call("review_trainer_application", { p_id: app.id, p_approve: false, p_trainer: null }), `De sollicitatie van ${app.name} is geweigerd.`)}>Weigeren</Button>
          </div>
        </div>)}
      </Sheet>

      <Sheet open={Boolean(pack)} onClose={() => setOpen(null)} title="Pakket">
        {pack && (<div className="grid gap-4">
          <p className="text-2xl font-semibold tracking-tight">{pack.name}</p>
          <Figures rows={[{ label: `Pakket van ${pack.size} sessies`, value: euro(pack.price), strong: true }]} />
          <p className="text-muted">Heeft {pack.name} ter plaatse betaald? Daarna staan de beurten klaar.</p>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="grid gap-2">
            <Button block size="lg" disabled={busy} onClick={() => void run(() => call("mark_pack_paid", { p_id: pack.id }), `Betaald. ${pack.name} heeft nu ${pack.size} beurten.`)}>{busy ? "Bezig…" : "Ja, betaald"}</Button>
            <Button variant="ghost" block disabled={busy} onClick={() => void run(() => call("cancel_pack_request", { p_id: pack.id }), `De aanvraag van ${pack.name} is geannuleerd.`)}>Aanvraag annuleren</Button>
          </div>
        </div>)}
      </Sheet>

      <Sheet open={Boolean(refund)} onClose={() => setOpen(null)} title="Geld teruggeven">
        {refund && (<div className="grid gap-4">
          <Figures rows={[{ label: refund.name, value: euro(refund.price), strong: true }]} />
          <p className="text-muted">{refund.name} betaalde ter plaatse en krijgt dit terug. Tik pas als je het geld gegeven hebt.</p>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button block size="lg" disabled={busy} onClick={() => void run(() => call(refund.kind === "class" ? "class_mark_refunded" : "mark_refunded", refund.kind === "class" ? { p_signup: refund.id } : { p_id: refund.id }), `Genoteerd: ${refund.name} kreeg ${euro(refund.price)} terug.`)}>{busy ? "Bezig…" : "Ja, teruggegeven"}</Button>
        </div>)}
      </Sheet>
    </Page>
  );
}
