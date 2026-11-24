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

- **Stap 0 klaar (24 november 2026):** project, tokens, bouwstenen, navigatie per rol, pagina Stijl en drie
  voorbeeldschermen met verzonnen gegevens (`/stijl/klant`, `/stijl/coach`, `/stijl/admin`): die tonen hoe Start,
  Vandaag en Overzicht bedoeld zijn en blijven als voorbeeld staan tot de echte schermen er zijn.
- **Stap 1 klaar (24 november 2026):** inloggen, account maken (met bevestiging per mail en "stuur opnieuw"),
  wachtwoord vergeten en een nieuw wachtwoord kiezen via de link uit de mail, uitloggen.
  - `src/lib/supabase.ts`: de verbinding, `call(fn, args)` voor databankfuncties en `friendly()` (foutmeldingen in
    het Nederlands). `mailReturn` leest wat een link uit een mail meebracht (Supabase zet dat na de `#`, waar ook
    onze schermen staan), vóór de router het adres ziet.
  - `src/lib/account.tsx`: `useAccount()` geeft de status (`loading`, `visitor`, `in`), het account (`my_data`), de
    rollen en de acties. De rol komt uit het account: trainerkaart gekoppeld = coach, in `admin_emails` = admin,
    anders klant. Wie coach én admin is, kiest de weergave op zijn profiel (bewaard op het toestel, `lum.weergave`).
  - `src/pages/Toegang.tsx` (de vier schermen), `Start.tsx` (begroeting; voor een klant zijn echte XP en level),
    `Profiel.tsx` (naam, adres, rol, weergave, uitloggen). Een bezoeker ziet alleen inloggen, account maken,
    wachtwoord vergeten en de pagina Stijl.
  - De oude en de nieuwe site staan op hetzelfde domein en delen dus de login van Supabase: wie op de ene inlogt,
    is het ook op de andere.
- **Volgende: stap 2**, de klant: Start (volgende sessie, coaches) en een sessie boeken.
- **Pieter moet nog:** in Supabase → Authentication → URL Configuration het adres
  `https://pieterrvds.github.io/level-up-movement/` toevoegen bij "Redirect URLs". Tot dan komen de links uit de
  bevestigingsmail en uit "wachtwoord vergeten" uit op de oude site.
- **Getest** (Playwright, 390, 360 en 1280 px) tegen een nagebouwde Supabase met de echte `schema.sql`: 42
  controles van stap 1. **Niet getest:** de echte Supabase, echte mails (bevestigen, wachtwoord vergeten), echte
  telefoons en Safari.
- **Nog te beslissen:** wat een bezoeker ziet vóór hij inlogt (nu meteen het inlogscherm; de oude site heeft een
  homepage met uitleg en coaches), en waar de privacytekst komt (de link wijst nu naar de oude site).
