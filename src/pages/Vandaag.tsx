// The coach's start screen: am I bookable, what waits for me, what does today look like.
import { useEffect, useState } from "react";
import { CalendarCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Badge, Button, Card, Empty, List, ListRow, Notice, Page, Stat, Switch } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, NO_KIND, euro } from "../lib/booking";
import { useCoach, todo } from "../lib/coach";
import type { CoachBooking } from "../lib/coach";
import { call, friendly } from "../lib/supabase";
import { dateKey, everyWeekday, hourText, isoWeekday, shortDay } from "../lib/dates";
import CoachSessie from "./CoachSessie";
import CoachKlas from "./CoachKlas";

const today = () => { const t = new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }); return t[0].toUpperCase() + t.slice(1); };
const firstName = (name: string) => name.trim().split(/\s+/)[0];

export default function Vandaag() {
  const { player } = useAccount();
  const data = useBooking();
  const coach = useCoach();
  const [openId, setOpenId] = useState("");
  const [flash, setFlash] = useState("");
  useEffect(() => { coach.refresh(); data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const me = data.coach(player?.trainerId || "");
  const on = me?.available !== false;
  const { requests, finish } = todo(coach.bookings);
  const key = dateKey(new Date());
  const day = coach.bookings.filter((b) => b.date === key && ["pending", "confirmed", "completed"].includes(b.status)).sort((a, b) => a.hour - b.hour);
  const open = coach.bookings.find((b) => b.id === openId) || null;
  // group classes: the ones that started and still have to be finished, and the ones of today
  const [classId, setClassId] = useState("");
  const toFinish = coach.classes.filter((c) => c.canFinish);
  const dayClasses = coach.classes.filter((c) => c.date === key && c.status !== "cancelled");
  const todoCount = requests.length + finish.length + toFinish.length;
  const flip = async (next: boolean) => {
    setBusy(true); setError("");
    try { await call("set_trainer_available", { p_trainer: player?.trainerId, p_on: next }); await data.reload(); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const what = (b: CoachBooking) => b.what || NO_KIND;
  return (
    <Page title="Vandaag" text={today()}>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{on ? "Je bent actief" : "Je bent afwezig"}</p>
            <p className="text-sm text-muted">{on ? "Klanten kunnen je boeken." : "Niemand kan je nu boeken. Wat gepland is, blijft."}</p>
          </div>
          <span className={busy ? "pointer-events-none opacity-60" : ""}><Switch checked={on} onChange={(v) => void flip(v)} label="Actief of afwezig" /></span>
        </div>
      </Card>
      {flash && <Notice>{flash}</Notice>}
      {(error || coach.error) && <Notice tone="danger">{error || coach.error}</Notice>}
      <div className="grid grid-cols-3 gap-2">
        <Stat value={todoCount} label="te doen" /><Stat value={day.filter((b) => b.status !== "completed").length + dayClasses.filter((c) => c.status === "scheduled").length} label="vandaag" /><Stat value={euro(coach.earnings?.owed || 0)} label="tegoed" />
      </div>
      <div>
        <h2 className="mb-2 px-1 text-lg font-semibold">Te doen</h2>
        {todoCount ? (
          <List>
            {toFinish.map((c) => (
              <ListRow key={c.id} lead={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink"><UsersRound size={20} /></span>} title={`${c.title}: les afronden`}
                text={`${shortDay(c.date)} · ${c.time} · ${c.taken} van ${c.capacity}`} below={<Badge tone="warn">Afronden</Badge>} onClick={() => { setFlash(""); setClassId(c.id); }} />
            ))}
            {requests.map((b) => (
              <ListRow key={b.id} lead={<Avatar name={b.name} src={b.avatar || undefined} />}
                title={b.series?.status === "requested" ? `${firstName(b.name)} vraagt een wekelijkse sessie` : `${firstName(b.name)} vraagt een sessie`}
                text={b.series?.status === "requested" ? `${everyWeekday(isoWeekday(b.date))} · ${hourText(b.hour)} · ${what(b)}` : `${shortDay(b.date)} · ${hourText(b.hour)} · ${what(b)}`}
                below={<Badge tone="warn">Bevestigen</Badge>} onClick={() => { setFlash(""); setOpenId(b.id); }} />
            ))}
            {finish.map((b) => (
              <ListRow key={b.id} lead={<Avatar name={b.name} src={b.avatar || undefined} />} title={`${firstName(b.name)}: sessie afronden`}
                text={`${shortDay(b.date)} · ${hourText(b.hour)} · ${what(b)}`} below={<Badge tone="warn">Afronden</Badge>} onClick={() => { setFlash(""); setOpenId(b.id); }} />
            ))}
          </List>
        ) : <Card pad={false}><Empty icon={<CalendarCheck size={22} />} title="Alles is gedaan" text="Nieuwe aanvragen en sessies om af te ronden komen hier." /></Card>}
      </div>
      <div>
        <h2 className="mb-2 px-1 text-lg font-semibold">Je dag</h2>
        {day.length + dayClasses.length ? (
          <List>
            {dayClasses.map((c) => (
              <ListRow key={c.id} lead={<span className="w-12 shrink-0 text-center font-semibold">{c.time}</span>} title={`${c.title} · groepsles`} text={`${c.taken} van ${c.capacity} · ${c.location || data.pricing.place}`} wrap
                trail={c.status === "done" ? <Badge>Afgerond</Badge> : undefined} onClick={() => { setFlash(""); setClassId(c.id); }} />
            ))}
            {day.map((b) => (
              <ListRow key={b.id} lead={<span className="w-12 shrink-0 text-center font-semibold">{hourText(b.hour)}</span>} title={b.name} text={`${what(b)} · ${b.place || data.pricing.place}`} wrap
                trail={b.status === "completed" ? <Badge>Afgerond</Badge> : b.status === "pending" ? <Badge tone="warn">Aanvraag</Badge> : undefined} onClick={() => { setFlash(""); setOpenId(b.id); }} />
            ))}
          </List>
        ) : <Card pad={false}><Empty title="Vandaag geen sessies" action={<Link to="/agenda" className="contents"><Button variant="secondary">Naar je agenda</Button></Link>} /></Card>}
      </div>
      <CoachSessie booking={open} onClose={() => setOpenId("")} onDone={(text) => { setOpenId(""); setFlash(text); }} />
      <CoachKlas klas={coach.classes.find((c) => c.id === classId) || null} onClose={() => setClassId("")} onDone={(text) => { setClassId(""); setFlash(text); }} />
    </Page>
  );
}
