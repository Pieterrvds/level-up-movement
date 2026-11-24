# LEVEL-UP movement

De nieuwe voorkant van LEVEL-UP: klanten boeken een personal trainer, coaches beheren hun agenda, de admin het team.
Licht en rustig, op dezelfde databank (Supabase) als de oude site in `Pieterrvds/LEVEL-UP-`.

- Live: https://pieterrvds.github.io/level-up-movement/
- Blauwdruk en bouwvolgorde: `HERSTART.md`. Afspraken, stijlregels en stand van zaken: `CLAUDE.md`.

## Werken

```
npm install
npm run dev               # lokaal bekijken
npm run build             # controleert de types en schrijft de site naar dist/
bash scripts/publish.sh   # bouwt en zet dist/ op de branch gh-pages (= live)
```

De branch `main` bevat de bron, de branch `gh-pages` alleen de gebouwde site. GitHub Pages serveert `gh-pages`
(Settings → Pages → "Deploy from a branch" → `gh-pages`, map `/`).
