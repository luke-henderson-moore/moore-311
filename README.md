# Moore 311 — Report a problem

Public, no-sign-in web app for reporting road problems (potholes, streetlights, signals, signs, debris, etc.).
People drop a pin on the map, pick a category, add details, and the report is saved to an ArcGIS Online hosted feature layer.

**Live app:** https://luke-henderson-moore.github.io/moore-311/

## How it works
- Static site (HTML/CSS/JS) — ArcGIS Maps SDK for JavaScript 4.30, no build step.
- Reports are written with an anonymous `addFeatures` call to the layer in `js/config.js` (`reportsLayerUrl`).
- Each report gets a reference number (`SR-YYMMDD-XXXXX`). Reports sent from a device are listed under **My reports** (stored in the browser only).
- Basic spam protection: hidden honeypot field and a 30-second cooldown per browser.
- If the layer isn't public or doesn't allow adding features, the app shows a friendly "reporting isn't open yet" notice instead of a sign-in prompt.

## ArcGIS Online data
| | |
|---|---|
| Item | Moore 311 - Public Reports (GIS App Builder) — `95aa9844268b454f8fb674832388a77a` |
| Layer | `.../Moore 311 - Public Reports (GIS App Builder)/FeatureServer/0` |
| Fields | ReportID, Category, Description, Status, Address, ReporterName, ReporterEmail, ReporterPhone, SubmittedOn, Source, Latitude, Longitude |

### To open reporting to the public
1. In ArcGIS Online, open the item → **Settings** → enable **Editing** and allow only **Add** (turn off update/delete), and keep "Editors can't see any features" (or "only see their own") so the public can't read others' contact details.
2. Share the item with **Everyone (public)**.
3. Delete the sample row ("Sample report - delete me").

## Configure
Edit `js/config.js`: map center/zoom, basemap, search extent, report categories, cooldown, and an optional ArcGIS API key.

## Deploy
Pushing to `main` runs `.github/workflows/deploy.yml`, which syncs the Moore logo files and publishes to GitHub Pages
(Settings → Pages → Source: **GitHub Actions**).
