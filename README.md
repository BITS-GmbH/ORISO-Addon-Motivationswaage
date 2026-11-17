# Motivationswaage add-on

The **Motivationswaage** (decisional balance) of DigiSucht as an ORISO add-on (contract
`oriso-addon/v1`, ADR-034). Runs behind the [AddonService](https://github.com/BITS-GmbH/ORISO-AddonService).
Built after section 2.4 of delphi's tool description ("Programmieranforderungen Digitale-Tools").

Clients collect the pros and cons of changing their behaviour and of not changing it, rate how
important each one is, and see where the scale tips. They can write a conclusion and choose
whether their counsellor may read it.

| Who | Where (slot) | What |
|---|---|---|
| Client | own page (`asker.navigation`) | Overview with the scale, conclusion, the four lists and the sharing switch; editors for "change" and "no change" with examples |
| Counsellor | case view (`consultant.session`), client profile (`consultant.asker-profile`) | Releases the tool or withdraws the release; sees the status and, if shared, the scale, conclusion and arguments (read only); PDF export; user preview with test data |
| Admin | ORISO-Admin | Settings per Träger or agency: intro text, pole labels (the three variants of the description), whether sharing is possible; statistics: released, started, shared |

## The calculation (2.4.5)

Categories: A advantages of the change (PRO), B disadvantages of the change (CONTRA),
C advantages of no change (CONTRA), D disadvantages of no change (PRO). Ratings: very important 3,
quite important 2, somewhat important 1, not important 0.

```
PRO    = Σ rating(A) + Σ rating(D)
CONTRA = Σ rating(B) + Σ rating(C)
value  = 10 × (PRO − CONTRA) / (PRO + CONTRA)     only when PRO + CONTRA > 0
```

Without points (no arguments, or all rated 0) the scale stays inactive and shows no value. The
value is shown with one decimal; the sums stay visible next to it. `src/balance.mjs` holds the
calculation, categories and example texts; the UI loads the same module.

## How it works

- The AddonService forwards `/service/addons/motivationswaage/api/**` to `/api/**` with its own
  short-lived token, verified against the AddonService JWKS (`src/auth.mjs`). Clients are
  identified by `sub`; counsellors only get a client when the AddonService verified their access
  to the session (`askerId` claim).
- API: `GET`/`PUT /api/balance` (client; whole state: arguments, conclusion, shared),
  `GET /api/balance/client`, `POST`/`DELETE /api/balance/client/release`, `POST /api/balance/client/export`
  (counsellor).
- Release, insight and content are separate states: a counsellor can release the tool, but only
  sees content the client shared. The export checks again right before it answers.
- Visibility: `visibility: "dynamic"`. Clients see the tool once released, with `badge: 1` until
  they open it; counsellors always.
- Host capabilities (calls never fail the user's action):
  - Release (first time): audit `tool.released`, important notification to the client.
  - Client shares: audit `balance.shared`, notification to the client's counsellors.
  - New or edited entries while shared: notification to the counsellors, at most one per
    30 minutes; quicker changes are folded into it. Notifications never contain content.
  - Release withdrawn ("Freischaltung aufheben"): audit `tool.revoked`; the tool disappears for the
    client and counsellors see no content. The entries stay and are back with a new release.
  - Client stops sharing: audit `balance.unshared`; the content is gone for counsellors at once.
  - PDF export: audit `balance.exported`.
  - Before a new release the Träger's DPA gate (`/addons/host/gates`) is checked; 409 if it
    does not allow new counselling.
- PDF export: the counsellor's browser prints a formatted page (tool, case, export date, date of
  the entries, scale with value and sums, conclusion, all arguments with ratings); "Als PDF
  speichern" in the print dialog gives the file.
- User preview ("User-Vorschau"): the client's UI with in-memory test data, clearly marked, with
  "Demo zurücksetzen"; nothing reaches the server.
- Deletion: `user.deleted` removes a client's release and balance, a deleted counsellor is
  replaced in `released_by`.
- Data: SQLite (`node:sqlite`) in `DATA_FILE` (default `/data/motivationswaage.db`).
- UI: `ui/entry.js`, `ui/scale.js` (SVG scale), `ui/styles.js`; no build step, React comes from
  the web app (`globalThis.__ORISO_ADDON_SHARED__`), colours from the Träger's `--m3-*` tokens.

## Not yet

- Per-counsellor notification preferences (1.6.4) — belongs in the core's notification settings.

## Development

```sh
npm test          # Node 24
npm run preview   # UI without ORISO on http://localhost:5179 (client and counsellor side by side)
```

| Variable | Default | |
|---|---|---|
| `ADDONSERVICE_URL` | `http://addonservice:8090` | JWKS and host API |
| `DATA_FILE` | `/data/motivationswaage.db` | |
| `PORT` | `8080` | |

Images: `harbor.mybits.dev/digisucht/addon-motivationswaage:<version>-<sha>`, built on every push
to `main` and `feat/**`.
