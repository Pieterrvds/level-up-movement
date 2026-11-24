// The first screen after logging in. For now: who you are and where you stand; each role's real start screen
// (next session, to do, overview) comes with its own step (see HERSTART.md).
import { CalendarDays, Hammer } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, CardHead, Empty, Notice, Page, Progress } from "../ui";
import { useAccount } from "../lib/account";
import { levelOf } from "../lib/level";
import { mailReturn } from "../lib/supabase";

const today = () => { const t = new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }); return t[0].toUpperCase() + t.slice(1); };

export default function Start() {
  const { player, role } = useAccount();
  const first = (player?.name || "").trim().split(/\s+/)[0] || "daar";
  const lv = levelOf(player?.xp || 0);
  const welcome = mailReturn.type === "signup" && <Notice>Je e-mail is bevestigd. Welkom bij LEVEL-UP!</Notice>;

  if (role === "coach") {
    return (
      <Page title="Vandaag" text={today()}>
        {welcome}
        <Card pad={false}><Empty icon={<Hammer size={22} />} title="Je dag komt in stap 4" text={`Hallo ${first}. Hier komen je sessies van vandaag en wat op jou wacht.`} /></Card>
      </Page>
    );
  }
  if (role === "admin") {
    return (
      <Page title="Overzicht" text={today()}>
        {welcome}
        <Card pad={false}><Empty icon={<Hammer size={22} />} title="Het overzicht komt in stap 7" text={`Hallo ${first}. Hier komt wat op jou wacht: goedkeuren, sollicitaties en wijzigingen van coaches.`} /></Card>
      </Page>
    );
  }
  return (
    <Page title={`Hallo ${first}`} text="Klaar voor je volgende sessie?">
      {welcome}
      <Card>
        <CardHead title="Je vooruitgang" action={<Badge>{`Level ${lv.level} · ${lv.rank}`}</Badge>} />
        <Progress value={lv.into} max={lv.span} label={`${player?.xp || 0} XP`} note={`nog ${lv.toNext} XP tot level ${lv.level + 1}`} />
      </Card>
      <Card pad={false}>
        <Empty icon={<CalendarDays size={22} />} title="Boek een sessie" text="Kies een coach en een uur. Je eerste sessie is gratis."
          action={<Link to="/boeken" className="contents"><Button>Naar boeken</Button></Link>} />
      </Card>
    </Page>
  );
}
