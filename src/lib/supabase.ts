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
  [/This request has already been handled/, "Deze aanvraag is al behandeld."],
  [/This request expired/, "Deze aanvraag is verlopen: ze werd niet op tijd beantwoord."],
  [/This session time has already passed/, "Dit uur is al voorbij."],
  [/You can reward a session from the day itself/, "Afronden kan vanaf de dag van de sessie."],
  [/The session hasn't started yet/, "De sessie is nog niet begonnen."],
  [/This session has already been rewarded/, "Deze sessie is al afgerond."],
  [/window has passed/, "Dit is te lang geleden. Vraag de beheerder om deze sessie af te ronden."],
  [/These hours are already booked or requested: (.+)\. Cancel or move/, (m) => `Deze uren zijn al geboekt of aangevraagd: ${m[1]}. Verplaats of annuleer die sessies eerst.`],
  [/The end time must be after the start time/, "Het einduur moet na het beginuur liggen."],
  [/Pick today or a date in the future/, "Kies vandaag of een latere dag."],
  [/Choose a weekday or a date/, "Kies een weekdag of een datum."],
  [/These hours no longer exist/, "Deze uren bestaan niet meer."],
  [/Pick another day or hour/, "Kies een andere dag of een ander uur."],
  [/Pick a moment that is still to come/, "Kies een moment dat nog moet komen."],
  [/Pick a day within six months/, "Kies een dag binnen zes maanden."],
  [/That moment is already taken/, "Dat moment is al bezet."],
  [/is not possible: (.+)\.$/, (m) => `Dat moment kan niet: ${m[1]}.`],
  [/Only a session that is still to come can be moved/, "Alleen een sessie die nog moet komen, kan je verplaatsen."],
  [/Only (an admin or )?the (trainer|coach)/, "Dit kan alleen de coach zelf of de beheerder."],
  [/This group class was cancelled|This class was cancelled/, "Deze les is geannuleerd."],
  [/This (group )?class has already started/, "Deze les is al begonnen."],
  [/isn't open for sign-ups yet/, "Voor deze les kan je nog niet inschrijven."],
  [/You lead this class/, "Je geeft deze les zelf."],
  [/already signed up for this class/, "Je bent al ingeschreven voor deze les."],
  [/too late to sign up again/, "Je schreef je te laat uit om opnieuw in te schrijven."],
  [/refund for this class is still open/, "Je terugbetaling voor deze les loopt nog. Vraag het ter plaatse."],
  [/Sign-up not found|This sign-up can no longer be cancelled/, "Deze inschrijving kan je niet meer wijzigen."],
  [/Group class not found/, "Deze les vinden we niet meer."],
  [/Give the class a name/, "Geef de les een naam (2 tot 40 tekens)."],
  [/Pick a date and a start time/, "Kies een dag en een beginuur."],
  [/A class lasts between/, "Een les duurt tussen 15 en 240 minuten."],
  [/A class has between/, "Een les heeft tussen 2 en 60 plaatsen."],
  [/Plan a group class at least 1 hour ahead/, "Plan een les minstens 1 uur vooraf."],
  [/already has a group class at that time/, "Je hebt dan al een groepsles."],
  [/has a 1:1 session at that time/, "Je hebt dan al een sessie met een klant."],
  [/The gym is not free at that time: (.+)\.$/, (m) => `De zaal is dan niet vrij: ${m[1]}.`],
  [/tick people off from 30 minutes before/, "Aanvinken kan vanaf 30 minuten voor de start."],
  [/isn't signed up anymore/, "Deze persoon is niet meer ingeschreven."],
  [/This class is already finished/, "Deze les is al afgerond."],
  [/The class hasn't started yet/, "De les is nog niet begonnen."],
  [/This class can no longer be cancelled/, "Deze les kan je niet meer annuleren."],
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
