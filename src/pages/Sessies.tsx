// My sessions: what is coming and what is behind me. A session opens in a window: put it in my calendar, or
// cancel it. Moving a session is the coach's job on the server; a client cancels and books another hour.
import { useState } from "react";
import { ArrowLeft, CalendarDays, CalendarPlus, Clock, MapPin, Repeat } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, Card, Empty, List, ListRow, Notice, Page, Sheet, Tabs } from "../ui";
import { useAccount } from "../lib/account";
import type { Booking, Series } from "../lib/account";
import { useBooking, NO_KIND, euro } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { calendarFile, everyWeekday, hourSpan, hourText, longDay, shortDay, slotStart } from "../lib/dates";
import { upcoming } from "./Start";

export const STATUS: Record<string, { text: string; tone: "accent" | "warn" | "neutral" | "danger" }> = {
  confirmed: { text: "Bevestigd", tone: "accent" }, pending: { text: "Wacht op bevestiging", tone: "warn" }, awaiting_payment: { text: "Wacht op betaling", tone: "warn" },
  completed: { text: "Afgerond", tone: "neutral" }, no_show: { text: "Niet gekomen", tone: "danger" }, late_cancel: { text: "Laat geannuleerd", tone: "danger" },
  cancelled: { text: "Geannuleerd", tone: "neutral" }, declined: { text: "Niet aanvaard", tone: "neutral" }, expired: { text: "Verlopen", tone: "neutral" },
};

