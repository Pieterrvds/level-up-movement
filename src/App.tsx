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
import { Boeken, BoekenCoach } from "./pages/Boeken";
import Gezondheid from "./pages/Gezondheid";
import Sessies from "./pages/Sessies";
import { BookingProvider } from "./lib/booking";
import { CoachProvider } from "./lib/coach";
import Agenda from "./pages/Agenda";
import Chat from "./pages/Chat";
import Gesprek from "./pages/Gesprek";
import { ChatProvider } from "./lib/chat";
import { AdminProvider } from "./lib/admin";
import { Team, TeamCoach } from "./pages/Team";
import Leden from "./pages/Leden";
import Betalingen from "./pages/Betalingen";
import Nieuws from "./pages/Nieuws";

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
    <BookingProvider>
    <CoachProvider>
    <AdminProvider>
    <ChatProvider>
    <Routes>
      <Route element={<AppShell role={account.role} />}>
        <Route index element={<Start />} />
        {reference}
        <Route path="boeken" element={<Boeken />} />
        <Route path="boeken/:id" element={<BoekenCoach />} />
        <Route path="gezondheid" element={<Gezondheid />} />
        <Route path="sessies" element={<Sessies />} />
        <Route path="agenda" element={account.player.trainerId ? <Agenda /> : <Navigate to="/" replace />} />
        {/* the admin's screens: only for an admin (the server checks every action again) */}
        {[["team", <Team />], ["team/:id", <TeamCoach />], ["leden", <Leden />], ["betalingen", <Betalingen />], ["nieuws", <Nieuws />]].map(([path, el]) => (
          <Route key={path as string} path={path as string} element={account.player?.admin ? el : <Navigate to="/" replace />} />
        ))}
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:id" element={<Gesprek />} />
        <Route path={last} element={<Profiel title={account.role === "admin" ? "Meer" : "Profiel"} />} />
        {["inloggen", "account-maken", "wachtwoord-vergeten", "profiel", "meer"].map((p) => <Route key={p} path={p} element={<Navigate to="/" replace />} />)}
        <Route path="*" element={<Later title="Niet gevonden" text="Deze pagina bestaat niet." />} />
      </Route>
    </Routes>
    </ChatProvider>
    </AdminProvider>
    </CoachProvider>
    </BookingProvider>
  );
}
