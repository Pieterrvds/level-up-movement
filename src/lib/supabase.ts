// The connection with Supabase: the same project and the same database functions as the old LEVEL-UP site.
// Only the publishable key lives here; it is meant for the browser. Every other key stays on the server.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zdwlihbsmqiggpyensxc.supabase.co";
const SUPABASE_KEY = "sb_publishable_sG2smuMtYS_T5Xz1HAPOMA_p70i8nJX";

// What a link from an email brought along, read before anything else touches the address. The site uses the part
// after # for its screens, and Supabase puts its answer there too (#access_token=… or #error=…).
const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
export const mailReturn = {
  /** "recovery": the link of "forgot my password"; "signup": the link that confirms a new account */
  type: hash.get("access_token") ? hash.get("type") || "signup" : "",
  /** the link no longer works (used twice, or too old) */
  failed: Boolean(hash.get("error") || hash.get("error_code")),
};
if (mailReturn.failed) window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/inloggen");

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** The address of this site without the screen: where the links in our emails come back to */
export const siteUrl = () => window.location.origin + window.location.pathname;

// The database answers in English (the old site translates it too). What a client can run into while booking:
const SERVER: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/Someone just booked this slot/, "Iemand heeft dit uur net geboekt. Kies een ander uur."],
  [/You already have a session at this time/, "Je hebt op dit moment al een sessie."],
  [/The gym is full at that time/, "De zaal is op dat uur volzet. Kies een ander uur."],
  [/leads a group class at that time/, "Deze coach geeft dan een groepsles. Kies een ander uur."],
  [/^(.+) is away for now/, (m) => `${m[1]} is even afwezig en neemt geen nieuwe boekingen aan.`],
  [/at least (\d+) hours in advance/, (m) => `Boeken kan tot ${m[1]} uur voor de start.`],
  [/up to (\d+) weeks ahead/, (m) => `Je kan tot ${m[1]} weken vooruit boeken.`],
  [/time slot has already passed/, "Dit uur is al voorbij."],
  [/This trainer is not available/, "Deze coach is niet beschikbaar."],
  [/Fill in the health questionnaire/, "Vul eerst de gezondheidsvragen in."],
  [/Type your full name to sign/, "Je naam ontbreekt in je account."],
  [/You answered yes to a question/, "Je antwoordde ja: vertel je coach er wat meer over."],
  [/This session can no longer be cancelled/, "Deze sessie kan je niet meer annuleren."],
  [/This session has already started/, "Deze sessie is al begonnen."],
  [/Booking not found/, "Deze sessie vinden we niet meer."],
  [/This pack is not available/, "Dit pakket bestaat niet meer."],
  [/already (asked for|have) a pack|pack request/i, "Je hebt al een pakket aangevraagd."],
  [/Pick a day and a month/, "Kies een dag en een maand."],
  [/That day does not exist/, "Die dag bestaat niet."],
  [/Invalid photo/, "Deze foto konden we niet bewaren."],
  [/bucket/i, "Foto's opladen staat nog niet aan. Probeer het later opnieuw."],
  [/first week|is already taken|not free/i, "Dit uur is de eerste week al bezet. Kies een ander uur."],
  [/Log in (first|to book)/, "Log eerst in."],
];

/** What went wrong, in words for a person. Unknown messages from the server pass as they are. */
export function friendly(error: unknown): string {
  const text = String((error as { message?: string })?.message || error || "");
  for (const [re, nl] of SERVER) { const m = text.match(re); if (m) return typeof nl === "string" ? nl : nl(m); }
  if (/invalid login|invalid_credentials/i.test(text)) return "E-mail of wachtwoord klopt niet.";
  if (/not confirmed/i.test(text)) return "Bevestig eerst je e-mail: klik op de link in de mail die we je stuurden.";
  if (/already registered|already exists/i.test(text)) return "Er bestaat al een account met dit e-mailadres. Log in.";
  if (/rate limit|security purposes|too many/i.test(text)) return "Even wachten: probeer het over een minuut opnieuw.";
  if (/same password|different from the old/i.test(text)) return "Kies een ander wachtwoord dan je vorige.";
  if (/password/i.test(text) && /least|short|weak/i.test(text)) return "Kies een wachtwoord van minstens 8 tekens.";
  if (/failed to fetch|network|load failed/i.test(text)) return "Geen verbinding. Kijk je internet na en probeer opnieuw.";
  if (/session|jwt|token/i.test(text) && /missing|expired|invalid/i.test(text)) return "Je bent uitgelogd. Log opnieuw in.";
  return text || "Er ging iets mis. Probeer het opnieuw.";
}

/** Call a database function. Throws an Error with a message a person can read. */
export async function call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data as T;
}
