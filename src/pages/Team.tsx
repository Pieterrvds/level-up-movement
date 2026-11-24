// The team: every coach on a row, and one coach's page where the admin changes the card, the price, the hours,
// switches the coach active or away, and records a payout.
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Badge, Button, Card, CardHead, Empty, Field, Figures, List, ListRow, Notice, Page, Sheet, Switch, TextArea } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, euro, NO_KIND } from "../lib/booking";
import { useAdmin, owedTo, thisWeek } from "../lib/admin";
import { MessageButton } from "../lib/chat";
import { call, friendly } from "../lib/supabase";
import { dateKey, hourText, shortDay } from "../lib/dates";
import Uren from "./Uren";

const Loading = () => <p role="status" className="py-10 text-center text-sm text-muted">Even laden…</p>;

export function Team() {
  const admin = useAdmin();
  const data = useBooking();
  const navigate = useNavigate();
  useEffect(() => { admin.refresh(); data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data.ready || !admin.ready) return <Page title="Team"><Loading /></Page>;
  // active first, as clients see them
  const coaches = [...data.coaches].sort((a, b) => Number(b.available) - Number(a.available));
  return (
    <Page title="Team" text="Tik op een coach voor de kaart, de prijs en de uren.">
      {admin.error && <Notice tone="danger">{admin.error}</Notice>}
      {coaches.length ? (
        <List>
          {coaches.map((c) => {
            const n = thisWeek(admin, c.id), owed = owedTo(admin, c.id).amount;
            return (
              <ListRow key={c.id} wrap lead={<Avatar name={c.name} src={c.photo || undefined} status={c.available ? "active" : "away"} />} title={c.name}
                text={`${c.role} · ${n} deze week`}
                below={!c.linked ? <Badge tone="warn">Nog geen account</Badge> : owed > 0 ? <Badge>{`Uit te betalen: ${euro(owed)}`}</Badge> : undefined}
                onClick={() => navigate(`/team/${c.id}`)} />
            );
          })}
        </List>
      ) : <Card pad={false}><Empty title="Nog geen coaches" text="Wie solliciteert als coach, komt op je overzicht. Na je goedkeuring staat de coach hier." /></Card>}
    </Page>
  );
}

export function TeamCoach() {
  const { id = "" } = useParams();
  const { player } = useAccount();
  const admin = useAdmin();
  const data = useBooking();
  const navigate = useNavigate();
  useEffect(() => { admin.refresh(); data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sheet, setSheet] = useState<"" | "card" | "price" | "payout">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [form, setForm] = useState({ name: "", role: "", specialties: "", bio: "" });
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");

  const coach = data.coach(id);
  if (!data.ready || !admin.ready) return <Page title="Team"><Loading /></Page>;
  if (!coach) return <Page title="Team"><Card pad={false}><Empty title="Deze coach vinden we niet" action={<Button onClick={() => navigate("/team")}>Terug naar het team</Button>} /></Card></Page>;

  const own = admin.pricing.trainers[id] || { price: null, fee: null };
  const isOwner = id === admin.pricing.ownerTrainerId;
  const sessionPrice = own.price ?? admin.pricing.price, sessionFee = own.fee ?? admin.pricing.fee;
  const owed = owedTo(admin, id);
  const today = dateKey(new Date());
  const next = admin.bookings.filter((b) => b.trainerId === id && ["pending", "confirmed"].includes(b.status) && b.date >= today).slice(0, 5);
  const lessons = admin.classes.filter((c) => c.trainerId === id && c.status === "scheduled" && c.date >= today).slice(0, 5);
  const kinds = admin.kinds.filter((k) => k.status === "approved").map((k) => k.title);
  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true); setError(""); setFlash("");
    try { await action(); await Promise.all([admin.reload(), data.reload()]); setSheet(""); setFlash(ok); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const amount = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <Page title={coach.name} text={coach.role}>
      <div><Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate("/team")} className="-ml-3">Team</Button></div>
      {flash && <Notice>{flash}</Notice>}
      {error && !sheet && <Notice tone="danger">{error}</Notice>}

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={coach.name} src={coach.photo || undefined} size={64} status={coach.available ? "active" : "away"} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{coach.available ? "Actief" : "Afwezig"}</p>
            <p className="text-sm text-muted">{coach.available ? "Klanten kunnen boeken." : "Niemand kan nu boeken. Wat gepland is, blijft."}</p>
          </div>
          <span className={busy ? "pointer-events-none opacity-60" : ""}><Switch checked={coach.available} label="Actief of afwezig" onChange={(on) => void run(() => call("set_trainer_available", { p_trainer: id, p_on: on }), on ? `${coach.short} is weer actief.` : `${coach.short} staat op afwezig.`)} /></span>
        </div>
        {coach.specialties.length > 0 && <p className="mt-4 text-sm text-muted">{coach.specialties.join(" · ")}</p>}
        {coach.bio && <p className="mt-2 text-[15px] text-muted">{coach.bio}</p>}
        {!coach.linked && <div className="mt-4"><Notice tone="warn">Deze kaart heeft nog geen account. Keur een sollicitatie goed en koppel ze aan deze kaart.</Notice></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => { setError(""); setForm({ name: coach.name, role: coach.role, specialties: coach.specialties.join(", "), bio: coach.bio }); setSheet("card"); }}>Kaart aanpassen</Button>
          {coach.linked && id !== player?.trainerId && <MessageButton coach={id} />}
        </div>
      </Card>

      <Card>
        <CardHead title="Geld" />
        <Figures rows={[
          { label: "Prijs per sessie", value: euro(sessionPrice) },
          { label: "Vergoeding per sessie", value: isOwner ? "–" : euro(sessionFee) },
          { label: "Uit te betalen", value: euro(owed.amount), strong: true },
        ]} />
        {isOwner && <p className="mt-3 text-sm text-muted">Dit is de kaart van de eigenaar: er is niets uit te betalen.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setError(""); setPrice(own.price == null ? "" : String(own.price)); setFee(own.fee == null ? "" : String(own.fee)); setSheet("price"); }}>Prijs aanpassen</Button>
          {owed.amount > 0 && <Button variant="secondary" size="sm" onClick={() => { setError(""); setSheet("payout"); }}>Uitbetaling noteren</Button>}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 px-1 text-lg font-semibold">Komend</h2>
        {next.length + lessons.length ? (
          <List>
            {lessons.map((c) => <ListRow key={c.id} wrap lead={<span className="w-[4.5rem] shrink-0 text-sm leading-tight"><span className="block font-semibold">{shortDay(c.date)}</span><span className="text-muted">{c.time}</span></span>} title={`${c.title} · groepsles`} text={`${c.taken} van ${c.capacity} · ${c.location || data.pricing.place}`} />)}
            {next.map((b) => <ListRow key={b.id} wrap lead={<span className="w-[4.5rem] shrink-0 text-sm leading-tight"><span className="block font-semibold">{shortDay(b.date)}</span><span className="text-muted">{hourText(b.hour)}</span></span>} title={b.name} text={`${b.what || NO_KIND} · ${b.place || data.pricing.place}`} below={b.status === "pending" ? <Badge tone="warn">Wacht op antwoord</Badge> : undefined} />)}
          </List>
        ) : <Card pad={false}><Empty title="Niets gepland" text="Sessies en groepslessen van deze coach komen hier." /></Card>}
      </div>

      <div className="grid gap-4">
        <h2 className="-mb-2 px-1 text-lg font-semibold">Uren</h2>
        <Uren trainerId={id} own={false} name={coach.short} kinds={kinds} onSaved={admin.reload} />
      </div>

      <Sheet open={sheet === "card"} onClose={() => setSheet("")} title="Kaart aanpassen"
        footer={<Button block disabled={busy} onClick={() => void run(() => call("admin_trainer_update", { p_trainer: id, p: { name: form.name.trim(), role: form.role.trim(), specialties: form.specialties.trim(), bio: form.bio.trim() } }), "De kaart is bewaard. Klanten zien ze meteen zo.")}>{busy ? "Bezig…" : "Bewaar"}</Button>}>
        <div className="grid gap-4">
          <Field label="Naam" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="Titel" maxLength={60} placeholder="bv. Yogadocent, Kinesist" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <Field label="Wat geeft deze coach?" maxLength={200} hint="Gescheiden door een komma." placeholder="bv. Yoga, Massage, Revalidatie" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} />
          <TextArea label="Korte tekst" rows={4} maxLength={600} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Sheet>

      <Sheet open={sheet === "price"} onClose={() => setSheet("")} title="Prijs aanpassen"
        footer={<Button block disabled={busy} onClick={() => {
          const p = amount(price), f = amount(fee);
          if ((p !== null && Number.isNaN(p)) || (f !== null && Number.isNaN(f))) { setError("Vul een bedrag in, of laat het veld leeg."); return; }
          void run(() => call("set_trainer_pricing", { p_trainer: id, p_price: p, p_fee: f }), "De prijs is bewaard. Hij geldt voor nieuwe boekingen.");
        }}>{busy ? "Bezig…" : "Bewaar"}</Button>}>
        <div className="grid gap-4">
          <p className="text-muted">Laat een veld leeg voor de standaard: {euro(admin.pricing.price)} per sessie, waarvan {euro(admin.pricing.fee)} voor de coach.</p>
          <Field label="Prijs per sessie (€)" inputMode="decimal" placeholder={String(admin.pricing.price)} value={price} onChange={(e) => setPrice(e.target.value)} />
          {!isOwner && <Field label="Vergoeding voor de coach (€)" inputMode="decimal" placeholder={String(admin.pricing.fee)} value={fee} onChange={(e) => setFee(e.target.value)} />}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Sheet>

      <Sheet open={sheet === "payout"} onClose={() => setSheet("")} title="Uitbetaling noteren"
        footer={<Button block size="lg" disabled={busy} onClick={() => void run(() => call("mark_payout", { p_trainer: id }), `Genoteerd: ${euro(owed.amount)} uitbetaald aan ${coach.short}.`)}>{busy ? "Bezig…" : "Ja, uitbetaald"}</Button>}>
        <div className="grid gap-4">
          <Figures rows={[{ label: `${owed.count} ${owed.count === 1 ? "sessie of les" : "sessies en lessen"}`, value: euro(owed.amount), strong: true }]} />
          <p className="text-muted">Heb je {coach.short} dit bedrag betaald? De app betaalt niets zelf: ze noteert alleen dat het gebeurd is.</p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Sheet>
    </Page>
  );
}
