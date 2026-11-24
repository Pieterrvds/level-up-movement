// Money: what clients still pay at the desk, and what the coaches get from the admin. The app pays nothing itself;
// the admin records here that it happened.
import { useEffect, useState } from "react";
import { ArrowLeft, HandCoins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Card, Empty, Figures, List, ListRow, Notice, Page, Sheet, Tabs } from "../ui";
import { useBooking, euro, NO_KIND } from "../lib/booking";
import { useAdmin, owedTo, toCollect } from "../lib/admin";
import type { AdminBooking, AdminPack } from "../lib/admin";
import { call, friendly } from "../lib/supabase";
import { hourText, shortDay } from "../lib/dates";

type Open = { booking: AdminBooking } | { pack: AdminPack } | { coach: string } | null;
const Amount = ({ n }: { n: number }) => <span className="font-semibold whitespace-nowrap tabular-nums">{euro(n)}</span>;

export default function Betalingen() {
  const admin = useAdmin();
  const data = useBooking();
  const navigate = useNavigate();
  useEffect(() => { admin.refresh(); data.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<"in" | "uit">("in");
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const sessions = admin.bookings.filter(toCollect).sort((a, b) => (a.date + String(a.hour).padStart(2, "0")).localeCompare(b.date + String(b.hour).padStart(2, "0")));
  const packs = admin.packs.filter((p) => p.status === "requested");
  const collect = sessions.reduce((s, b) => s + b.price, 0) + packs.reduce((s, p) => s + p.price, 0);
  const owed = data.coaches.map((c) => ({ coach: c, ...owedTo(admin, c.id) })).filter((r) => r.amount > 0);
  const payOut = owed.reduce((s, r) => s + r.amount, 0);
  const show = (o: Open) => { setError(""); setFlash(""); setOpen(o); };
  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true); setError("");
    try { await action(); await admin.reload(); setOpen(null); setFlash(ok); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const booking = open && "booking" in open ? open.booking : null;
  const pack = open && "pack" in open ? open.pack : null;
  const row = open && "coach" in open ? owed.find((r) => r.coach.id === open.coach) : undefined;
  const coachOf = (id: string) => data.coach(id)?.short || "de coach";

  return (
    <Page title="Betalingen">
      <div><Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate("/meer")} className="-ml-3">Meer</Button></div>
      <Tabs label="Betalingen" value={tab} onChange={(t) => { setTab(t); setFlash(""); }} tabs={[{ id: "in", label: "Te ontvangen", count: sessions.length + packs.length || undefined }, { id: "uit", label: "Uitbetalen", count: owed.length || undefined }]} />
      {flash && <Notice>{flash}</Notice>}
      {admin.error && <Notice tone="danger">{admin.error}</Notice>}
      {!admin.ready ? <p role="status" className="py-10 text-center text-sm text-muted">Even laden…</p> : tab === "in" ? (<>
        <Figures rows={[{ label: "Nog te ontvangen", value: euro(collect), strong: true }]} />
        {sessions.length + packs.length ? (
          <List>
            {packs.map((p) => <ListRow key={p.id} wrap title={p.name} text={`Pakket van ${p.size} sessies`} trail={<Amount n={p.price} />} onClick={() => show({ pack: p })} />)}
            {sessions.map((b) => <ListRow key={b.id} wrap title={b.name} text={`${b.what || NO_KIND} met ${coachOf(b.trainerId)} · ${shortDay(b.date)} ${hourText(b.hour)}`} trail={<Amount n={b.price} />} onClick={() => show({ booking: b })} />)}
          </List>
        ) : <Card pad={false}><Empty icon={<HandCoins size={22} />} title="Alles is betaald" text="Sessies en pakketten die ter plaatse betaald moeten worden, komen hier." /></Card>}
      </>) : (<>
        <Figures rows={[{ label: "Uit te betalen", value: euro(payOut), strong: true }]} />
        {owed.length ? (
          <List>
            {owed.map((r) => <ListRow key={r.coach.id} wrap lead={<Avatar name={r.coach.name} src={r.coach.photo || undefined} />} title={r.coach.name} text={`${r.count} ${r.count === 1 ? "sessie of les" : "sessies en lessen"}`} trail={<Amount n={r.amount} />} onClick={() => show({ coach: r.coach.id })} />)}
          </List>
        ) : <Card pad={false}><Empty icon={<HandCoins size={22} />} title="Niets uit te betalen" text="Wat een coach verdiende met afgeronde sessies en lessen, komt hier tot je het uitbetaalt." /></Card>}
      </>)}

      <Sheet open={Boolean(booking)} onClose={() => setOpen(null)} title="Betaling"
        footer={booking && <Button block size="lg" disabled={busy} onClick={() => void run(() => call("mark_paid_in_person", { p_id: booking.id }), `Genoteerd: ${booking.name} betaalde ${euro(booking.price)}.`)}>{busy ? "Bezig…" : "Ja, betaald"}</Button>}>
        {booking && (<div className="grid gap-4">
          <p className="text-2xl font-semibold tracking-tight">{booking.name}</p>
          <Figures rows={[{ label: `${booking.what || NO_KIND} met ${coachOf(booking.trainerId)}`, value: euro(booking.price), strong: true }, { label: "Wanneer", value: `${shortDay(booking.date)} ${hourText(booking.hour)}` }]} />
          <p className="text-muted">Heeft {booking.name} dit ter plaatse betaald?</p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>)}
      </Sheet>

      <Sheet open={Boolean(pack)} onClose={() => setOpen(null)} title="Pakket"
        footer={pack && <Button block size="lg" disabled={busy} onClick={() => void run(() => call("mark_pack_paid", { p_id: pack.id }), `Betaald. ${pack.name} heeft nu ${pack.size} beurten.`)}>{busy ? "Bezig…" : "Ja, betaald"}</Button>}>
        {pack && (<div className="grid gap-4">
          <p className="text-2xl font-semibold tracking-tight">{pack.name}</p>
          <Figures rows={[{ label: `Pakket van ${pack.size} sessies`, value: euro(pack.price), strong: true }]} />
          <p className="text-muted">Heeft {pack.name} ter plaatse betaald? Daarna staan de beurten klaar.</p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>)}
      </Sheet>

      <Sheet open={Boolean(row)} onClose={() => setOpen(null)} title="Uitbetaling noteren"
        footer={row && <Button block size="lg" disabled={busy} onClick={() => void run(() => call("mark_payout", { p_trainer: row.coach.id }), `Genoteerd: ${euro(row.amount)} uitbetaald aan ${row.coach.short}.`)}>{busy ? "Bezig…" : "Ja, uitbetaald"}</Button>}>
        {row && (<div className="grid gap-4">
          <p className="text-2xl font-semibold tracking-tight">{row.coach.name}</p>
          <Figures rows={[{ label: `${row.count} ${row.count === 1 ? "sessie of les" : "sessies en lessen"}`, value: euro(row.amount), strong: true }]} />
          <p className="text-muted">Heb je {row.coach.short} dit bedrag betaald? De app betaalt niets zelf: ze noteert alleen dat het gebeurd is.</p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>)}
      </Sheet>
    </Page>
  );
}
