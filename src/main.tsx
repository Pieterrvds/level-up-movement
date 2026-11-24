import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import "./lib/supabase"; // first: it reads what a link from an email brought along, before the router looks at the address
import { AccountProvider } from "./lib/account";
import App from "./App";
import { registerWorker } from "./lib/push";

// The service worker shows notifications. Tapping one while the app is open: it tells the app which screen to show.
registerWorker();
navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data?.type === "open" && typeof e.data.hash === "string") window.location.hash = e.data.hash; });

// HashRouter: the site is static (GitHub Pages), so the address after # decides the screen.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AccountProvider>
        <App />
      </AccountProvider>
    </HashRouter>
  </StrictMode>,
);