export default function Sessies() {
  const { player, reload, role } = useAccount();
  const home = role === "admin" ? "/meer" : "/profiel"; // the admin's last button is "Meer"
  const data = useBooking();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"komend" | "voorbij">("komend");
  const [openId, setOpenId] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const all = player?.bookings || [];
  const next = upcoming(all);
  const past = all.filter((b) => !next.includes(b)).sort((a, b) => slotStart(b.date, b.hour).getTime() - slotStart(a.date, a.hour).getTime()).slice(0, 30);
  const weekly = (player?.series || []).filter((s) => s.status !== "ended");
  const open = all.find((b) => b.id === openId) || null;
  const coachOf = (id: string) => data.coach(id)?.short || "je coach";
  const title = (b: Booking) => `${b.what || NO_KIND} met ${coachOf(b.trainerId)}`;
  const late = (b: Booking) => b.status === "confirmed" && Boolean(b.freeCancelUntil) && new Date(b.freeCancelUntil!) < new Date();
  const close = () => { setOpenId(""); setSure(false); setError(""); };
  const after = async (text: string) => { await Promise.all([reload(), data.reload()]); close(); setFlash(text); };

  const cancel = async (b: Booking) => {
    setBusy(true); setError("");
    try {
      const r = await call<{ late?: boolean }>("cancel_booking", { p_id: b.id });
      await after(r?.late ? "Geannuleerd. Omdat het zo kort voor de start was, wordt de sessie aangerekend." : "Je sessie is geannuleerd.");
    } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const stop = async (s: Series) => {
    setBusy(true); setError("");
    try { await call("series_stop", { p_series: s.id }); await after("Je wekelijkse sessie is gestopt. De komende weken zijn vrijgegeven."); } catch (err) { setFlash(""); setError(friendly(err)); }
    setBusy(false);
  };
  const row = (b: Booking) => (
    <ListRow key={b.id} lead={<span className="w-[4.5rem] shrink-0 text-sm leading-tight"><span className="block font-semibold">{shortDay(b.date)}</span><span className="text-muted">{hourText(b.hour)}</span></span>}
      title={title(b)} text={b.place || data.pricing.place} below={<Badge tone={STATUS[b.status]?.tone || "neutral"}>{STATUS[b.status]?.text || b.status}</Badge>}
      onClick={() => { setFlash(""); setOpenId(b.id); }} />
  );

  return (
    <Page title="Mijn sessies">
      <div><Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate(home)} className="-ml-3">{role === "admin" ? "Meer" : "Profiel"}</Button></div>
      {flash && <Notice>{flash}</Notice>}
      {error && !open && <Notice tone="danger">{error}</Notice>}
      <Tabs label="Sessies" value={tab} onChange={setTab} tabs={[{ id: "komend", label: "Komend", count: next.length || undefined }, { id: "voorbij", label: "Voorbij" }]} />
      {tab === "komend" && weekly.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink"><Repeat size={20} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Wekelijks met {coachOf(s.trainerId)}</p>
              <p className="text-sm text-muted">{everyWeekday(s.weekday)} om {hourText(s.hour)} · {s.status === "requested" ? "wacht op bevestiging" : `${s.upcoming} gepland`}</p>
              <div className="mt-3"><Button variant="secondary" size="sm" disabled={busy} onClick={() => void stop(s)}>Stoppen</Button></div>
            </div>
          </div>
        </Card>
      ))}
      {tab === "komend" && (next.length ? <List>{next.map(row)}</List>
        : <Card pad={false}><Empty icon={<CalendarDays size={22} />} title="Geen sessies gepland" text="Kies een coach en een uur." action={<Link to="/boeken" className="contents"><Button>Naar boeken</Button></Link>} /></Card>)}
      {tab === "voorbij" && (past.length ? <List>{past.map(row)}</List>
        : <Card pad={false}><Empty title="Nog niets achter de rug" text="Hier komen je afgeronde sessies." /></Card>)}

      <Sheet open={Boolean(open)} onClose={close} title="Sessie">
        {open && (<>
          <div className="flex items-center justify-between gap-3">
            <Badge tone={STATUS[open.status]?.tone || "neutral"}>{STATUS[open.status]?.text || open.status}</Badge>
            {open.series && open.series.status !== "ended" && <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Repeat size={15} aria-hidden /> wekelijks</span>}
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{title(open)}</p>
          <ul className="mt-3 grid gap-2 text-[15px] text-muted">
            <li className="flex items-center gap-2.5"><CalendarDays size={18} className="shrink-0" aria-hidden /> {longDay(open.date)}</li>
            <li className="flex items-center gap-2.5"><Clock size={18} className="shrink-0" aria-hidden /> {hourSpan(open.hour)}</li>
            <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden /> {open.place || data.pricing.place}</li>
          </ul>
          <div className="mt-4 flex items-baseline justify-between gap-3 rounded-field bg-sunken px-4 py-3">
            <span className="font-semibold">{open.price > 0 ? euro(open.price) : "Gratis"}</span>
            <span className="text-right text-sm text-muted">{open.price <= 0 ? "" : open.payStatus === "paid" ? "Betaald" : "Betalen doe je ter plaatse."}</span>
          </div>
          {next.includes(open) && (
            <div className="mt-5 grid gap-2">
              {error && <Notice tone="danger">{error}</Notice>}
              {!sure ? (<>
                <Button variant="secondary" block icon={<CalendarPlus size={18} />} onClick={() => calendarFile(open.id, title(open), open.place || data.pricing.place, open.date, open.hour)}>Zet in mijn agenda</Button>
                <Button variant="danger" block onClick={() => setSure(true)}>Annuleren</Button>
                <p className="text-sm text-muted">Een ander uur? Annuleer en boek opnieuw. Je coach kan een sessie ook voor jou verplaatsen.</p>
              </>) : (<>
                <Notice tone={late(open) ? "danger" : "warn"}>{late(open)
                  ? "Gratis annuleren kan niet meer: het is te kort voor de start. De sessie wordt aangerekend."
                  : "Weet je het zeker? Het uur komt weer vrij voor iemand anders."}</Notice>
                <Button variant="danger" block disabled={busy} onClick={() => void cancel(open)}>{busy ? "Bezig…" : "Ja, annuleer deze sessie"}</Button>
                <Button variant="ghost" block onClick={() => setSure(false)}>Nee, laat staan</Button>
              </>)}
            </div>
          )}
        </>)}
      </Sheet>
    </Page>
  );
}
