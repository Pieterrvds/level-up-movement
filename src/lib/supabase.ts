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

/** What went wrong, in words for a person. Unknown messages from the server pass as they are. */
export function friendly(error: unknown): string {
  const text = String((error as { message?: string })?.message || error || "");
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
