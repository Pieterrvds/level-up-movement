// The hours a coach opens for clients: every week, one extra day, or a day off. The coach sets his own;
// the admin can set them for any coach (Team).
import { useState } from "react";
import { CalendarOff, Clock, Plus } from "lucide-react";
import { Badge, Button, Card, Empty, Field, List, ListRow, Notice, Select, Sheet, Tabs } from "../ui";
import { useBooking, NO_KIND } from "../lib/booking";
import type { HoursRow } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { dateKey, hourText, shortDay } from "../lib/dates";

const DAYS: [number, string][] = [[1, "Maandag"], [2, "Dinsdag"], [3, "Woensdag"], [4, "Donderdag"], [5, "Vrijdag"], [6, "Zaterdag"], [0, "Zondag"]]; // the server counts Sunday as 0
const span = (r: { start: number; end: number }) => (r.start === 0 && r.end === 24 ? "Hele dag" : `${hourText(r.start)} – ${r.end === 24 ? "24:00" : hourText(r.end)}`);
type Form = { id: string | null; type: "weekly" | "day" | "off"; weekday: string; date: string; start: string; end: string; what: string; place: string };
const blank = (type: Form["type"] = "weekly"): Form => ({ id: null, type, weekday: "1", date: "", start: type === "off" ? "0" : "18", end: type === "off" ? "24" : "20", what: "", place: "" });

/** own: the coach looks at his own hours (the texts say "je"); otherwise the admin sets them for `name` */
export default function Uren({ trainerId, own, name = "", kinds, onSaved }: { trainerId: string; own: boolean; name?: string; kinds: string[]; onSaved?: () => Promise<unknown> | void }) {
  const data = useBooking();
  const me = trainerId;
  const [flash, setFlash] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    if (f.type !== "off" && !f.what.trim()) { setError(own ? "Vul in wat je geeft in deze uren." : "Vul in wat er gegeven wordt in deze uren."); return; }
    setBusy(true); setError("");
    try {
      const r = await call<{ pending?: boolean }>("save_trainer_hours", {
        p_id: f.id, p_trainer: me, p_weekday: f.type === "weekly" ? Number(f.weekday) : null, p_day: f.type === "weekly" ? null : f.date,
        p_start: Number(f.start), p_end: Number(f.end), p_kind: f.type === "off" ? "closed" : "open", p_note: "", p_activity: f.type === "off" ? "" : f.what.trim(), p_location: f.type === "off" ? "" : f.place.trim(),
      });
      await Promise.all([data.reload(), onSaved?.()]);
      setForm(null);
      setFlash(r?.pending ? `Bewaard. "${f.what.trim()}" is een nieuwe soort: ze wacht op goedkeuring van de beheerder. Tot dan zien klanten deze uren niet.` : f.type === "off" ? (own ? "Je vrije dag is bewaard." : "De vrije dag is bewaard.") : own ? "Je uren zijn bewaard." : "De uren zijn bewaard.");
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
    <>
      {flash && <Notice>{flash}</Notice>}
        <div><Button icon={<Plus size={18} />} onClick={() => { setError(""); setFlash(""); setForm(blank()); }}>Uren toevoegen</Button></div>
        {!rows.length && <Card pad={false}><Empty icon={<Clock size={22} />} title={own ? "Je hebt nog geen uren" : `${name || "Deze coach"} heeft nog geen uren`} text={own ? "Zet de uren open waarop klanten je kunnen boeken, en zeg wat je geeft en waar." : "Zet de uren open waarop klanten kunnen boeken, en zeg wat er gegeven wordt en waar."} /></Card>}
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
          {form.type === "off" ? <p className="text-sm text-muted">{own ? "Op deze dag en uren kan niemand je boeken. Wat al geboekt is, moet je eerst verplaatsen." : "Op deze dag en uren kan niemand boeken. Wat al geboekt is, moet eerst verplaatst worden."}</p> : (<>
            <Field label={own ? "Wat geef je?" : "Wat wordt er gegeven?"} list="soorten" maxLength={40} placeholder="bv. Yoga, Boksen, Massage" hint="Kies een bestaande soort of typ een nieuwe." value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} />
            <datalist id="soorten">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
            <Field label="Waar?" maxLength={80} placeholder={data.pricing.place} hint="Laat leeg voor de grote zaal." value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </>)}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>)}
      </Sheet>
    </>
  );
}
