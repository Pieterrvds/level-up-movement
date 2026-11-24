# LEVEL-UP movement: overdracht voor een nieuwe chat

Lees dit eerst, daarna `HERSTART.md` (de blauwdruk: wat er gebouwd wordt, in welke volgorde, met welke
databankfuncties). Dit is een eigen repository (`Pieterrvds/level-up-movement`). De oude site staat in
`Pieterrvds/LEVEL-UP-` en blijft live tot deze klaar is; daar staan ook `supabase/schema.sql` (de databank) en
`game.js` (hoe de oude site elke databankfunctie aanroept: het naslagwerk bij elk nieuw scherm).

## Wat het is

- De nieuwe, lichte voorkant van LEVEL-UP (personal training in Aalst, van Pieter). Zelfde Supabase-project
  (`zdwlihbsmqiggpyensxc`) en dezelfde databankfuncties als de oude site.
- React 19, Vite, TypeScript, Tailwind 4. `HashRouter`, want de site is statisch (GitHub Pages).
- Live: https://pieterrvds.github.io/level-up-movement/ (GitHub Pages serveert de branch `gh-pages`). De bron staat
  op `main`; `npm run build` schrijft de site naar `dist/` (niet in git) en `scripts/publish.sh` bouwt en zet `dist/`
  op `gh-pages`.

## Kaart van de code

- `src/index.css`: alle kleuren, het lettertype en de rondingen als tokens (`@theme`).
- `src/ui/index.tsx`: de bouwstenen (Button, Card, Field, Tabs, Chip, Badge, Avatar, ListRow, List, Progress, Stat,
  Switch, Notice, Empty, Sheet, Page).
- `src/shell/AppShell.tsx`: het kader: balk bovenaan en vier knoppen onderaan (telefoon), kolom links (computer).
- `src/nav.ts`: welke vier knoppen elke rol ziet.
- `src/pages/`: de schermen. `Stijl.tsx` toont alle bouwstenen; `Voorbeeld.tsx` zijn startschermen met verzonnen
  gegevens (verdwijnen als de echte schermen er zijn); `Later.tsx` is de plaatshouder voor wat nog komt.

## Stijlregels

1. Een scherm gebruikt alleen de bouwstenen uit `src/ui` en de tokens. Geen eigen kleur, schaduw of ronding op een
   scherm. Een nieuwe bouwsteen komt eerst in `src/ui` en op de pagina Stijl, en alleen na akkoord van Pieter.
2. Eén hoofdknop (donker) per scherm. De rest is `secondary` of `ghost`.
3. Groen is de enige accentkleur en betekent: actief, vooruitgang of gekozen. Oranje = wacht op iets, rood = fout
   of annuleren.
4. Eén lettertype (Inter), gewone hoofdletters, geen schuinschrift, geen tekst in hoofdletters.
5. Geen foto's achter tekst. Foto's alleen als afbeelding in een kaart of als profielfoto.
6. Maximaal vier knoppen in de navigatie per rol. Wat er niet bij past, zit één tik dieper.
7. Elke rij die zijwaarts schuift, gebruikt de klasse `slide-x` (kan niet op en neer bewegen).
8. Teksten: Nederlands, kort, gewone woorden, één boodschap per regel. Een leeg scherm zegt in één zin wat er komt
   en heeft één knop.

## Vaste afspraken

1. Antwoord Pieter in het Nederlands (Vlaams), in gewone woorden, kort.
2. Een afgewerkte en geteste stap wordt gecommit en gepusht naar `main`, en daarna gepubliceerd met
   `bash scripts/publish.sh` (bouwt en pusht naar `gh-pages` = live). Controleer met `git ls-remote origin` dat
   `main` en `gh-pages` zijn bijgewerkt. Geen pull request tenzij gevraagd.
3. De echte databank kan je niet bekijken of wijzigen. Een wijziging aan `supabase/schema.sql` (in de oude
   repository) voert Pieter zelf uit in de Supabase SQL Editor; bouw liever op wat er al is.
4. Alleen de publishable key van Supabase staat in de code. Vraag of gebruik nooit de service_role key, het
   databankwachtwoord, of sleutels van Mollie, VAPID of Anthropic.
5. Stuur nooit het e-mailadres of andere gegevens van Pieter naar externe diensten. Wachtwoorden uit een chat komen
   nooit in de repo.
6. Controleer elke stap op 390 en 360 px en op de computer (Playwright, Chromium is voorgeïnstalleerd), met
   schermbeelden: niets breder dan het scherm, geen afgesneden tekst. Zeg eerlijk wat getest is en wat niet.
7. Commits: Engelse boodschap die zegt wat er voor de gebruiker verandert; geen modelnamen.
8. "Voer nog niet uit, leg uit" betekent alleen uitleg, geen code.

## Stand van zaken

- **Stap 0 klaar (24 november 2026):** project, tokens, bouwstenen, navigatie per rol, pagina Stijl, drie
  voorbeeldschermen (klant, coach, admin) met verzonnen gegevens. De rol kies je nu op de pagina Stijl; ze wordt op
  het toestel bewaard (`lum.voorbeeldrol`).
- **Volgende: stap 1**, inloggen en account maken met Supabase Auth; de rol komt dan uit het account
  (`my_data`: is er een trainerkaart gekoppeld, is het een admin) en de keuze op de pagina Stijl vervalt.
- Nog niet getest: echte telefoons en Safari. Er is nog geen verbinding met Supabase.
