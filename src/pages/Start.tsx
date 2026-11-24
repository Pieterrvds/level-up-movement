// The first screen after logging in. A client sees the next session, the progress and the coaches; the start
// screens of a coach and the admin come with their own step (see HERSTART.md).
import { CalendarDays, Clock, Hammer, MapPin } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Card, CardHead, Empty, List, ListRow, Notice, Page, Progress } from "../ui";
import { useAccount } from "../lib/account";
import type { Booking } from "../lib/account";
import { useBooking, NO_KIND } from "../lib/booking";
import { dateKey, addDays, hourSpan, inDays, longDay, slotStart } from "../lib/dates";
import { levelOf } from "../lib/level";
import { mailReturn } from "../lib/supabase";

const today = () => { const t = new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }); return t[0].toUpperCase() + t.slice(1); };
/** sessions that are still to come: asked for or confirmed */
export const upcoming = (list: Booking[]) => list.filter((b) => ["pending", "confirmed", "awaiting_payment"].includes(b.status) && slotStart(b.date, b.hour + 1) > new Date())
  .sort((a, b) => slotStart(a.date, a.hour).getTime() - slotStart(b.date, b.hour).getTime());
const STATUS: Record<string, { text: string; tone: "accent" | "warn" }> = {
  confirmed: { text: "Bevestigd", tone: "accent" }, pending: { text: "Wacht op bevestiging", tone: "warn" }, awaiting_payment: { text: "Wacht op betaling", tone: "warn" },
};

function Klant() {
  const { player } = useAccount();
  const data = useBooking();
  const navigate = useNavigate();
  const flash = (useLocation().state as { flash?: string } | null)?.flash;
  const first = (player?.name || "").trim().split(/\s+/)[0] || "daar";
  const lv = levelOf(player?.xp || 0);
  const next = upcoming(player?.bookings || []);
  const b = next[0];
  const coach = b ? data.coach(b.trainerId) : undefined;
  const week = Array.from({ length: 7 }, (_, i) => dateKey(addDays(new Date(), i)));
  // who can take you first: active coaches with free hours this week, then the others, away last
  const rows = data.coaches.map((c) => ({ c, free: week.reduce((n, day) => n + data.slots(c.id, day).filter((s) => s.state === "free").length, 0) }))
    .sort((x, y) => Number(y.c.available) - Number(x.c.available) || Number(y.free > 0) - Number(x.free > 0));
  return (
    <Page title={`Hallo ${first}`} text={b ? "Klaar voor je volgende sessie?" : "Klaar om te bewegen?"}>
      {mailReturn.type === "signup" && <Notice>Je e-mail is bevestigd. Welkom bij LEVEL-UP!</Notice>}
      {flash && <Notice>{flash}</Notice>}
      {b ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <Badge tone={STATUS[b.status]?.tone || "accent"}>{STATUS[b.status]?.text || "Gepland"}</Badge>
            <span className="text-sm text-muted">{inDays(b.date)}</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{b.what || NO_KIND}{coach ? ` met ${coach.short}` : ""}</h2>
          <ul className="mt-3 grid gap-2 text-[15px] text-muted">
            <li className="flex items-center gap-2.5"><CalendarDays size={18} className="shrink-0" aria-hidden /> {longDay(b.date)}</li>
            <li className="flex items-center gap-2.5"><Clock size={18} className="shrink-0" aria-hidden /> {hourSpan(b.hour)}</li>
            <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden /> {b.place || data.pricing.place}</li>
          </ul>
          {next.length > 1 && <p className="mt-3 text-sm text-muted">En nog {next.length - 1} {next.length === 2 ? "andere sessie" : "andere sessies"} gepland.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/boeken" className="contents"><Button>Nog een sessie boeken</Button></Link>
            <Link to="/sessies" className="contents"><Button variant="secondary">Mijn sessies</Button></Link>
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          <Empty icon={<CalendarDays size={22} />} title={player?.introEligible ? "Boek je eerste sessie" : "Boek een sessie"}
            text={player?.introEligible && data.pricing.introPrice === 0 ? "Kies een coach en een uur. Je eerste sessie is gratis." : "Kies een coach en een uur."}
            action={<Link to="/boeken" className="contents"><Button>Naar boeken</Button></Link>} />
        </Card>
      )}
      <Card>
        <CardHead title="Je vooruitgang" action={<Badge>{`Level ${lv.level} · ${lv.rank}`}</Badge>} />
        <Progress value={lv.into} max={lv.span} label={`${player?.xp || 0} XP`} note={`nog ${lv.toNext} XP tot level ${lv.level + 1}`} />
      </Card>
      {data.error && <Notice tone="danger">{data.error}</Notice>}
      {rows.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-lg font-semibold">Coaches</h2>
          <List>
            {rows.map(({ c, free }) => (
              <ListRow key={c.id} lead={<Avatar name={c.name} src={c.photo || undefined} status={c.available ? "active" : "away"} />}
                title={c.short} text={data.kindsOf(c.id).join(" · ") || c.role}
                trail={!c.available ? <Badge>Afwezig</Badge> : free ? <Badge tone="accent">{`${free} ${free === 1 ? "uur" : "uren"} vrij`}</Badge> : undefined}
                onClick={() => navigate(`/boeken/${c.id}`)} />
            ))}
          </List>
        </div>
      )}
    </Page>
  );
}

export default function Start() {
  const { player, role } = useAccount();
  const first = (player?.name || "").trim().split(/\s+/)[0] || "daar";
  if (role === "klant") return <Klant />;
  return (
    <Page title={role === "coach" ? "Vandaag" : "Overzicht"} text={today()}>
      {mailReturn.type === "signup" && <Notice>Je e-mail is bevestigd. Welkom bij LEVEL-UP!</Notice>}
      <Card pad={false}>
        {role === "coach"
          ? <Empty icon={<Hammer size={22} />} title="Je dag komt in stap 4" text={`Hallo ${first}. Hier komen je sessies van vandaag en wat op jou wacht.`} />
          : <Empty icon={<Hammer size={22} />} title="Het overzicht komt in stap 7" text={`Hallo ${first}. Hier komt wat op jou wacht: goedkeuren, sollicitaties en wijzigingen van coaches.`} />}
      </Card>
    </Page>
  );
}
