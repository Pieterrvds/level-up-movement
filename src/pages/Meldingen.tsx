// Notifications: one switch for this device, two choices of the account (chat messages, news).
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { ListRow, Notice, Sheet, Switch } from "../ui";
import { useAccount } from "../lib/account";
import { call, friendly } from "../lib/supabase";
import { disablePush, enablePush, pushState } from "../lib/push";
import type { PushState } from "../lib/push";

const WHY: Partial<Record<PushState, string>> = {
  "ios-install": "Op een iPhone werken meldingen in de app op je beginscherm. Tik in Safari op Deel en kies \"Zet op beginscherm\". Open LEVEL-UP daar en zet de meldingen hier aan.",
  denied: "Meldingen zijn geblokkeerd voor LEVEL-UP. Sta ze toe in de instellingen van je browser of telefoon en kom dan terug.",
  unsupported: "Deze browser kan geen meldingen tonen. Probeer Chrome, Edge, Firefox of Safari.",
};

/** The row under "Instellingen" and the window it opens */
export default function Meldingen() {
  const { player, reload } = useAccount();
  const [state, setState] = useState<PushState | "">("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  useEffect(() => { void pushState().then(setState, () => setState("unsupported")); }, []);
  if (!player) return null;
  const on = state === "on";
  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true); setError(""); setFlash("");
    try { await action(); setFlash(ok); } catch (e) { setError(friendly(e)); }
    setState(await pushState().catch(() => "unsupported" as const));
    setBusy(false);
  };
  const why = state ? WHY[state] : undefined;
  return (
    <>
      <ListRow lead={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken text-muted"><Bell size={20} /></span>} title="Meldingen"
        text={on ? "Aan op dit toestel" : state === "" ? "Even kijken…" : "Uit op dit toestel"} onClick={() => { setError(""); setFlash(""); setOpen(true); }} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Meldingen">
        <div className="-mx-5 -my-4 divide-y divide-line">
          <ListRow wrap chevron={false} title="Op dit toestel" text={`Je sessies: bevestigd, verplaatst, de herinnering de dag voordien${player.trainerId ? ", en nieuwe aanvragen van je klanten" : ""}.`}
            trail={<Switch checked={on} label="Meldingen op dit toestel" onChange={(v) => { if (!busy && !why) void run(v ? enablePush : disablePush, v ? "Meldingen staan aan. Er is een testbericht onderweg." : "Meldingen staan uit op dit toestel."); }} />} />
          {why && <div className="px-5 py-3"><Notice tone="warn">{why}</Notice></div>}
          <ListRow wrap chevron={false} title="Chatberichten" text="Een melding als iemand je een bericht stuurt."
            trail={<Switch checked={player.pushChat !== false} label="Meldingen van chatberichten" onChange={(v) => { if (!busy) void run(async () => { await call("set_push_chat", { p_on: v }); await reload(); }, ""); }} />} />
          <ListRow wrap chevron={false} title="Nieuws" text="Nieuwe lessen en aankondigingen, hoogstens 2 per dag."
            trail={<Switch checked={player.pushNews !== false} label="Meldingen van nieuws" onChange={(v) => { if (!busy) void run(async () => { await call("set_push_news", { p_on: v }); await reload(); }, ""); }} />} />
          {!on && !why && state !== "" && <p className="px-5 py-3 text-sm text-muted">Chatberichten en nieuws komen pas als meldingen op dit toestel aanstaan.</p>}
          {error && <div className="px-5 py-3"><Notice tone="danger">{error}</Notice></div>}
          {flash && <div className="px-5 py-3"><Notice>{flash}</Notice></div>}
        </div>
      </Sheet>
    </>
  );
}
