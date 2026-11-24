// The coach's agenda: the sessions that are coming, day by day, and the hours he opens for clients.
import { useEffect, useState } from "react";
import { CalendarDays, CalendarOff, Clock, Plus, UsersRound } from "lucide-react";
import { Avatar, Badge, Button, Card, Check, Empty, Field, List, ListRow, Notice, Page, Select, Sheet, Tabs, TextArea } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, NO_KIND } from "../lib/booking";
import type { HoursRow } from "../lib/booking";
import { useCoach, coming } from "../lib/coach";
import { call, friendly } from "../lib/supabase";
import { dateKey, hourText, longDay, shortDay } from "../lib/dates";
import { STATUS } from "./Sessies";
import CoachSessie from "./CoachSessie";
import CoachKlas from "./CoachKlas";

const DAYS: [number, string][] = [[1, "Maandag"], [2, "Dinsdag"], [3, "Woensdag"], [4, "Donderdag"], [5, "Vrijdag"], [6, "Zaterdag"], [0, "Zondag"]]; // the server counts Sunday as 0
const span = (r: { start: number; end: number }) => (r.start === 0 && r.end === 24 ? "Hele dag" : `${hourText(r.start)} – ${r.end === 24 ? "24:00" : hourText(r.end)}`);
type Form = { id: string | null; type: "weekly" | "day" | "off"; weekday: string; date: string; start: string; end: string; what: string; place: string };
type Lesson = { title: string; date: string; hour: string; minute: string; minutes: string; capacity: string; place: string; weeks: string; note: string; announce: boolean };
const blank = (type: Form["type"] = "weekly"): Form => ({ id: null, type, weekday: "1", date: "", start: type === "off" ? "0" : "18", end: type === "off" ? "24" : "20", what: "", place: "" });

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
  const [form, setForm] = useState<Form | null>(null);
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

  // ---- hours ----
  const rows = data.hoursOf(me);
  const weekly = rows.filter((r) => r.kind === "open" && r.date === null);
  const today = dateKey(new Date());
  const extra = rows.filter((r) => r.kind === "open" && r.date !== null && r.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
  const off = rows.filter((r) => r.kind === "closed" && r.date !== null && r.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
  const edit = (r: HoursRow) => { setError(""); setFlash(""); setForm({ id: r.id, type: r.kind === "closed" ? "off" : r.date ? "day" : "weekly", weekday: String(r.weekday ?? 1), date: r.date || "", start: String(r.start), end: String(r.end), what: r.activity || "", place: r.location || "" }); };
  const hoursRow = (r: HoursRow, title: string) => (
    <ListRow key={r.id} lead={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken text-muted">{r.kind === "closed" ? <CalendarOff size={20} /> : <Clock size={20} />}</span>}
      title={title} text={r.kind === "closed" ? "Niet boekbaar" : `${r.activity || NO_KIND} · ${r.location || data.pricing.place}`} wrap
      below={r.pending ? <Badge tone="warn">Wacht op goedkeuring</Badge> : undefined} onClick={() => edit(r)} />
  );
  const save = async () => {
    if (!form) return;
    const f = form;
    if (f.type !== "weekly" && !f.date) { setError("Kies een dag."); return; }
    if (f.type !== "off" && !f.what.trim()) { setError("Vul in wat je geeft in deze uren."); return; }
    setBusy(true); setError("");
    try {
      const r = await call<{ pending?: boolean }>("save_trainer_hours", {
        p_id: f.id, p_trainer: me, p_weekday: f.type === "weekly" ? Number(f.weekday) : null, p_day: f.type === "weekly" ? null : f.date,
        p_start: Number(f.start), p_end: Number(f.end), p_kind: f.type === "off" ? "closed" : "open", p_note: "", p_activity: f.type === "off" ? "" : f.what.trim(), p_location: f.type === "off" ? "" : f.place.trim(),
      });
      await Promise.all([data.reload(), coach.reload()]);
      setForm(null);
      setFlash(r?.pending ? `Bewaard. "${f.what.trim()}" is een nieuwe soort: ze wacht op goedkeuring van de beheerder. Tot dan zien klanten deze uren niet.` : f.type === "off" ? "Je vrije dag is bewaard." : "Je uren zijn bewaard.");
    } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const remove = async () => {
    if (!form?.id) return;
    setBusy(true); setError("");
    try { await call("delete_trainer_hours", { p_id: form.id }); await data.reload(); setForm(null); setFlash("Verwijderd."); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const hourOptions = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => <option key={h} value={h}>{h === 24 ? "24:00" : hourText(h)}</option>);

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

      {tab === "uren" && (<>
        <div><Button icon={<Plus size={18} />} onClick={() => { setError(""); setFlash(""); setForm(blank()); }}>Uren toevoegen</Button></div>
        {!rows.length && <Card pad={false}><Empty icon={<Clock size={22} />} title="Je hebt nog geen uren" text="Zet de uren open waarop klanten je kunnen boeken, en zeg wat je geeft en waar." /></Card>}
        {weekly.length > 0 && (<div>
          <h2 className="mb-2 px-1 text-lg font-semibold">Elke week</h2>
          <List>{DAYS.flatMap(([n, name]) => weekly.filter((r) => r.weekday === n).sort((a, b) => a.start - b.start).map((r) => hoursRow(r, `${name} · ${span(r)}`)))}</List>
        </div>)}
        {extra.length > 0 && (<div>
          <h2 className="mb-2 px-1 text-lg font-semibold">Extra uren</h2>
          <List>{extra.map((r) => hoursRow(r, `${shortDay(r.date!)} · ${span(r)}`))}</List>
        </div>)}
        {off.length > 0 && (<div>
          <h2 className="mb-2 px-1 text-lg font-semibold">Vrije dagen</h2>
          <List>{off.map((r) => hoursRow(r, `${shortDay(r.date!)} · ${span(r)}`))}</List>
        </div>)}
      </>)}

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

      <Sheet open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? "Uren aanpassen" : "Uren toevoegen"}
        footer={form && <div className="flex gap-2">{form.id && <Button variant="danger" block disabled={busy} onClick={() => void remove()}>Verwijderen</Button>}<Button block disabled={busy} onClick={() => void save()}>{busy ? "Bezig…" : "Bewaar"}</Button></div>}>
        {form && (<div className="grid gap-4">
          {!form.id && <Tabs label="Soort uren" value={form.type} onChange={(type) => setForm({ ...blank(type), date: form.date })} tabs={[{ id: "weekly", label: "Elke week" }, { id: "day", label: "Eén dag" }, { id: "off", label: "Vrije dag" }]} />}
          {form.type === "weekly"
            ? <Select label="Dag" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>{DAYS.map(([n, name]) => <option key={n} value={n}>{name}</option>)}</Select>
            : <Field label="Dag" type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Van" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}>{hourOptions(0, 23)}</Select>
            <Select label="Tot" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}>{hourOptions(1, 24)}</Select>
          </div>
          {form.type === "off" ? <p className="text-sm text-muted">Op deze dag en uren kan niemand je boeken. Wat al geboekt is, moet je eerst verplaatsen.</p> : (<>
            <Field label="Wat geef je?" list="soorten" maxLength={40} placeholder="bv. Yoga, Boksen, Massage" hint="Kies een bestaande soort of typ een nieuwe." value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} />
            <datalist id="soorten">{coach.kinds.map((k) => <option key={k} value={k} />)}</datalist>
            <Field label="Waar?" maxLength={80} placeholder={data.pricing.place} hint="Laat leeg voor de grote zaal." value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </>)}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>)}
      </Sheet>
    </Page>
  );
}
