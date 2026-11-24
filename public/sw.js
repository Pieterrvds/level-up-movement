// LEVEL-UP movement service worker: shows the notifications the server sends and opens the right screen.
// It keeps no copies of the app: every screen always comes from the network, so there is never an old version.
// The server writes its notifications in English and names the pages of the old site (it serves both sites).
// push-nl.js is the Dutch dictionary of the old site (a copy of its i18n-nl.js); route() knows where each old
// page lives in this app.
try { importScripts("push-nl.js"); } catch { /* no dictionary: the English text shows */ }
const nl = (s) => (s && self.LEVELUP_NL ? self.LEVELUP_NL.translate(s) ?? s : s);

function route(url) {
  const u = String(url || "");
  const chat = u.match(/chat\.html\?t=([0-9a-f-]{8,})/i);
  if (chat) return "#/chat/" + chat[1];
  if (/chat\.html/.test(u)) return "#/chat";
  if (/profile\.html#coach|admin\.html/.test(u)) return "#/";             // the coach's and the admin's own start
  if (/profile\.html#(overview|classes|rewards)/.test(u)) return "#/sessies";
  if (/index\.html#schedule/.test(u)) return "#/boeken";
  if (/profile\.html/.test(u)) return "#/profiel";
  return "#/";
}
self.route = route; // for the tests

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { body: event.data && event.data.text() }; }
  const tag = msg.tag || "";
  const chat = /^chat-/.test(tag);   // a chat message: people's own words, never translated
  const note = /^note-/.test(tag);   // the title is ours, the text is someone's own words
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const here = open.filter((c) => c.url.startsWith(self.registration.scope));
    here.forEach((c) => c.postMessage({ type: "push", tag })); // open screens refresh right away
    // already reading this conversation: no notification needed
    if (chat && here.some((c) => c.focused && c.visibilityState === "visible" && c.url.includes("#/chat/" + tag.slice(5)))) return;
    await self.registration.showNotification((chat ? msg.title : nl(msg.title)) || "LEVEL-UP", {
      body: (chat || note ? msg.body : nl(msg.body)) || "",
      icon: "icons/icon-192.png",
      badge: "icons/badge-96.png",
      tag: tag || undefined,
      renotify: Boolean(tag),
      data: { hash: route(msg.url) },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.hash) || "#/";
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const tab = open.find((c) => c.url.startsWith(self.registration.scope));
    if (tab) {
      await tab.focus().catch(() => {});
      tab.postMessage({ type: "open", hash }); // the app goes there itself (only the part after # changes)
      return;
    }
    return self.clients.openWindow(self.registration.scope + hash);
  })());
});
