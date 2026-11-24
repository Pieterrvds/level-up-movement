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

## Voor wie: breder dan personal training

De coaches op het platform zijn heel verschillend: personal trainers, yoga, massage, kinesisten, diëtisten, dans,
workshops, Hyrox, boksen, judo, revalidatie … Ze boeken een plaats in de grote zaal of geven hun sessie waar ze
willen; het platform verbindt hen met klanten. Gevolgen voor alles wat gebouwd wordt:

- Zeg **coach** en **sessie** (of les, afspraak), nooit "personal trainer" of "training" als algemeen woord.
- **Wat** iemand geeft, komt altijd uit de gegevens (het label op de uren van de coach, de soorten les), nooit uit
  een vaste lijst in de code. Uren zonder label heten "Personal training" (`NO_KIND`), zoals op de oude site.
- De **plaats** is even belangrijk als het uur: toon ze overal waar een sessie staat.
- Bouw niets dat alleen voor sport klopt (bv. vaste sportwoorden in knoppen of lege schermen).

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
- **Stap 2 klaar (24 november 2026):** de klant ziet zijn start en vraagt een sessie aan.
  - `src/lib/booking.tsx`: `useBooking()` laadt één keer de coaches (`trainer_list`), hun uren
    (`trainer_hours_list`), wat bezet is (`slot_status`) en de prijzen (`pricing_info`), en rekent uit welke uren
    vrij zijn. Dezelfde regels als de server (`_book`): open uren min gesloten dagen, coach actief, minstens 12 uur
    vooraf, hoogstens 4 weken vooruit, niet bezet, en de zaal niet vol als de sessie in de grote zaal is.
    `quote()` zegt wat het kost: met een pakket, gratis eerste sessie, of de prijs van de coach.
  - `src/pages/Start.tsx`: volgende sessie (wat, met wie, wanneer, waar, status), vooruitgang, de coaches (actief
    en met vrije uren eerst). `src/pages/Boeken.tsx`: 1. lijst van coaches met een rij "soorten" om te filteren,
    2. een coach: dag kiezen, dan een uur (per soort en plaats), 3. venster "Sessie aanvragen" (`book_session`,
    betalen ter plaatse). Het gekozen uur staat in het adres (`?dag=…&uur=…`) en telt alleen voor die dag.
  - `src/pages/Gezondheid.tsx`: de acht gezondheidsvragen (`save_health_form`), verplicht voor een eerste sessie
    en na een jaar opnieuw; daarna keert de klant terug naar het gekozen uur.
  - `friendly()` vertaalt de Engelse antwoorden van de databank bij het boeken naar het Nederlands.
  - De foto en titel van de eerste drie coaches stonden in de code van de oude site; `FIRST` in `booking.tsx` vult
    ze in tot hun kaart in de databank is aangepast (Admin → Team → Edit op de oude site).
- **Stap 3 klaar (24 november 2026):** mijn sessies, wekelijkse sessies, pakketten en het profiel.
  - `src/pages/Sessies.tsx` (`/sessies`): Komend en Voorbij. Een sessie opent in een venster: "Zet in mijn agenda"
    (een .ics-bestand, `calendarFile` in `lib/dates.ts`) en "Annuleren" (`cancel_booking`, altijd met een tweede
    tik). Na `freeCancelUntil` zegt het venster dat een bevestigde sessie aangerekend wordt. Een klant kan niet
    zelf verplaatsen: `move_booking` is op de server alleen voor de coach; hij annuleert en boekt opnieuw.
  - Wekelijks: in het venster "Sessie aanvragen" kiest de klant "Eén keer" of "Elke week" (`book_series`, zonder
    einddatum). In "Mijn sessies" staat ze bovenaan met "Stoppen" (`series_stop`).
  - `src/pages/Profiel.tsx`: foto (vierkant gemaakt, bucket `avatars`, `set_avatar`), vooruitgang, pakketten
    (`request_pack`, `cancel_pack_request`; een betaald pakket telt vanzelf bij het boeken), en instellingen:
    gezondheidsvragen, geboortedag (`set_birthday`), wachtwoord wijzigen, uitloggen, account verwijderen
    (`delete_my_account`, met een tweede tik).
  - `ListRow` heeft `below`: iets onder de twee regels, voor een label dat te breed is om ernaast te staan.
  - Geleerd: na een geslaagde aanvraag mag niets het adres nog wijzigen (`leaving` in `Boeken.tsx`); het sluitende
    venster schreef anders soms over de stap naar Start heen.
  - **Nog niet in de nieuwe app** (wel op de oude site): een duosessie, een gratis beurt van de spaarkaart
    inzetten, je naam wijzigen (de server heeft daar geen functie voor), en de mail die de oude site bij een
    aanvraag via een externe dienst stuurt. De melding aan de coach doet de server zelf.
- **Volgende: stap 4**, de coach: Vandaag (actief of afwezig, te doen, de dag), Agenda en uren.
- **Getest** (Playwright, 390, 360 en 1280 px) tegen een nagebouwde Supabase met de echte `schema.sql`: 42
  controles van stap 1, 37 van stap 2 en 36 van stap 3. De tests staan niet in de repository (tijdelijke map van
  de sessie). **Niet getest:** de echte Supabase, echte mails, echte meldingen, het echte opladen van een foto,
  het agendabestand op een telefoon, echte telefoons en Safari.
- **Nog te beslissen:** wat een bezoeker ziet vóór hij inlogt (nu meteen het inlogscherm; de oude site heeft een
  homepage met uitleg en coaches), en waar de privacytekst komt (de link wijst nu naar de oude site).
