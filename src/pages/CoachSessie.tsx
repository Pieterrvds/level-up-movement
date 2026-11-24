// One session, as its coach sees it, in a window: who, what, when, where, what the client wrote, the health
// answers that matter, and what the coach can do now (answer, move, finish).
import { useState } from "react";
import { CalendarDays, Clock, MapPin, MessageSquareText, Repeat } from "lucide-react";
import { Avatar, Badge, Button, Field, Notice, Select, Sheet, Tabs } from "../ui";
import type { CoachBooking } from "../lib/coach";
import { useCoach } from "../lib/coach";
import { useBooking, NO_KIND, euro } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { MessageButton } from "../lib/chat";
import { dateKey, hourSpan, hourText, longDay, slotStart } from "../lib/dates";
import { STATUS } from "./Sessies";
import { QUESTIONS } from "./Gezondheid";

export default function CoachSessie({ booking, onClose, onDone }: { booking: CoachBooking | null; onClose: () => void; onDone: (text: string) => void }) {
  const coach = useCoach();
  const data = useBooking();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [scope, setScope] = useState<"once" | "series">("once");
  const close = () => { setError(""); setMoving(false); setDay(""); setHour(""); setScope("once"); onClose(); };
  const run = async (action: () => Promise<unknown>, text: string) => {
    setBusy(true); setError("");
    try { await action(); await Promise.all([coach.reload(), data.reload()]); setMoving(false); setDay(""); setHour(""); onDone(text); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const b = booking;
  const now = new Date();
  const begun = b ? slotStart(b.date, b.hour) <= now : false;
  const dayReached = b ? b.date <= dateKey(now) : false;
  const weekly = Boolean(b?.series && b.series.status !== "ended");
  const asksWeekly = b?.series?.status === "requested";
  const first = (b?.name || "").trim().split(/\s+/)[0] || "De klant";
  const yes = b?.health ? QUESTIONS.filter(([k]) => b.health!.answers?.[k]).map(([, q]) => q) : [];
  return (
    <Sheet open={Boolean(b)} onClose={close} title="Sessie">
      {b && (<>
        <div className="flex items-center gap-3">
          <Avatar name={b.name} src={b.avatar || undefined} size={48} />
          <div className="min-w-0 flex-1"><p className="truncate text-lg font-semibold">{b.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2"><Badge tone={STATUS[b.status]?.tone || "neutral"}>{STATUS[b.status]?.text || b.status}</Badge>
              {weekly && <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Repeat size={15} aria-hidden /> wekelijks</span>}</div></div>
        </div>
        <p className="mt-4 text-xl font-semibold tracking-tight">{b.what || NO_KIND}</p>
        <ul className="mt-2 grid gap-2 text-[15px] text-muted">
          <li className="flex items-center gap-2.5"><CalendarDays size={18} className="shrink-0" aria-hidden /> {longDay(b.date)}</li>
          <li className="flex items-center gap-2.5"><Clock size={18} className="shrink-0" aria-hidden /> {hourSpan(b.hour)}</li>
          <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden /> {b.place || data.pricing.place}</li>
          {b.note && <li className="flex items-start gap-2.5"><MessageSquareText size={18} className="mt-0.5 shrink-0" aria-hidden /> <span className="text-ink">“{b.note}”</span></li>}
        </ul>
        <div className="mt-4 flex items-baseline justify-between gap-3 rounded-field bg-sunken px-4 py-3">
          <span className="font-semibold">{b.price > 0 ? euro(b.price) : "Gratis"}</span>
          <span className="text-right text-sm text-muted">{b.price <= 0 ? "" : b.payStatus === "paid" ? "Betaald" : "Betaalt ter plaatse"}</span>
        </div>
        <div className="mt-3">
          {!b.health ? <Notice tone="warn">{first} heeft de gezondheidsvragen nog niet ingevuld.</Notice>
            : b.health.hasRisk ? <Notice tone="warn"><span className="block font-semibold">Let op: {first} antwoordde ja</span>{yes.map((q) => <span key={q} className="mt-1 block font-normal">• {q}</span>)}{b.health.notes && <span className="mt-2 block font-normal text-ink">“{b.health.notes}”</span>}</Notice>
            : null}
        </div>
        <div className="mt-5 grid gap-2">
          {error && <Notice tone="danger">{error}</Notice>}
          {b.status === "pending" && !begun && (<>
            {asksWeekly && <Notice>{first} vraagt dit uur elke week. Je antwoord geldt voor alle weken.</Notice>}
            <Button block size="lg" disabled={busy} onClick={() => void run(() => call("respond_booking", { p_id: b.id, p_accept: true }), `Bevestigd. ${first} krijgt een melding.`)}>{asksWeekly ? "Bevestig elke week" : "Bevestigen"}</Button>
            <Button variant="danger" block disabled={busy} onClick={() => void run(() => call("respond_booking", { p_id: b.id, p_accept: false }), `Geweigerd. ${first} krijgt een melding en het uur is weer vrij.`)}>Weigeren</Button>
          </>)}
          {b.status === "confirmed" && dayReached && (<>
            <Button block size="lg" disabled={busy} onClick={() => void run(() => call("reward_session", { p_id: b.id }), `Afgerond. ${first} krijgt XP.`)}>Afgerond</Button>
            {begun && <Button variant="danger" block disabled={busy} onClick={() => void run(() => call("mark_no_show", { p_id: b.id }), `${first} staat op "niet gekomen". De sessie wordt aangerekend.`)}>Niet gekomen</Button>}
          </>)}
          {!moving && <MessageButton block user={b.userId} label={`Bericht naar ${first}`} />}
          {["pending", "confirmed"].includes(b.status) && !begun && !moving && <Button variant="secondary" block onClick={() => { setError(""); setMoving(true); setDay(b.date); setHour(String(b.hour)); }}>Verplaatsen</Button>}
          {moving && (
            <div className="grid gap-3 rounded-field border border-line p-4">
              <p className="font-semibold">Naar wanneer?</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dag" type="date" min={dateKey(now)} value={day} onChange={(e) => setDay(e.target.value)} />
                <Select label="Uur" value={hour} onChange={(e) => setHour(e.target.value)}>{Array.from({ length: 18 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</Select>
              </div>
              {weekly && <Tabs label="Welke" value={scope} onChange={setScope} tabs={[{ id: "once", label: "Alleen deze" }, { id: "series", label: "Elke week" }]} />}
              <div className="flex gap-2">
                <Button block disabled={busy || !day || !hour} onClick={() => void run(() => call("move_booking", { p_id: b.id, p_day: day, p_hour: Number(hour), p_scope: scope }), `Verplaatst. ${first} krijgt een melding.`)}>Verplaats</Button>
                <Button variant="ghost" block onClick={() => setMoving(false)}>Terug</Button>
              </div>
            </div>
          )}
        </div>
      </>)}
    </Sheet>
  );
}
