// The coach's agenda: the sessions that are coming, day by day, and the hours he opens for clients.
import { useEffect, useState } from "react";
import { CalendarDays, Plus, UsersRound } from "lucide-react";
import { Avatar, Badge, Button, Card, Check, Empty, Field, List, ListRow, Notice, Page, Select, Sheet, Tabs, TextArea } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, NO_KIND } from "../lib/booking";
import { useCoach, coming } from "../lib/coach";
import { call, friendly } from "../lib/supabase";
import { dateKey, hourText, longDay, shortDay } from "../lib/dates";
import { STATUS } from "./Sessies";
import CoachSessie from "./CoachSessie";
import CoachKlas from "./CoachKlas";
import Uren from "./Uren";

type Lesson = { title: string; date: string; hour: string; minute: string; minutes: string; capacity: string; place: string; weeks: string; note: string; announce: boolean };

export default function Agenda() {
  const { player } = useAccount();
  const data = useBooking();
  const coach = useCoach();
  const me = player?.trainerId || "";
  useEffect(() => { coach.refresh(); data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<"sessies" | "lessen" | "uren">("sessies");
  const [classId, setClassId] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [openId, setOpenId] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ---- sessions, a heading per day ----
  const next = coming(coach.bookings);
  const lessons = coach.classes.filter((c) => c.status === "scheduled" && new Date(c.endsAt) > new Date());
  const days = [...new Set([...next.map((b) => b.date), ...lessons.map((c) => c.date)])].sort();
  const plan = async () => {
    if (!lesson) return;
    const l = lesson;
    if (l.title.trim().length < 2) { setError("Geef de les een naam."); return; }
    if (!l.date) { setError("Kies een dag."); return; }
    setBusy(true); setError("");
    try {
      const r = await call<{ created: unknown[]; skipped: number; pending: boolean }>("class_create", { p: {
        title: l.title.trim(), date: l.date, time: `${l.hour.padStart(2, "0")}:${l.minute}`, minutes: Number(l.minutes), capacity: Number(l.capacity) || data.pricing.classCapacity,
        location: l.place.trim(), repeatWeeks: Number(l.weeks), note: l.note.trim(), announce: l.announce } });
      await Promise.all([coach.reload(), data.reload()]);
      setLesson(null);
      const n = r?.created?.length || 0;
      setFlash(`${n === 1 ? "De les is gepland." : `${n} lessen zijn gepland.`}${r?.skipped ? ` ${r.skipped} ${r.skipped === 1 ? "week is" : "weken zijn"} overgeslagen omdat het uur bezet is.` : ""}${r?.pending ? ` "${l.title.trim()}" is een nieuwe soort: ze wacht op goedkeuring van de beheerder. Tot dan zien klanten de les niet.` : ""}`);
    } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const open = coach.bookings.find((b) => b.id === openId) || null;
  const today = dateKey(new Date());

  return (
    <Page title="Agenda">
      <Tabs label="Agenda" value={tab} onChange={(t) => { setTab(t); setFlash(""); }} tabs={[{ id: "sessies", label: "Komend", count: next.length + lessons.length || undefined }, { id: "lessen", label: "Groepslessen" }, { id: "uren", label: "Mijn uren" }]} />
      {flash && <Notice>{flash}</Notice>}
      {coach.error && <Notice tone="danger">{coach.error}</Notice>}

      {tab === "sessies" && (days.length ? days.map((d) => (
        <div key={d}>
          <h2 className="mb-2 px-1 text-lg font-semibold">{longDay(d)}</h2>
          <List>
            {lessons.filter((c) => c.date === d).map((c) => (
              <ListRow key={c.id} lead={<span className="w-12 shrink-0 text-center font-semibold">{c.time}</span>} title={`${c.title} · groepsles`} text={`${c.taken} van ${c.capacity} · ${c.location || data.pricing.place}`} wrap
                below={c.pending ? <Badge tone="warn">Wacht op goedkeuring</Badge> : undefined} trail={<span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-ink"><UsersRound size={18} /></span>} onClick={() => { setFlash(""); setClassId(c.id); }} />
            ))}
            {next.filter((b) => b.date === d).map((b) => (
              <ListRow key={b.id} lead={<span className="w-12 shrink-0 text-center font-semibold">{hourText(b.hour)}</span>} title={b.name} text={`${b.what || NO_KIND} · ${b.place || data.pricing.place}`} wrap
                below={b.status === "pending" ? <Badge tone="warn">{STATUS.pending.text}</Badge> : undefined} trail={<Avatar name={b.name} src={b.avatar || undefined} size={36} />} onClick={() => { setFlash(""); setOpenId(b.id); }} />
            ))}
          </List>
        </div>
      )) : <Card pad={false}><Empty icon={<CalendarDays size={22} />} title="Nog geen sessies gepland" text="Zet uren open; dan kunnen klanten je boeken." action={<Button variant="secondary" onClick={() => setTab("uren")}>Naar mijn uren</Button>} /></Card>)}

      {tab === "lessen" && (<>
        <div><Button icon={<Plus size={18} />} onClick={() => { setError(""); setFlash(""); setLesson({ title: "", date: "", hour: "18", minute: "00", minutes: "60", capacity: String(data.pricing.classCapacity), place: "", weeks: "1", note: "", announce: true }); }}>Groepsles plannen</Button></div>
        {lessons.length ? (
          <List>
            {lessons.map((c) => (
              <ListRow key={c.id} lead={<span className="w-[4.5rem] shrink-0 text-sm leading-tight"><span className="block font-semibold">{shortDay(c.date)}</span><span className="text-muted">{c.time}</span></span>}
                title={c.title} text={`${c.taken} van ${c.capacity} · ${c.location || data.pricing.place}`} wrap below={c.pending ? <Badge tone="warn">Wacht op goedkeuring</Badge> : undefined} onClick={() => { setFlash(""); setClassId(c.id); }} />
            ))}
          </List>
        ) : <Card pad={false}><Empty icon={<UsersRound size={22} />} title="Nog geen groepslessen" text="Plan een les; leden kunnen zich dan inschrijven." /></Card>}
      </>)}

      {tab === "uren" && <Uren trainerId={me} own kinds={coach.kinds} onSaved={coach.reload} />}

      <CoachSessie booking={open} onClose={() => setOpenId("")} onDone={(text) => { setOpenId(""); setFlash(text); }} />
      <CoachKlas klas={coach.classes.find((c) => c.id === classId) || null} onClose={() => setClassId("")} onDone={(text) => { setClassId(""); setFlash(text); }} />

      <Sheet open={Boolean(lesson)} onClose={() => setLesson(null)} title="Groepsles plannen"
        footer={lesson && <Button block disabled={busy} onClick={() => void plan()}>{busy ? "Bezig…" : "Plan de les"}</Button>}>
        {lesson && (<div className="grid gap-4">
          <Field label="Naam van de les" list="soorten-les" maxLength={40} placeholder="bv. Bootcamp, Yoga flow" value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} />
          <datalist id="soorten-les">{coach.kinds.map((k) => <option key={k} value={k} />)}</datalist>
          <Field label="Dag" type="date" min={today} value={lesson.date} onChange={(e) => setLesson({ ...lesson, date: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Select label="Uur" value={lesson.hour} onChange={(e) => setLesson({ ...lesson, hour: e.target.value })}>{Array.from({ length: 18 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}</Select>
            <Select label="Minuten" value={lesson.minute} onChange={(e) => setLesson({ ...lesson, minute: e.target.value })}>{["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}</Select>
            <Select label="Duur" value={lesson.minutes} onChange={(e) => setLesson({ ...lesson, minutes: e.target.value })}>{[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plaatsen" type="number" inputMode="numeric" min={2} max={60} value={lesson.capacity} onChange={(e) => setLesson({ ...lesson, capacity: e.target.value })} />
            <Select label="Herhalen" value={lesson.weeks} onChange={(e) => setLesson({ ...lesson, weeks: e.target.value })}>{Array.from({ length: 12 }, (_, i) => i + 1).map((w) => <option key={w} value={w}>{w === 1 ? "Eén keer" : `${w} weken`}</option>)}</Select>
          </div>
          <Field label="Waar?" maxLength={80} placeholder={data.pricing.place} hint="Laat leeg voor de grote zaal." value={lesson.place} onChange={(e) => setLesson({ ...lesson, place: e.target.value })} />
          <TextArea label="Wat moeten deelnemers weten? (mag leeg blijven)" maxLength={300} rows={2} value={lesson.note} onChange={(e) => setLesson({ ...lesson, note: e.target.value })} />
          <Check checked={lesson.announce} onChange={(on) => setLesson({ ...lesson, announce: on })}>Vertel het aan alle leden: nieuws in de app en een melding.</Check>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>)}
      </Sheet>

    </Page>
  );
}
