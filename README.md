# Haakhuis · Carnaval Atelier — prototype

Twee prototypes van een carnavalskleding-configurator voor [Haakhuis](https://www.haakhuis.nl) (Landgraaf), gebouwd als statische website in de Haakhuis-huisstijl. De kledingstukken zijn **echte fotorealistische jassen** (ghost-mannequin productfotografie) waarvan de onderdelen vrij te combineren zijn.

## Bekijken

**Live bekijken:** https://bob-ibe.github.io/haakhuis-prototype/

Dubbelklikken op `index.html` werkt (de kalibratie is voorgebakken), maar een webserver is aan te raden — dan werken ook de PNG-download en de AI-pose-detectie van niveau 2:

```bash
npx serve .        # of: python3 -m http.server 8000
```

| Pagina | Wat |
|---|---|
| `index.html` | Landingspagina, uitleg + links |
| `niveau1.html` | **Niveau 1 — Zelf plaatsen**: onderdelen verslepen/schalen |
| `niveau2.html` | **Niveau 2 — Automatisch (AI)**: MediaPipe pose-detectie (33 lichaamspunten) plaatst de kleding automatisch; handmatig bijstellen kan nog steeds |

## Functies

- 6 fotomodellen (kind j/m, tiener j/m, volwassen m/v), AI-gegenereerd als 4-standen turnaround-sheets
- 3 échte kledingstukken met identiek silhouet: **Prinsenjas** (blauw/goud), **Harlekijnjas** (rood/geel geruit), **Brokaatjas** (bordeaux/goud)
- Wisselbare onderdelen per jas: **kraag · mouwen · middenstuk · zoom & panden** — vrij te mixen, met onzichtbare naden (feathered foto-regio's)
- 3 kleurtinten per onderdeel (hue-shift op de echte stof)
- 360°-weergave in 6 stappen (voor / schuin / zij / achter, incl. gespiegeld)
- Automatische maatvoering per model (borstbreedte gemeten uit de foto, verticale correctie voor kinderen/tieners)
- Live prijsindicatie en ontwerp downloaden als PNG

## Techniek

Geen build-stap, geen dependencies — HTML/CSS/JS.

- `shared/haakhuis.css` — designsysteem (kleuren/typografie van haakhuis.nl)
- `shared/calibration.js` — voorgebakken crops + lichaamsbreedtes per aanzicht (daardoor werkt het ook via file://)
- `shared/data.js` — modellen, jassen, onderdeel-regio's, kleurtinten, prijzen
- `shared/engine.js` — compositing-engine: multiply-blending (witte fotoachtergrond valt weg), onderdeel-sprites met zachte naadranden, plaatsing op gemeten lichaamsankers, rotatie, prijs, PNG-export
- `assets/models/raw-*.png` — modelfoto's (4 aanzichten per sheet)
- `assets/garments/jas-*.png` — kledingfoto's (4 aanzichten per sheet, zelfde silhouet)
- Niveau 2 laadt `@mediapipe/tasks-vision` via CDN (internet nodig)

Modellen en kleding zijn illustratief (prototype).
