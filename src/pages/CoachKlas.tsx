// One group class, as its coach sees it: who comes, ticking people off, finishing the class, cancelling it.
import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, UsersRound } from "lucide-react";
import { Avatar, Badge, Button, Field, Notice, Sheet, Switch, Tabs } from "../ui";
import { useCoach } from "../lib/coach";
import type { CoachClass } from "../lib/coach";
import { useBooking, classSpan } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { longDay } from "../lib/dates";

type Person = { id: string; name: string; avatar: string | null; status: string; firstClass: boolean; health: { hasRisk: boolean; notes: string } | null };
type Roster = { people: Person[]; canCheck: boolean };
const PERSON: Record<string, string> = { booked: "Ingeschreven", awaiting_payment: "Wacht op betaling", attended: "Aanwezig", waitlist: "Wachtlijst", late_cancel: "Laat uitgeschreven", no_show: "Niet gekomen" };

export default function CoachKlas({ klas, onClose, onDone }: { klas: CoachClass | null; onClose: () => void; onDone: (text: string) => void }) {
  const coach = useCoach();
  const data = useBooking();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "finish" | "cancel">("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"one" | "all">("one");
  const id = klas?.id || "";
  const load = async (classId: string) => { try { setRoster(await call<Roster>("class_roster", { p_class: classId })); } catch (err) { setError(friendly(err)); } };
  useEffect(() => { setRoster(null); setError(""); setMode(""); setReason(""); setScope("one"); if (id) void load(id); }, [id]);
  const c = klas;
  const started = c ? new Date(c.startsAt) <= new Date() : false;
  const run = async (action: () => Promise<unknown>, text: string) => {
    setBusy(true); setError("");
    try { await action(); await Promise.all([coach.reload(), data.reload()]); onDone(text); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const tick = async (p: Person) => {
    setBusy(true); setError("");
    try { await call("class_mark", { p_signup: p.id, p_present: p.status !== "attended" }); await load(id); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const people = roster?.people || [];
  const coming = people.filter((p) => ["booked", "awaiting_payment", "attended"].includes(p.status));
  return (
    <Sheet open={Boolean(c)} onClose={onClose} title="Groepsles">
      {c && (<>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={c.status === "cancelled" ? "neutral" : c.status === "done" ? "neutral" : "accent"}>{c.status === "cancelled" ? "Geannuleerd" : c.status === "done" ? "Afgerond" : `${c.taken} van ${c.capacity}`}</Badge>
          {c.pending && <Badge tone="warn">Wacht op goedkeuring</Badge>}
          {c.seriesId && <span className="text-sm text-muted">wekelijks</span>}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight">{c.title}</p>
        <ul className="mt-2 grid gap-2 text-[15px] text-muted">
          <li className="flex items-center gap-2.5"><CalendarDays size={18} className="shrink-0" aria-hidden /> {longDay(c.date)}</li>
          <li className="flex items-center gap-2.5"><Clock size={18} className="shrink-0" aria-hidden /> {classSpan(c)}</li>
          <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden /> {c.location || data.pricing.place}</li>
        </ul>
        <h3 className="mt-5 mb-1 flex items-center gap-2 font-semibold"><UsersRound size={18} aria-hidden /> Wie komt</h3>
        {!roster ? <p className="text-sm text-muted">Even laden…</p>
          : !people.length ? <p className="text-sm text-muted">Nog niemand ingeschreven.</p>
          : (<>
            {roster.canCheck && coming.length > 0 && <p className="mb-1 text-sm text-muted">Vink aan wie er is; die krijgt meteen zijn XP.</p>}
            <ul className="divide-y divide-line">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={p.name} src={p.avatar || undefined} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">{PERSON[p.status] || p.status}{p.firstClass && p.status !== "waitlist" ? " · eerste les" : ""}</p>
                    {p.health?.hasRisk && <p className="mt-0.5 text-sm font-medium text-warn">Let op: {p.health.notes || "antwoordde ja op een gezondheidsvraag"}</p>}
                    {!p.health && <p className="mt-0.5 text-sm font-medium text-warn">Gezondheidsvragen nog niet ingevuld</p>}
                  </div>
                  {roster.canCheck && ["booked", "attended"].includes(p.status) && c.status === "scheduled" && <span className={busy ? "pointer-events-none opacity-60" : ""}><Switch checked={p.status === "attended"} onChange={() => void tick(p)} label={`${p.name} is aanwezig`} /></span>}
                </li>
              ))}
            </ul>
          </>)}
        <div className="mt-5 grid gap-2">
          {error && <Notice tone="danger">{error}</Notice>}
          {c.status === "scheduled" && started && (mode !== "finish"
            ? <Button block size="lg" onClick={() => setMode("finish")}>Les afronden</Button>
            : (<>
              <Notice tone="warn">Wie niet aangevinkt is, komt op "niet gekomen" te staan en wordt aangerekend. De wachtlijst vervalt.</Notice>
              <Button block size="lg" disabled={busy} onClick={() => void run(() => call("class_finish", { p_class: c.id }), `${c.title} is afgerond.`)}>{busy ? "Bezig…" : "Ja, rond af"}</Button>
              <Button variant="ghost" block onClick={() => setMode("")}>Nog niet</Button>
            </>))}
          {c.status === "scheduled" && !started && (mode !== "cancel"
            ? <Button variant="danger" block onClick={() => setMode("cancel")}>Les annuleren</Button>
            : (<>
              <Field label="Waarom? (mag leeg blijven)" maxLength={200} hint="Wie ingeschreven is, krijgt een melding met deze reden." value={reason} onChange={(e) => setReason(e.target.value)} />
              {c.seriesId && <Tabs label="Welke" value={scope} onChange={setScope} tabs={[{ id: "one", label: "Alleen deze" }, { id: "all", label: "Deze en de volgende" }]} />}
              <Button variant="danger" block disabled={busy} onClick={() => void run(() => call("class_cancel_class", { p_class: c.id, p_reason: reason.trim(), p_series: scope === "all" }), "De les is geannuleerd. Wie ingeschreven was, krijgt een melding.")}>{busy ? "Bezig…" : "Ja, annuleer"}</Button>
              <Button variant="ghost" block onClick={() => setMode("")}>Nee, laat staan</Button>
            </>))}
        </div>
      </>)}
    </Sheet>
  );
}
