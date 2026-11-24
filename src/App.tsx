import { Navigate, Route, Routes } from "react-router-dom";
import AppShell, { Bare, Logo } from "./shell/AppShell";
import { useAccount } from "./lib/account";
import { mailReturn } from "./lib/supabase";
import { Button, Card, Empty } from "./ui";
import Stijl from "./pages/Stijl";
import { StartKlant, StartCoach, StartAdmin } from "./pages/Voorbeeld";
import Later from "./pages/Later";
import Start from "./pages/Start";
import Profiel from "./pages/Profiel";
import { AccountMaken, Inloggen, NieuwWachtwoord, WachtwoordVergeten } from "./pages/Toegang";

// The look and the example screens (made-up data): open to everyone, they are the reference while the app is built
const reference = (
  <>
    <Route path="stijl" element={<Stijl />} />
    <Route path="stijl/klant" element={<StartKlant />} />
    <Route path="stijl/coach" element={<StartCoach />} />
    <Route path="stijl/admin" element={<StartAdmin />} />
  </>
);

function Splash() {
  return <div className="grid min-h-dvh place-content-center justify-items-center gap-4" role="status"><Logo /><p className="text-sm text-muted">Even laden…</p></div>;
}

export default function App() {
  const account = useAccount();
  if (account.status === "loading") return <Splash />;

  if (account.status === "visitor") {
    return (
      <Routes>
        <Route element={<Bare />}>
          <Route path="inloggen" element={<Inloggen />} />
          <Route path="account-maken" element={<AccountMaken />} />
          <Route path="wachtwoord-vergeten" element={<WachtwoordVergeten />} />
        </Route>
        <Route element={<Bare wide />}>{reference}</Route>
        <Route path="*" element={<Navigate to="/inloggen" replace />} />
      </Routes>
    );
  }

  // logged in through the link of "forgot my password": first a new password, then the app
  if (account.recovering || mailReturn.type === "recovery" && !account.player && !account.error) {
    return account.recovering ? <Routes><Route element={<Bare />}><Route path="*" element={<NieuwWachtwoord />} /></Route></Routes> : <Splash />;
  }
  if (!account.player) {
    if (!account.error) return <Splash />;
    return (
      <Routes><Route element={<Bare />}><Route path="*" element={
        <Card pad={false}><Empty title="Je account laadt niet" text={account.error}
          action={<div className="flex gap-2"><Button onClick={() => void account.reload()}>Opnieuw proberen</Button><Button variant="secondary" onClick={() => void account.logOut()}>Uitloggen</Button></div>} /></Card>
      } /></Route></Routes>
    );
  }

  const last = account.role === "admin" ? "meer" : "profiel";
  return (
    <Routes>
      <Route element={<AppShell role={account.role} />}>
        <Route index element={<Start />} />
        {reference}
        <Route path="boeken" element={<Later title="Boeken" step="stap 2" text="Kies een training, een coach en een uur." />} />
        <Route path="agenda" element={<Later title="Agenda" step="stap 4" text="Je sessies en groepslessen per dag, en je uren." />} />
        <Route path="team" element={<Later title="Team" step="stap 7" text="Elke trainer met zijn lessen en uren." />} />
        <Route path="chat" element={<Later title="Chat" step="stap 6" text="Berichten met je coach of je klanten." />} />
        <Route path={last} element={<Profiel title={account.role === "admin" ? "Meer" : "Profiel"} />} />
        {["inloggen", "account-maken", "wachtwoord-vergeten", "profiel", "meer"].map((p) => <Route key={p} path={p} element={<Navigate to="/" replace />} />)}
        <Route path="*" element={<Later title="Niet gevonden" text="Deze pagina bestaat niet." />} />
      </Route>
    </Routes>
  );
}
