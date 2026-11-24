// The health questions: asked before a first session and again after a year. Only the coach sees the answers.
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Check, Notice, Page, Switch, TextArea } from "../ui";
import { useAccount } from "../lib/account";
import { call, friendly } from "../lib/supabase";

const PRIVACY = "https://pieterrvds.github.io/LEVEL-UP-/privacy.html";
// the same eight questions, in the same order, as the old site (q1 … q8 on the server)
export const QUESTIONS: [string, string][] = [
  ["q1", "Heeft een arts ooit gezegd dat je een hartprobleem of hoge bloeddruk hebt?"],
  ["q2", "Voel je pijn in je borst in rust, in het dagelijks leven of tijdens het sporten?"],
  ["q3", "Verlies je je evenwicht door duizeligheid, of ben je de laatste 12 maanden flauwgevallen?"],
  ["q4", "Heb je een bot-, gewrichts- of spierprobleem (rug, knie, schouder…) dat erger kan worden door te sporten?"],
  ["q5", "Neem je medicatie voor een aandoening (bv. bloeddruk, diabetes, astma, epilepsie)?"],
  ["q6", "Ben je zwanger, of ben je de laatste 6 maanden bevallen?"],
  ["q7", "Had je de laatste 12 maanden een operatie of een zware blessure?"],
  ["q8", "Is er een andere reden waarom je niet zou mogen sporten?"],
];

export default function Gezondheid() {
  const { player, reload } = useAccount();
  const navigate = useNavigate();
  const back = useSearchParams()[0].get("terug") || "/";
  const prev = player?.healthForm;
  const [answers, setAnswers] = useState<Record<string, boolean>>(() => Object.fromEntries(QUESTIONS.map(([k]) => [k, Boolean(prev?.answers?.[k])])));
  const [notes, setNotes] = useState(prev?.notes || "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const anyYes = Object.values(answers).some(Boolean);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (anyYes && notes.trim().length < 3) { setError("Je antwoordde ja: vertel je coach er wat meer over."); return; }
    if (!consent) { setError("Vink onderaan aan dat je eerlijk geantwoord hebt."); return; }
    setBusy(true); setError("");
    try {
      await call("save_health_form", { p_answers: answers, p_notes: notes, p_name: player?.name || "" });
      await reload();
      navigate(back.startsWith("/") ? back : "/", { replace: true });
    } catch (err) { setError(friendly(err)); setBusy(false); }
  };
  return (
    <Page title="Even je gezondheid" text={prev ? "Je antwoorden zijn meer dan een jaar oud. Kijk ze even na." : "Acht korte vragen, één keer per jaar. Alleen je coach ziet je antwoorden."}>
      <form onSubmit={save} noValidate className="grid gap-4">
        <Card pad={false} className="divide-y divide-line">
          {QUESTIONS.map(([k, q]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-5 py-4">
              <p className="text-[15px]">{q}</p>
              <span className="flex shrink-0 items-center gap-2"><span className={`w-7 text-right text-sm font-semibold ${answers[k] ? "text-accent-ink" : "text-muted"}`}>{answers[k] ? "Ja" : "Nee"}</span>
                <Switch checked={answers[k]} onChange={(on) => setAnswers({ ...answers, [k]: on })} label={q} /></span>
            </div>
          ))}
        </Card>
        {anyYes && (
          <Card>
            <TextArea label="Je antwoordde ja: vertel je coach wat meer" hint="Wat, sinds wanneer, wat je beter vermijdt." maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-4"><Notice tone="warn">Met een ja-antwoord raden we aan om voor je eerste sessie even je arts te raadplegen.</Notice></div>
          </Card>
        )}
        <Card>
          <Check checked={consent} onChange={setConsent}>Ik heb eerlijk geantwoord. Ik train op eigen risico, volg de instructies van mijn coach en meld het als mijn gezondheid verandert. LEVEL-UP gebruikt deze antwoorden enkel om mij veilig te begeleiden.</Check>
          <p className="mt-3 text-sm text-muted">Hoe we met je gegevens omgaan: <a href={PRIVACY} target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline underline-offset-4">privacyverklaring</a>.</p>
        </Card>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Bezig…" : "Bewaar en ga verder"}</Button>
          <Button variant="ghost" size="lg" onClick={() => navigate(-1)}>Terug</Button>
        </div>
      </form>
    </Page>
  );
}
