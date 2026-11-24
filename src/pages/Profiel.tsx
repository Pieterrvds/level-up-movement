// Your account: who you are, your sessions and packs, your progress, your settings and logging out.
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Camera, Cake, HandCoins, HeartPulse, KeyRound, LogOut, Megaphone, Palette, Trash2, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Card, CardHead, Figures, List, ListRow, Notice, Page, PasswordField, Progress, Select, Sheet, Stat, Tabs } from "../ui";
import { useAccount } from "../lib/account";
import { useBooking, euro } from "../lib/booking";
import { useCoach } from "../lib/coach";
import { call, friendly, supabase } from "../lib/supabase";
import { levelOf } from "../lib/level";
import { ROLE_LABEL } from "../nav";
import { upcoming } from "./Start";
import Meldingen from "./Meldingen";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const Icon = ({ children }: { children: ReactNode }) => <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken text-muted">{children}</span>;

/** A photo as a square of 400 px, a little above the middle (faces), as a JPEG */
async function squarePhoto(file: File): Promise<Blob> {
  const img = await createImageBitmap(file).catch(() => { throw new Error("Dit bestand kunnen we niet als foto lezen. Kies een andere foto."); });
  const side = Math.min(img.width, img.height), size = 400;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.width - side) / 2, Math.max(0, (img.height - side) * 0.3), side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Deze foto konden we niet voorbereiden."))), "image/jpeg", 0.86));
}

