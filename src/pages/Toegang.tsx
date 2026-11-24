// Getting in: log in, make an account, forgot my password, choose a new password.
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button, Card, Field, Notice, PasswordField } from "../ui";
import { useAccount, validEmail } from "../lib/account";
import { friendly, mailReturn } from "../lib/supabase";

const PRIVACY = "https://pieterrvds.github.io/LEVEL-UP-/privacy.html"; // the privacy text lives on the current site for now
const LinkText = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} className="font-semibold text-accent-ink underline underline-offset-4">{children}</Link>;

function Head({ title, text }: { title: string; text?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-[28px] leading-tight font-semibold sm:text-4xl">{title}</h1>
      {text && <p className="mt-2 text-muted">{text}</p>}
    </header>
  );
}

/** A form that shows what went wrong and keeps its button busy while it works */
function useForm(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  return { busy, error, setError, submit };
}

/** "Send it again", with a pause so nobody taps ten mails out */
function Resend({ send, label = "Stuur de mail opnieuw" }: { send: () => Promise<void>; label?: string }) {
  const [wait, setWait] = useState(0);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const go = async () => {
    setNote("");
    try { await send(); setNote("Verstuurd. Kijk ook in je map met ongewenste mail."); setWait(60); } catch (err) { setNote(friendly(err)); }
  };
  return (
    <div className="grid gap-2">
      <Button variant="secondary" block disabled={wait > 0} onClick={go}>{wait > 0 ? `Opnieuw sturen kan over ${wait} s` : label}</Button>
      {note && <p className="text-sm text-muted" role="status">{note}</p>}
    </div>
  );
}

function Sent({ title, email, children }: { title: string; email: string; children: ReactNode }) {
  return (
    <>
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-ink"><MailCheck size={26} aria-hidden /></span>
      <Head title={title} />
      <Card>
        <p>We stuurden een mail naar <strong className="break-all">{email}</strong>.</p>
        <div className="mt-4 grid gap-3">{children}</div>
      </Card>
      <p className="mt-6 text-center"><LinkText to="/inloggen">Terug naar inloggen</LinkText></p>
    </>
  );
}

export function Inloggen() {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const form = useForm(async () => {
    if (!validEmail(email)) throw new Error("Vul je e-mailadres in.");
    if (!password) throw new Error("Vul je wachtwoord in.");
    await account.logIn(email, password);
  });
  const unconfirmed = /Bevestig eerst/.test(form.error);
  return (
    <>
      <Head title="Welkom terug" text="Log in om te boeken en je sessies te zien." />
      {mailReturn.failed && <div className="mb-4"><Notice tone="warn">Die link werkt niet meer. Log in, of vraag een nieuwe link aan.</Notice></div>}
      <Card>
        <form onSubmit={form.submit} noValidate className="grid gap-4">
          <Field label="E-mailadres" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordField label="Wachtwoord" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {form.error && <Notice tone="danger">{form.error}</Notice>}
          {unconfirmed && <Resend send={() => account.resendConfirmation(email)} />}
          <Button type="submit" size="lg" block disabled={form.busy}>{form.busy ? "Bezig…" : "Inloggen"}</Button>
          <p className="text-center text-sm"><LinkText to="/wachtwoord-vergeten">Wachtwoord vergeten?</LinkText></p>
        </form>
      </Card>
      <p className="mt-6 text-center text-muted">Nog geen account? <LinkText to="/account-maken">Account maken</LinkText></p>
    </>
  );
}

export function AccountMaken() {
  const account = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const form = useForm(async () => {
    if (name.trim().length < 2) throw new Error("Vul je naam in.");
    if (!validEmail(email)) throw new Error("Vul een geldig e-mailadres in.");
    if (password.length < 8) throw new Error("Kies een wachtwoord van minstens 8 tekens.");
    if (await account.signUp(name, email, password)) setSent(true); // else: logged in at once, the app opens by itself
  });
  if (sent) {
    return (
      <Sent title="Bevestig je e-mail" email={email.trim().toLowerCase()}>
        <p className="text-muted">Klik op de link in die mail. Daarna kan je inloggen en je eerste sessie boeken.</p>
        <Resend send={() => account.resendConfirmation(email)} />
      </Sent>
    );
  }
  return (
    <>
      <Head title="Account maken" text="Eén minuut werk. Je eerste sessie is gratis." />
      <Card>
        <form onSubmit={form.submit} noValidate className="grid gap-4">
          <Field label="Naam" name="name" autoComplete="name" maxLength={24} hint="Zo zien je coach en andere leden je." value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="E-mailadres" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordField label="Wachtwoord" name="new-password" autoComplete="new-password" hint="Minstens 8 tekens." value={password} onChange={(e) => setPassword(e.target.value)} />
          {form.error && <Notice tone="danger">{form.error}</Notice>}
          <Button type="submit" size="lg" block disabled={form.busy}>{form.busy ? "Bezig…" : "Account maken"}</Button>
          <p className="text-center text-sm text-muted">Met een account ga je akkoord met de <a href={PRIVACY} target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline underline-offset-4">privacyverklaring</a>.</p>
        </form>
      </Card>
      <p className="mt-6 text-center text-muted">Al een account? <LinkText to="/inloggen">Inloggen</LinkText></p>
    </>
  );
}

export function WachtwoordVergeten() {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const form = useForm(async () => {
    if (!validEmail(email)) throw new Error("Vul het e-mailadres van je account in.");
    await account.requestPasswordReset(email);
    setSent(true);
  });
  if (sent) {
    return (
      <Sent title="Kijk in je mailbox" email={email.trim().toLowerCase()}>
        <p className="text-muted">Bestaat er een account met dit adres, dan staat er een link in om een nieuw wachtwoord te kiezen.</p>
        <Resend send={() => account.requestPasswordReset(email)} />
      </Sent>
    );
  }
  return (
    <>
      <Head title="Wachtwoord vergeten" text="We sturen je een link om een nieuw wachtwoord te kiezen." />
      <Card>
        <form onSubmit={form.submit} noValidate className="grid gap-4">
          <Field label="E-mailadres" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          {form.error && <Notice tone="danger">{form.error}</Notice>}
          <Button type="submit" size="lg" block disabled={form.busy}>{form.busy ? "Bezig…" : "Stuur mij een link"}</Button>
        </form>
      </Card>
      <p className="mt-6 text-center"><LinkText to="/inloggen">Terug naar inloggen</LinkText></p>
    </>
  );
}

/** After the link of "forgot my password": you are in, and choose a new password before anything else */
export function NieuwWachtwoord() {
  const account = useAccount();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const form = useForm(async () => {
    if (password.length < 8) throw new Error("Kies een wachtwoord van minstens 8 tekens.");
    await account.setPassword(password);
    navigate("/", { replace: true });
  });
  return (
    <>
      <Head title="Nieuw wachtwoord" text="Kies een nieuw wachtwoord voor je account." />
      <Card>
        <form onSubmit={form.submit} noValidate className="grid gap-4">
          <PasswordField label="Nieuw wachtwoord" name="new-password" autoComplete="new-password" hint="Minstens 8 tekens." value={password} onChange={(e) => setPassword(e.target.value)} />
          {form.error && <Notice tone="danger">{form.error}</Notice>}
          <Button type="submit" size="lg" block disabled={form.busy}>{form.busy ? "Bezig…" : "Bewaar wachtwoord"}</Button>
        </form>
      </Card>
    </>
  );
}
