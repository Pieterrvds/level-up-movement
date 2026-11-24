// Booking a session, in three calm steps: 1. what and with whom (this list), 2. a day and an hour (the coach's
// screen), 3. confirm (the window). Group classes join in step 5.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, CalendarX, Clock, MapPin, UsersRound } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar, Badge, Button, Card, Chip, Empty, List, ListRow, Notice, Page, Sheet, Tabs, TextArea } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, quote } from "../lib/booking";
import KlasVenster, { classBadge } from "./Klas";
import type { Slot } from "../lib/booking";
import { call, friendly } from "../lib/supabase";
import { dayParts, everyWeekday, hourSpan, hourText, isoWeekday, longDay } from "../lib/dates";

const Loading = () => <Card pad={false}><Empty title="Even laden…" /></Card>;

/** Step 1: what do you want to do, and with whom */
export function Boeken() {
  const data = useBooking();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("soort") === "groep" ? "groep" : "coach";
  useEffect(() => { data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [flash, setFlash] = useState("");
  const lessons = data.classes.filter((c) => c.status === "scheduled" && new Date(c.startsAt) > new Date());
  const lessonDays = [...new Set(lessons.map((c) => c.date))];
  const openClass = data.classes.find((c) => c.id === params.get("les")) || null;
  const go = (next: Record<string, string>) => { const q = new URLSearchParams(params); Object.entries(next).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k))); setParams(q, { replace: true }); };
  const [kind, setKind] = useState("");
  const rows = useMemo(() => data.coaches.map((c) => ({ c, kinds: data.kindsOf(c.id), free: data.freeDays(c.id, kind || undefined).reduce((n, d) => n + d.free, 0) })), [data, kind]);
  const kinds = useMemo(() => [...new Set(rows.flatMap((r) => r.kinds))].sort((a, b) => a.localeCompare(b, "nl")), [rows]);
  const shown = rows.filter((r) => !kind || r.kinds.includes(kind))
    .sort((x, y) => Number(y.c.available) - Number(x.c.available) || Number(y.free > 0) - Number(x.free > 0));
  return (
    <Page title="Boeken" text={tab === "groep" ? "Schrijf je in voor een groepsles." : "Kies wat je wil doen en bij wie."}>
      <Tabs label="Soort" value={tab} onChange={(t) => { setFlash(""); go({ soort: t === "groep" ? "groep" : "", les: "" }); }} tabs={[{ id: "coach", label: "Bij een coach" }, { id: "groep", label: "Groepslessen", count: lessons.length || undefined }]} />
      {flash && <Notice>{flash}</Notice>}
      {!data.ready ? <Loading /> : tab === "groep" ? (lessonDays.length ? lessonDays.map((d) => (
        <div key={d}>
          <h2 className="mb-2 px-1 text-lg font-semibold">{longDay(d)}</h2>
          <List>
            {lessons.filter((c) => c.date === d).map((c) => { const badge = classBadge(c); return (
              <ListRow key={c.id} lead={<span className="w-12 shrink-0 text-center font-semibold">{c.time}</span>} title={c.title} wrap
                text={`${[c.trainerId, ...c.coTrainers].map((id) => data.coach(id)?.short).filter(Boolean).join(" en ")} · ${c.location || data.pricing.place}`}
                below={<Badge tone={badge.tone}>{badge.text}</Badge>} onClick={() => { setFlash(""); go({ les: c.id }); }} />); })}
          </List>
        </div>
      )) : <Card pad={false}><Empty icon={<UsersRound size={22} />} title="Nog geen groepslessen gepland" text="Zodra een coach een les plant, staat ze hier." /></Card>) : (<>
        {data.error && <Notice tone="danger">{data.error}</Notice>}
        {kinds.length > 1 && (
          <div className="slide-x gap-2" role="group" aria-label="Soort sessie">
            <Chip selected={!kind} onClick={() => setKind("")}>Alles</Chip>
            {kinds.map((k) => <Chip key={k} selected={k === kind} onClick={() => setKind(k)} className="px-4">{k}</Chip>)}
          </div>
        )}
        {shown.length ? (
          <List>
            {shown.map(({ c, kinds: gives, free }) => (
              <ListRow key={c.id} lead={<Avatar name={c.name} src={c.photo || undefined} size={52} status={c.available ? "active" : "away"} />}
                title={c.name} text={gives.join(" · ") || c.role}
                trail={!c.available ? <Badge>Afwezig</Badge> : free ? <Badge tone="accent">{`${free} vrij`}</Badge> : <Badge>Volzet</Badge>}
                onClick={() => navigate(`/boeken/${c.id}${kind ? `?soort=${encodeURIComponent(kind)}` : ""}`)} />
            ))}
          </List>
        ) : <Card pad={false}><Empty icon={<CalendarX size={22} />} title="Nog geen coaches" text="Zodra een coach uren openzet, staan ze hier." /></Card>}
      </>)}
      <KlasVenster klas={tab === "groep" ? openClass : null} onClose={() => go({ les: "" })} onDone={(text) => { go({ les: "" }); setFlash(text); }} />
    </Page>
  );
}

