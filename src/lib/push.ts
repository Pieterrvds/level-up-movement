// Notifications on this device. The service worker (public/sw.js) shows them; the server keeps one subscription per
// device (save_push_subscription) and the Edge Function "push" sends. The same server and keys as the old site.
import { call, pushSetup } from "./supabase";

/** on / off: this device. denied: blocked in the browser. unsupported: this browser can't. ios-install: an iPhone
 *  only gets notifications in the app on the home screen. */
export type PushState = "on" | "off" | "denied" | "unsupported" | "ios-install";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function registerWorker() {
  if ("serviceWorker" in navigator) void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
const registration = async (): Promise<ServiceWorkerRegistration | null> =>
  supported() ? Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))]) : null;
const subscription = async () => (await registration())?.pushManager.getSubscription().catch(() => null) ?? null;

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && (await subscription()) ? "on" : "off";
}

const keyBytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => Boolean(a) && a!.byteLength === b.byteLength && new Uint8Array(a!).every((v, i) => v === b[i]);
async function save(sub: PushSubscription) {
  const j = sub.toJSON();
  await call("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_user_agent: navigator.userAgent.slice(0, 200) });
}

/** Turn notifications on for this device; a test message follows. Throws with a line a person can read. */
export async function enablePush() {
  if (isIOS() && !isStandalone()) throw new Error("Zet LEVEL-UP eerst op je beginscherm en zet de meldingen daar aan.");
  if (!supported()) throw new Error("Deze browser kan geen meldingen tonen.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Meldingen zijn geblokkeerd. Sta ze toe voor deze site in de instellingen van je browser of telefoon.");
  const key = (await call<string | null>("push_public_key").catch(() => null)) || (await pushSetup());
  if (!key) throw new Error("Meldingen staan nog niet aan op de server. Probeer het later opnieuw.");
  const reg = await registration();
  if (!reg) throw new Error("Herlaad de pagina en probeer opnieuw.");
  const bytes = keyBytes(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, bytes)) { await sub.unsubscribe(); sub = null; }
  try { sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }); }
  catch { throw new Error("Meldingen aanzetten lukt niet op dit toestel. Probeer het later opnieuw."); }
  await save(sub);
  await call("push_test");
}

/** Notifications off for this device (the account keeps its other devices) */
export async function disablePush() {
  const sub = await subscription();
  if (!sub) return;
  await call("delete_push_subscription", { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** After logging in: a device that already has notifications on belongs to this account now */
export async function syncPush() {
  if (!supported() || Notification.permission !== "granted") return;
  const sub = await subscription();
  if (sub) await save(sub).catch(() => {});
}
/** Before logging out: this device no longer gets the notifications of this account */
export async function unlinkPush() {
  if (!supported() || Notification.permission !== "granted") return;
  const sub = await subscription();
  if (sub) await call("delete_push_subscription", { p_endpoint: sub.endpoint }).catch(() => {});
}
