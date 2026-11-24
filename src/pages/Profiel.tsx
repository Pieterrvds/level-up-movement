// Your account: who you are, which side of the app you look at (coach or admin, for who is both) and logging out.
// Sessions, progress and settings join in step 3.
import { useState } from "react";
import { LogOut, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Card, CardHead, List, ListRow, Notice, Page, Tabs } from "../ui";
import { useAccount } from "../lib/account";
import { friendly } from "../lib/supabase";
import { ROLE_LABEL } from "../nav";

export default function Profiel({ title }: { title: string }) {
  const { player, roles, role, setRole, logOut } = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!player) return null;
  const out = async () => {
    setBusy(true); setError("");
    try { await logOut(); } catch (err) { setError(friendly(err)); setBusy(false); }
  };
  return (
    <Page title={title}>
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={player.name} src={player.avatarUrl || undefined} size={64} />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-tight">{player.name}</p>
            <p className="truncate text-sm text-muted">{player.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{roles.map((r) => <Badge key={r} tone={r === "klant" ? "neutral" : "accent"}>{r === "admin" ? "Beheerder" : ROLE_LABEL[r]}</Badge>)}</div>
          </div>
        </div>
      </Card>
      {roles.length > 1 && (
        <Card>
          <CardHead title="Weergave" hint="Je bent coach en beheerder. Kies welke kant van de app je ziet." />
          <Tabs label="Weergave" value={role} onChange={(r) => { setRole(r); navigate("/"); }} tabs={roles.map((id) => ({ id, label: ROLE_LABEL[id] }))} />
        </Card>
      )}
      <List>
        <ListRow lead={<span className="grid h-11 w-11 place-items-center rounded-full bg-sunken text-muted"><Palette size={20} /></span>}
          title="Stijl en bouwstenen" text="Hoe de app eruitziet en waaruit ze gemaakt is" onClick={() => navigate("/stijl")} />
      </List>
      {error && <Notice tone="danger">{error}</Notice>}
      <div><Button variant="secondary" icon={<LogOut size={18} />} disabled={busy} onClick={out}>{busy ? "Bezig…" : "Uitloggen"}</Button></div>
    </Page>
  );
}