export default function Profiel({ title }: { title: string }) {
  const { player, roles, role, setRole, logOut, reload, setPassword } = useAccount();
  const data = useBooking();
  const money = useCoach().earnings;
  const navigate = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<"" | "birthday" | "password" | "delete" | "pack">("");
  const [packSize, setPackSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [day, setDay] = useState(player?.birthday?.slice(3) || "");
  const [month, setMonth] = useState(player?.birthday?.slice(0, 2) || "");
  const [password, setNewPassword] = useState("");
  if (!player) return null;
  const lv = levelOf(player.xp);
  const next = upcoming(player.bookings);
  const done = player.bookings.filter((b) => b.status === "completed").length;
  const packs = (player.packs || []).filter((p) => p.status !== "cancelled");
  const credits = packs.filter((p) => p.status === "paid").reduce((n, p) => n + p.remaining, 0);
  const asked = packs.find((p) => p.status === "requested");
  const close = () => { setSheet(""); setError(""); setNewPassword(""); };
  // one helper for every small action: busy, the error under it, a line when it worked
  const run = async (action: () => Promise<void>, ok: string) => {
    setBusy(true); setError(""); setFlash("");
    try { await action(); setSheet(""); setFlash(ok); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const photo = (f: File | undefined) => f && run(async () => {
    const path = `${player.id}/${Date.now()}.jpg`;
    const { error: e } = await supabase.storage.from("avatars").upload(path, await squarePhoto(f), { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (e) throw e;
    const old = player.avatarUrl?.split("/storage/v1/object/public/avatars/")[1];
    await call("set_avatar", { p_url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl });
    if (old) void supabase.storage.from("avatars").remove([old]);
    await reload();
  }, "Je foto is aangepast.");
  const birthdayText = player.birthday ? `${Number(player.birthday.slice(3))} ${MONTHS[Number(player.birthday.slice(0, 2)) - 1]}` : "Nog niet ingevuld";

  return (
    <Page title={title}>
      {role === "admin" && (
        <div>
          <h2 className="mb-2 px-1 text-lg font-semibold">Beheer</h2>
          <List>
            <ListRow lead={<Icon><UsersRound size={20} /></Icon>} title="Leden" text="Iedereen met een account" onClick={() => navigate("/leden")} />
            <ListRow lead={<Icon><HandCoins size={20} /></Icon>} title="Betalingen" text="Te ontvangen en uit te betalen" onClick={() => navigate("/betalingen")} />
            <ListRow lead={<Icon><Megaphone size={20} /></Icon>} title="Nieuws" text="Een bericht voor alle leden" onClick={() => navigate("/nieuws")} />
          </List>
        </div>
      )}
      <Card>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => file.current?.click()} className="relative shrink-0 rounded-full" aria-label="Foto wijzigen" disabled={busy}>
            <Avatar name={player.name} src={player.avatarUrl || undefined} size={72} />
            <span className="absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-brand text-white"><Camera size={15} aria-hidden /></span>
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-tight">{player.name}</p>
            <p className="truncate text-sm text-muted">{player.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{roles.map((r) => <Badge key={r} tone={r === "klant" ? "neutral" : "accent"}>{r === "admin" ? "Beheerder" : ROLE_LABEL[r]}</Badge>)}</div>
          </div>
        </div>
      </Card>
      {flash && <Notice>{flash}</Notice>}
      {error && !sheet && <Notice tone="danger">{error}</Notice>}
      {roles.length > 1 && (
        <Card>
          <CardHead title="Weergave" hint="Je bent coach en beheerder. Kies welke kant van de app je ziet." />
          <Tabs label="Weergave" value={role} onChange={(r) => { setRole(r); navigate("/"); }} tabs={roles.map((id) => ({ id, label: ROLE_LABEL[id] }))} />
        </Card>
      )}

      {player.trainerId && money && (
        <Card>
          <CardHead title="Verdiensten" hint={`${money.sessions} ${money.sessions === 1 ? "sessie" : "sessies"} die tellen.`} />
          <Figures rows={[
            { label: "Tegoed", value: euro(money.owed), strong: true },
            { label: "Al uitbetaald", value: euro(money.paid) },
            { label: "Verdiend in totaal", value: euro(money.earned) },
            { label: "Nog verwacht", value: euro(money.expected) },
          ]} />
        </Card>
      )}

      <Card>
        <CardHead title="Je vooruitgang" action={<Badge>{`Level ${lv.level} · ${lv.rank}`}</Badge>} />
        <Progress value={lv.into} max={lv.span} label={`${player.xp} XP`} note={`nog ${lv.toNext} XP tot level ${lv.level + 1}`} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat value={done} label="gedaan" /><Stat value={next.length} label="gepland" /><Stat value={credits} label={credits === 1 ? "beurt" : "beurten"} />
        </div>
      </Card>

      <List>
        <ListRow lead={<Icon><CalendarDays size={20} /></Icon>} title="Mijn sessies" text={next.length ? `${next.length} gepland` : "Komend en voorbij"} onClick={() => navigate("/sessies")} />
      </List>

      {data.pricing.packs.length > 0 && (
        <Card>
          <CardHead title="Pakketten" hint={credits ? `Je hebt nog ${credits} ${credits === 1 ? "beurt" : "beurten"}. Een boeking gebruikt er vanzelf één.` : "Meerdere sessies in één keer, voordeliger per sessie."} />
          {asked ? (
            <div className="grid gap-3">
              <Notice tone="warn">{`Pakket van ${asked.size} sessies aangevraagd (${euro(asked.price)}). Betaal ter plaatse; daarna staan je beurten klaar.`}</Notice>
              <div><Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(async () => { await call("cancel_pack_request", { p_id: asked.id }); await reload(); }, "Je aanvraag is ingetrokken.")}>Aanvraag intrekken</Button></div>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 divide-y divide-line overflow-hidden rounded-b-card border-t border-line">
              {data.pricing.packs.map((o) => (
                <ListRow key={o.size} wrap title={`${o.size}\u00a0sessies`} text={`${euro(Math.round((o.price / o.size) * 100) / 100)} per sessie`}
                  trail={<span className="font-semibold whitespace-nowrap tabular-nums">{euro(o.price)}</span>} onClick={() => { setError(""); setFlash(""); setPackSize(o.size); setSheet("pack"); }} />
              ))}
            </div>
          )}
        </Card>
      )}

      <div>
        <h2 className="mb-2 px-1 text-lg font-semibold">Instellingen</h2>
        <List>
          <ListRow lead={<Icon><HeartPulse size={20} /></Icon>} title="Gezondheidsvragen" text={player.healthForm?.valid ? "Ingevuld. Je kan ze altijd aanpassen." : "Nog in te vullen voor je eerste sessie"} onClick={() => navigate(`/gezondheid?terug=${encodeURIComponent(role === "admin" ? "/meer" : "/profiel")}`)} />
          <ListRow lead={<Icon><Cake size={20} /></Icon>} title="Geboortedag" text={birthdayText} onClick={() => { setError(""); setSheet("birthday"); }} />
          <Meldingen />
          <ListRow lead={<Icon><KeyRound size={20} /></Icon>} title="Wachtwoord wijzigen" onClick={() => { setError(""); setSheet("password"); }} />
          <ListRow lead={<Icon><Palette size={20} /></Icon>} title="Stijl en bouwstenen" text="Hoe de app eruitziet en waaruit ze gemaakt is" onClick={() => navigate("/stijl")} />
        </List>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<LogOut size={18} />} disabled={busy} onClick={() => void run(logOut, "")}>Uitloggen</Button>
        <Button variant="ghost" icon={<Trash2 size={18} />} onClick={() => { setError(""); setSheet("delete"); }}>Account verwijderen</Button>
      </div>

      <Sheet open={sheet === "pack"} onClose={close} title="Pakket aanvragen"
        footer={<Button block size="lg" disabled={busy} onClick={() => void run(async () => { await call("request_pack", { p_size: packSize, p_pay: "in_person" }); await reload(); }, "Aangevraagd. Betaal ter plaatse; daarna staan je beurten klaar.")}>{busy ? "Bezig…" : "Vraag dit pakket aan"}</Button>}>
        {(() => { const o = data.pricing.packs.find((x) => x.size === packSize); return o ? (<>
          <p className="text-2xl font-semibold tracking-tight">{o.size} sessies</p>
          <div className="mt-4"><Figures rows={[{ label: "Prijs", value: euro(o.price), strong: true }, { label: "Per sessie", value: euro(Math.round((o.price / o.size) * 100) / 100) }]} /></div>
          <p className="mt-4 text-muted">Je betaalt ter plaatse. Daarna staan je beurten klaar en gebruikt elke boeking er vanzelf één.</p>
        </>) : null; })()}
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      </Sheet>

      <Sheet open={sheet === "birthday"} onClose={close} title="Geboortedag"
        footer={<div className="flex gap-2">
          {player.birthday && <Button variant="secondary" block disabled={busy} onClick={() => void run(async () => { await call("set_birthday", { p_md: "" }); await reload(); }, "Je geboortedag is gewist.")}>Wissen</Button>}
          <Button block disabled={busy || !day || !month} onClick={() => void run(async () => { await call("set_birthday", { p_md: `${month}-${day}` }); await reload(); }, "Je geboortedag is bewaard.")}>Bewaar</Button>
        </div>}>
        <p className="text-muted">Alleen de dag en de maand, geen jaar. Zo krijg je op je verjaardag een verrassing.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Select label="Dag" value={day} onChange={(e) => setDay(e.target.value)}><option value="">Kies</option>{Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}</Select>
          <Select label="Maand" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Kies</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}</Select>
        </div>
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      </Sheet>

      <Sheet open={sheet === "password"} onClose={close} title="Wachtwoord wijzigen"
        footer={<Button block disabled={busy} onClick={() => void run(async () => { if (password.length < 8) throw new Error("Kies een wachtwoord van minstens 8 tekens."); await setPassword(password); setNewPassword(""); }, "Je wachtwoord is gewijzigd.")}>{busy ? "Bezig…" : "Bewaar wachtwoord"}</Button>}>
        <PasswordField label="Nieuw wachtwoord" name="new-password" autoComplete="new-password" hint="Minstens 8 tekens." value={password} onChange={(e) => setNewPassword(e.target.value)} />
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={close} title="Account verwijderen"
        footer={<div className="grid gap-2">
          <Button variant="danger" block disabled={busy} onClick={() => void run(async () => { await call("delete_my_account"); await logOut().catch(() => {}); }, "")}>{busy ? "Bezig…" : "Ja, verwijder mijn account"}</Button>
          <Button variant="ghost" block onClick={close}>Nee, behoud mijn account</Button>
        </div>}>
        <Notice tone="danger">Dit kan je niet ongedaan maken.</Notice>
        <p className="mt-3 text-muted">Je account, je sessies, je XP, je berichten en je gezondheidsantwoorden worden gewist. {next.length > 0 && `Je hebt nog ${next.length} ${next.length === 1 ? "sessie" : "sessies"} gepland; die ${next.length === 1 ? "vervalt" : "vervallen"} mee.`}</p>
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      </Sheet>
    </Page>
  );
}
