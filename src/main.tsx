import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import "./lib/supabase"; // first: it reads what a link from an email brought along, before the router looks at the address
import { AccountProvider } from "./lib/account";
import App from "./App";

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
