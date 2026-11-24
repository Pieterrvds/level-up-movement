// A message for every member: it goes out as a notification (to who has them on) and stays in the news list.
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardHead, Empty, Field, List, ListRow, Notice, Page, TextArea } from "../ui";
import { call, friendly } from "../lib/supabase";
import { shortWhen } from "../lib/chat";

type News = { id: number; kind: string; title: string; body: string; date: string };

export default function Nieuws() {
  const navigate = useNavigate();
  const [list, setList] = useState<News[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const load = useCallback(() => call<{ news: News[] }>("pricing_info").then((p) => setList(p?.news || []), (e) => setError(friendly(e))), []);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (title.trim().length < 3) { setError("Geef je bericht een titel van minstens 3 tekens."); return; }
    setBusy(true); setError(""); setFlash("");
    try {
      const r = await call<{ reached: number }>("admin_announce", { p_title: title.trim(), p_body: body.trim(), p_url: "index.html" });
      const n = Number(r?.reached) || 0;
      setTitle(""); setBody("");
      setFlash(`Verstuurd. ${n === 1 ? "1 melding is" : `${n} meldingen zijn`} onderweg.`);
      await load();
    } catch (err) { setError(friendly(err)); }
    setBusy(false);
  };
  const remove = async (n: News) => {
    setError(""); setFlash("");
    try { await call("admin_delete_news", { p_id: n.id }); await load(); setFlash("Verwijderd uit het nieuws. Meldingen die al verstuurd zijn, blijven verstuurd."); } catch (err) { setError(friendly(err)); }
  };

  return (
    <Page title="Nieuws" text="Een bericht voor alle leden.">
      <div><Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate("/meer")} className="-ml-3">Meer</Button></div>
      <Card>
        <CardHead title="Nieuw bericht" hint="Wie meldingen aan heeft, krijgt het op het toestel. Hoogstens 3 per dag, niets 's nachts." />
        <div className="grid gap-4">
          <Field label="Titel" maxLength={60} placeholder="bv. Zaterdag opendeurdag" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="Bericht (mag leeg blijven)" rows={3} maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} />
          {error && <Notice tone="danger">{error}</Notice>}
          {flash && <Notice>{flash}</Notice>}
          <div><Button icon={<Megaphone size={18} />} disabled={busy} onClick={() => void send()}>{busy ? "Bezig…" : "Verstuur naar alle leden"}</Button></div>
        </div>
      </Card>
      <div>
        <h2 className="mb-2 px-1 text-lg font-semibold">Laatste nieuws</h2>
        {!list ? <p role="status" className="py-6 text-center text-sm text-muted">Even laden…</p> : list.length ? (
          <List>
            {list.map((n) => (
              <ListRow key={n.id} wrap title={n.title} text={n.body || undefined}
                trail={<span className="grid shrink-0 justify-items-end gap-1"><span className="text-xs text-muted">{shortWhen(n.date)}</span><Button variant="ghost" size="sm" onClick={() => void remove(n)}>Verwijder</Button></span>} />
            ))}
          </List>
        ) : <Card pad={false}><Empty title="Nog geen nieuws" text="Wat je verstuurt, en nieuwe groepslessen die een coach aankondigt, staat hier 14 dagen." /></Card>}
      </div>
    </Page>
  );
}