/** Steps 2 and 3: a day and an hour with one coach, then the window that confirms */
export function BoekenCoach() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const data = useBooking();
  const { player, reload } = useAccount();
  const coach = data.coach(id);
  const kind = params.get("soort") || "";
  const days = useMemo(() => data.freeDays(id, kind || undefined), [data, id, kind]);
  const day = days.some((d) => d.day === params.get("dag")) ? params.get("dag")! : days[0]?.day || "";
  const list = day ? data.slots(id, day).filter((s) => s.state !== "taken" && (!kind || s.what === kind)) : [];
  // the chosen hour only counts on the day it was chosen for: if that day drops out (it filled up), nothing is
  // picked any more, never the same hour on another day
  const picked = (params.get("dag") === day && list.find((s) => s.state === "free" && String(s.hour) === params.get("uur"))) || null;
  const [note, setNote] = useState("");
  const [often, setOften] = useState<"once" | "weekly">("once");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // once a session is asked for we are on our way to the start screen: nothing may change the address any more
  // (the window closing would otherwise write "no hour chosen" over the move to the start screen)
  const leaving = useRef(false);
  const set = (next: Record<string, string>) => {
    if (leaving.current) return;
    const q = new URLSearchParams(params); Object.entries(next).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k))); setParams(q, { replace: true });
  };

  // the health questions come first (asked once a year): go there with the chosen hour, and come back to it
  const needsHealth = Boolean(picked) && !player?.healthForm?.valid;
  useEffect(() => {
    if (needsHealth) navigate(`/gezondheid?terug=${encodeURIComponent(`/boeken/${id}?${params.toString()}`)}`, { replace: true });
  }, [needsHealth, navigate, id, params]);

  if (!data.ready) return <Page title="Boeken"><Loading /></Page>;
  if (!coach) return <Page title="Boeken"><Card pad={false}><Empty title="Deze coach vinden we niet" action={<Button onClick={() => navigate("/boeken")}>Terug naar boeken</Button>} /></Card></Page>;

  // the same kind and place under each other: "Boksen · Grote zaal" with its hours
  const groups = new Map<string, Slot[]>();
  list.forEach((s) => { const k = `${s.what}\n${s.place}`; groups.set(k, [...(groups.get(k) || []), s]); });
  const price = quote(player, data.pricing, id);
  const ask = async (slot: Slot) => {
    setBusy(true); setError("");
    try {
      const text = note.trim().slice(0, 300);
      if (often === "weekly") await call("book_series", { p_trainer: id, p_day: slot.day, p_hour: slot.hour, p_weeks: null, p_note: text, p_kind: "solo", p_partner: "" });
      else await call("book_session", { p_trainer: id, p_day: slot.day, p_hour: slot.hour, p_note: text, p_kind: "solo", p_partner: "", p_pay: "in_person" });
      leaving.current = true;
      await Promise.all([reload(), data.reload()]);
      navigate("/", { state: { flash: often === "weekly" ? `Aangevraagd. ${coach.short} bevestigt je wekelijkse sessie; je ziet het hier.` : `Aangevraagd. ${coach.short} bevestigt je sessie; je ziet het hier.` } });
    } catch (err) {
      setError(friendly(err));
      set({ uur: "" }); // the window closes; the reason stands on the screen
      void data.reload(); // someone else may have taken the hour: show what is free now
    }
    setBusy(false);
  };

  return (
    <Page title={coach.name} text={coach.role}>
      <div><Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate("/boeken")} className="-ml-3">Alle coaches</Button></div>
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={coach.name} src={coach.photo || undefined} size={64} status={coach.available ? "active" : "away"} />
          <div className="min-w-0">
            <p className="font-semibold">{coach.available ? "Neemt boekingen aan" : "Even afwezig"}</p>
            {coach.specialties.length > 0 && <p className="text-sm text-muted">{coach.specialties.join(" · ")}</p>}
          </div>
        </div>
        {coach.bio && <p className="mt-4 text-[15px] text-muted">{coach.bio}</p>}
      </Card>
      {/* the hour went to someone else: the window closed with it, so the reason stands here */}
      {error && !picked && <Notice tone="danger">{error}</Notice>}
      {!coach.available ? <Notice tone="warn">{coach.short} is even afwezig en neemt geen nieuwe boekingen aan.</Notice>
        : !days.length ? <Card pad={false}><Empty icon={<CalendarX size={22} />} title="Geen vrije uren" text={`${coach.short} heeft de komende weken geen vrij uur${kind ? ` voor ${kind}` : ""}.`} action={<Button variant="secondary" onClick={() => navigate("/boeken")}>Kies een andere coach</Button>} /></Card>
        : (<>
          <div>
            <h2 className="mb-2 px-1 text-lg font-semibold">Kies een dag</h2>
            <div className="slide-x gap-2" role="group" aria-label="Dag">
              {days.map((d) => { const p = dayParts(d.day); return (
                <Chip key={d.day} selected={d.day === day} onClick={() => { setError(""); set({ dag: d.day, uur: "" }); }} className="h-[4.75rem] min-w-14 px-2" aria-label={longDay(d.day)}>
                  <span className="block text-xs font-medium opacity-80">{p.week}</span><span className="block text-lg leading-tight">{p.day}</span><span className="block text-xs font-medium opacity-80">{p.month}</span>
                </Chip>); })}
            </div>
          </div>
          <Card>
            <h2 className="text-lg font-semibold">{longDay(day)}</h2>
            {[...groups].map(([k, hours]) => { const [what, place] = k.split("\n"); return (
              <div key={k} className="mt-4">
                <p className="font-semibold">{what}</p>
                <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />{place}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {hours.map((s) => s.state === "mine"
                    ? <span key={s.hour} className="inline-flex h-11 items-center rounded-field bg-accent-soft px-3 text-[15px] font-semibold text-accent-ink">{hourText(s.hour)} · van jou</span>
                    : <Chip key={s.hour} onClick={() => { setError(""); set({ dag: day, uur: String(s.hour) }); }}>{hourText(s.hour)}</Chip>)}
                </div>
              </div>); })}
          </Card>
        </>)}

      <Sheet open={Boolean(picked) && !needsHealth} onClose={() => { set({ uur: "" }); setOften("once"); }} title="Sessie aanvragen"
        footer={picked && <Button block size="lg" disabled={busy} onClick={() => void ask(picked)}>{busy ? "Bezig…" : often === "weekly" ? "Vraag elke week aan" : "Vraag deze sessie aan"}</Button>}>
        {picked && (<>
          <p className="text-2xl font-semibold tracking-tight">{picked.what} met {coach.short}</p>
          <ul className="mt-3 grid gap-2 text-[15px] text-muted">
            <li className="flex items-center gap-2.5"><CalendarDays size={18} className="shrink-0" aria-hidden /> {longDay(picked.day)}</li>
            <li className="flex items-center gap-2.5"><Clock size={18} className="shrink-0" aria-hidden /> {hourSpan(picked.hour)}</li>
            <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden /> {picked.place}</li>
          </ul>
          <div className="mt-4 flex items-baseline justify-between gap-3 rounded-field bg-sunken px-4 py-3">
            <span className="font-semibold">{price.text}</span>{price.note && <span className="text-right text-sm text-muted">{price.note}</span>}
          </div>
          <div className="mt-4">
            <Tabs label="Hoe vaak" value={often} onChange={setOften} tabs={[{ id: "once", label: "Eén keer" }, { id: "weekly", label: "Elke week" }]} />
            {often === "weekly" && <p className="mt-2 text-sm text-muted">{`Vanaf deze dag ${everyWeekday(isoWeekday(picked.day))} om ${hourText(picked.hour)}, tot jij of ${coach.short} ze stopt. Elke week wordt apart aangerekend.`}</p>}
          </div>
          <TextArea className="mt-4" label="Iets dat je coach moet weten? (mag leeg blijven)" maxLength={300} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="mt-3 text-sm text-muted">{coach.short} bevestigt je aanvraag. Tot dan staat ze op "wacht op bevestiging".</p>
          {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
        </>)}
      </Sheet>
    </Page>
  );
}
