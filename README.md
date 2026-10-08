# Moore 311 — Report a problem

Web app for reporting road problems (potholes, streetlights, signals, signs, debris, etc.).
Anyone can open the map, drop a pin and fill in the form; **sending a report requires an ArcGIS Online sign-in**.
Reports are saved to an ArcGIS Online hosted feature layer.

**Live app:** https://luke-henderson-moore.github.io/moore-311/

## How it works
- Static site (HTML/CSS/JS) — ArcGIS Maps SDK for JavaScript 4.30, no build step.
- On submit, the app signs the user in to ArcGIS Online (`portalUrl` in `js/config.js`), prefills their name/email,
  then calls `addFeatures` on `reportsLayerUrl` with their token. The header shows who is signed in, with a Sign out button.
- Sign-in method: with `oauthAppId` blank, the ArcGIS username/password dialog is used (ArcGIS logins only).
  Set `oauthAppId` to an OAuth Client ID to use the ArcGIS Online sign-in page in a popup (supports org SSO);
  `oauth-callback.html` handles the popup.
- Each report gets a reference number (`SR-YYMMDD-XXXXX`). Reports sent from a device are listed under **My reports** (stored in the browser only).
- Basic spam protection: hidden honeypot field and a 30-second cooldown per browser.
- If the layer doesn't allow adding features, or the user's account can't access it, the app shows a clear message.

## ArcGIS Online data
| | |
|---|---|
| Item | Moore 311 - Public Reports (GIS App Builder) — `95aa9844268b454f8fb674832388a77a` |
| Layer | `.../Moore 311 - Public Reports (GIS App Builder)/FeatureServer/0` |
| Fields | ReportID, Category, Description, Status, Address, ReporterName, ReporterEmail, ReporterPhone, SubmittedOn, Source, Latitude, Longitude |

### To turn on reporting for signed-in users
1. In ArcGIS Online, open the item → **Settings** → enable **Editing**, allow only **Add** (turn off update/delete),
   and set "Editors can only see their own features" (or can't see any) so users can't read others' contact details.
   Optionally enable **editor tracking** to record the submitting username automatically.
2. Share the item with your **Organization** (or a group containing the people who should report).
3. Delete the sample row ("Sample report - delete me").

### Optional: OAuth / SSO sign-in
Content → New item → Developer credentials → OAuth 2.0 credentials. Redirect URLs:
`https://luke-henderson-moore.github.io/moore-311/` and `https://luke-henderson-moore.github.io/moore-311/oauth-callback.html`.
Paste the Client ID into `oauthAppId` in `js/config.js`.

## Configure
Edit `js/config.js`: map center/zoom, basemap, search extent, report categories, cooldown, sign-in (`portalUrl`, `oauthAppId`) and an optional ArcGIS API key.

## Deploy
Pushing to `main` runs `.github/workflows/deploy.yml`, which syncs the Moore logo files and publishes to GitHub Pages
(Settings → Pages → Source: **GitHub Actions**).
