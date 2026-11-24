// A group class as a client sees it: the window with what, when, where, with whom, how full it is, and the one
// thing you can do now (sign up, join the waiting list, sign out).
import { useState } from "react";
import { CalendarDays, Clock, MapPin, UsersRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Notice, Sheet } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, classSpan, euro } from "../lib/booking";
import type { GroupClass } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { longDay } from "../lib/dates";

const IN = ["booked", "awaiting_payment", "attended"];
/** where this person stands for a class, as one label */
export function classBadge(c: GroupClass): { text: string; tone: "accent" | "warn" | "neutral" | "danger" } {
  const m = c.mine?.status;
  if (c.status === "cancelled") return { text: "Geannuleerd", tone: "neutral" };
  if (m && IN.includes(m)) return { text: "Ingeschreven", tone: "accent" };
  if (m === "waitlist") return { text: `Wachtlijst #${c.mine?.waitPos || 1}`, tone: "warn" };
  if (m === "late_cancel") return { text: "Laat uitgeschreven", tone: "danger" };
  if (m === "no_show") return { text: "Niet gekomen", tone: "danger" };
  return c.taken >= c.capacity ? { text: "Volzet · wachtlijst", tone: "warn" } : { text: `${c.taken} van ${c.capacity}`, tone: "neutral" };
}
/** the classes this person is in (or waits for) that are still to come */
export const myClasses = (list: GroupClass[]) => list.filter((c) => c.status === "scheduled" && c.mine && ["booked", "awaiting_payment", "waitlist"].includes(c.mine.status) && new Date(c.endsAt) > new Date());

export default function KlasVenster({ klas, onClose, onDone }: { klas: GroupClass | null; onClose: () => void; onDone: (text: string) => void }) {
  const { player } = useAccount();
  const data = useBooking();
  const navigate = useNavigate();
  const here = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sure, setSure] = useState(false);
  const close = () => { setError(""); setSure(false); onClose(); };
  const run = async (action: () => Promise<unknown>, text: (r: unknown) => string) => {
    setBusy(true); setError("");
    try { const r = await action(); await data.reload(); setSure(false); onDone(text(r)); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const c = klas;
  const names = c ? [c.trainerId, ...c.coTrainers].map((id) => data.coach(id)?.short).filter(Boolean).join(" en ") : "";
  const m = c?.mine?.status;
  const started = c ? new Date(c.startsAt) <= new Date() : false;
  const full = c ? c.taken >= c.capacity : false;
  const mineTeach = c ? [c.trainerId, ...c.coTrainers].includes(player?.trainerId || "-") : false;
  const late = c ? c.price > 0 && new Date(c.freeCancelUntil) < new Date() : false;
  const badge = c ? classBadge(c) : null;
  return (
    <Sheet open={Boolean(c)} onClose={close} title="Groepsles">
      {c && badge && (<>
        <Badge tone={badge.tone}>{badge.text}</Badge>
        <p className="mt-3 text-2xl font-semibold tracking-tight">{c.title}{names ? ` met ${names}` : ""}</p>
        <ul className="mt-3 grid gap-2 text-[15px] text-muted">
          <li className="flex items-center gap-2.5"><CalendarDays size={18} className="shrink-0" aria-hidden /> {longDay(c.date)}</li>
          <li className="flex items-center gap-2.5"><Clock size={18} className="shrink-0" aria-hidden /> {classSpan(c)}</li>
          <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden /> {c.location || data.pricing.place}</li>
          <li className="flex items-center gap-2.5"><UsersRound size={18} className="shrink-0" aria-hidden /> {c.taken} van {c.capacity} plaatsen bezet{c.waitlist ? ` · ${c.waitlist} op de wachtlijst` : ""}</li>
        </ul>
        {c.note && <p className="mt-3 text-[15px]">{c.note}</p>}
        <div className="mt-4 flex items-baseline justify-between gap-3 rounded-field bg-sunken px-4 py-3">
          <span className="font-semibold">{c.price > 0 ? euro(c.price) : "Gratis"}</span>
          <span className="text-right text-sm text-muted">{c.price > 0 ? "Betalen doe je ter plaatse." : ""}</span>
        </div>
        <div className="mt-5 grid gap-2">
          {error && <Notice tone="danger">{error}</Notice>}
          {c.status === "cancelled" ? <Notice tone="warn">{`Deze les gaat niet door.${c.cancelReason ? ` ${c.cancelReason}` : ""}`}</Notice>
            : started ? <Notice>Deze les is al begonnen.</Notice>
            : mineTeach ? <Notice>Je geeft deze les zelf.</Notice>
            : m === "late_cancel" || m === "no_show" ? <Notice tone="warn">Je schreef je te laat uit voor deze les; opnieuw inschrijven kan niet.</Notice>
            : m && IN.includes(m) ? (!sure
              ? <Button variant="danger" block onClick={() => setSure(true)}>Uitschrijven</Button>
              : (<>
                <Notice tone={late ? "danger" : "warn"}>{late ? "Gratis uitschrijven kan niet meer: het is te kort voor de start. De les wordt aangerekend." : "Weet je het zeker? Je plaats gaat naar de volgende op de wachtlijst."}</Notice>
                <Button variant="danger" block disabled={busy} onClick={() => void run(() => call("class_cancel", { p_signup: c.mine!.id }), (r) => ((r as { late?: boolean })?.late ? "Uitgeschreven. Omdat het zo kort voor de start was, wordt de les aangerekend." : "Je bent uitgeschreven."))}>{busy ? "Bezig…" : "Ja, schrijf me uit"}</Button>
                <Button variant="ghost" block onClick={() => setSure(false)}>Nee, ik kom</Button>
              </>))
            : m === "waitlist" ? <Button variant="secondary" block disabled={busy} onClick={() => void run(() => call("class_cancel", { p_signup: c.mine!.id }), () => "Je staat niet meer op de wachtlijst.")}>Haal me van de wachtlijst</Button>
            : !player?.healthForm?.valid ? (<>
              <Notice>Eerst acht korte gezondheidsvragen, één keer per jaar.</Notice>
              <Button block size="lg" onClick={() => navigate(`/gezondheid?terug=${encodeURIComponent(here.pathname + here.search)}`)}>Naar de gezondheidsvragen</Button>
            </>)
            : <Button block size="lg" disabled={busy} onClick={() => void run(() => call("class_signup", { p_class: c.id, p_pay: "in_person" }), (r) => ((r as GroupClass)?.mine?.status === "waitlist" ? "Je staat op de wachtlijst. Komt er een plaats vrij, dan krijg je een melding." : "Je bent ingeschreven. Tot dan!"))}>{busy ? "Bezig…" : full ? "Zet me op de wachtlijst" : "Schrijf me in"}</Button>}
        </div>
      </>)}
    </Sheet>
  );
}
