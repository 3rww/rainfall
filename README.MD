# 3RWW Rainfall *beta*

Have you ever wondered how rainfall is actually measured? Technical instruments, called rain gauges, are designed to collect and accurately measure rainfall during wet weather events. However, a rain gauge can only provide a specific rainfall measurement for the limited geographic area where the gauge is located.

On the flip side, radar systems, often used in weather reports, do not measure rainfall directly, but rather they detect the intensity of microwave energy reflected by raindrops, called reflectivity. Through the use of a mathematical formula, the reflectivity of the raindrops can be converted by the radar system into rainfall estimates for a particular defined area.

Neither measurement technique is perfect, but when the two are combined—when radar estimates are calibrated with actual rain gauge data—a highly accurate and valuable source of rainfall data can be calculated over large geographic areas.

Because engineers and planners addressing the wet weather issue need this level of accuracy, 3 Rivers Wet Weather created the calibrated radar rainfall system in 2001. Communities throughout Allegheny County use this data—provided in both real-time and historical formats—to design more cost-effective solutions to reduce or eliminate sewage overflows and improve stormwater management.

The NEXRAD radar (located in Moon Township) data is calibrated with the rain gauge measurements collected during the same time period and rain event for every square kilometer in Allegheny County. The resulting rainfall data is equivalent in accuracy to having 2,276 rain gauges placed across the County.

## Functionality

Currently, this site offers search, download, and mapping capability for rainfall data in three buckets:

* **Real-time Rainfall data**: provisional rainfall data for both rain gauges and radar pixels. Real-time gauge data is sourced from [Datawise](https://datawise.software/),and pixels are sourced from [Vieux Associates](https://www.vieuxinc.com/). This data is updated every 15 minutes.
* **Historical Rain Gauge data**: QA/QC'd rain gauge data, usually available within 30-60 days. QA/QC is performed by [ALCOSAN](https://www.alcosan.org/) and 3RWW.
* **Calibrated Radar Rainfall data**: QA/QC'd, gauge-adjusted radar rainfall observations, typically available within 30-60 days. Calibration is performed by [Vieux Associates](https://www.vieuxinc.com/).

### Powered By *The 3RWW Data API*

The rainfall data is served up from [3RWW's Atlas](https://atlas.3riverswetweather.org/). Currently a few low-level API functions are documented and accessible through [https://atlas.3riverswetweather.org/rainfall/](https://atlas.3riverswetweather.org/rainfall/).

## Status

This project is a work-in-progress. We're currently looking to replicate the workflows of the original rainfall downloads site. In the future and with feedback, we'll build out new ways to explore and view the rainfall data. We'll also provide resources for helping you integrate this data into your workflows and use it in your tools.

## Some notes on development

This project now uses [Vite](https://vite.dev/) for local development and production builds.

Runtime baseline:

* Node 20 LTS
* npm 10+

### Clone and Installation

Run `git clone https://github.com/3rww/rainfall.git` to clone this codebase.

Running `npm install` will install dependencies.

### Available Scripts

In the project directory, you can run:

#### `npm start` (or `npm run dev`)

Runs the app in development mode with Vite.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.

#### `npm test`

Runs tests with Vitest in jsdom mode.

#### `npm run test:watch`

Runs Vitest in watch mode.

#### `npm run build`

Builds the app for production to the `dist` folder.

#### `npm run preview`

Locally serves the built app from `dist` on port 3000.

#### `npm run deploy`

Runs the `build` script and publishes `dist` to the `gh-pages` branch.

### Environment Variables

Use Vite-prefixed environment keys:

* `VITE_API_URL_ROOT`
* `VITE_MAPBOX_TOKEN`
* `VITE_MAPBOX_STYLE_BASEMAP`
* `VITE_RAINFALL_MIN_DATE`
* `VITE_API_REQUEST_INTERVAL_MS`

### Sharing rainfall queries (`#s=...`)

**Share**, beside **View and Download Results** on each result card, copies a link
from that result's saved query. Later form edits do not change the link. The
button becomes available after the compressed URL is prepared. A successful copy
shows “Link copied.”; if clipboard access fails, a selectable URL appears.
Sharing does not select the card, change the map, open results, or alter the address bar.
Generated links use the current origin and deployment base path.

SewerAtlas sensor lists use this same contract to open rainfall in a new tab.
Opening either link prefills the form after reference data and defaults load.
Review the selection and click **Get Rainfall Data** to fetch observations. Links
share query settings, not observations, chart settings, or playback state.

The URL is `https://3rww.github.io/rainfall/#s=<token>`. The token is
**base64url(deflate(UTF-8 JSON))**, without padding, using the zlib-wrapped
`deflate` format of the browser Compression Streams API (not raw DEFLATE).

```json
{
  "v": 2,
  "c": "legacyRealtime",
  "g": ["008"],
  "p": ["100", "101"],
  "startDt": "2025-11-02T05:00:00.000Z",
  "endDt": "2025-11-02T06:00:00.000Z",
  "rollup": "Hourly"
}
```

* `c`: `legacyRealtime` supports gauges and pixels together; `legacyGauge` is
  historic gauges only; `legacyGarr` is historic calibrated radar pixels only.
* `g` and `p`: arrays of string sensor IDs. At least one sensor is required.
  IDs with no map location remain selected with an explanatory notice.
* `startDt` and `endDt`: explicit UTC ISO timestamps. Exact instants are retained,
  including milliseconds and repeated DST hours. Existing form range rules apply;
  imports never clamp dates. API ranges include the start and exclude the end.
* `rollup`: `15-minute`, `Hourly`, `Daily`, or `Total` in any context;
  historic contexts also support `5-minute`.

When browser compression is unavailable, writers use uncompressed base64url UTF-8
JSON. The reader accepts either encoding of version 2. Reading compressed links
requires browser decompression support. Compression reduces length but does not
remove browser URL limits; selections are never truncated. API query-size limits
still apply when the user submits.

Invalid, unsupported, or unavailable queries leave the default form and display
a small, dismissible explanation. There is no automatic URL synchronization or
feature flag. Older schemas, `#query`, and `?state=` are not supported.

The URL-state module owns validation, codecs, link construction, and startup
hydration. Matching fixtures in `src/store/fixtures/rainfallShareState.json` and
SewerAtlas's `src/services/rainfall/fixtures/rainfallShareState.json` verify the
contract. Update both fixture copies together when changing it. Run `npm test`
and `npm run test:e2e -- e2e/urlShareState.spec.js` to check sharing and hydration.

Release rainfall's version-2 reader before SewerAtlas's producer. No backend
short-link service, database migration, or API change is needed for this contract.

### Deployment Notes

The app is configured with `base: '/rainfall/'` for production builds in `vite.config.js` so GitHub Pages deployment works at `/rainfall/`.

### Upgrade Notes

* CRA and `react-scripts` were removed in favor of Vite/Vitest.
* Service worker bootstrap code was removed (the app previously called `unregister`).
* Bootstrap/react-bootstrap were moved to modern APIs (`Popover.Header/Body`, grid `g-0`, etc.).
* The jQuery date range picker stack was replaced with `react-datepicker` while preserving range presets and event-modal shortcuts.
* Static path resolution now uses `import.meta.env.BASE_URL`.

### Learn More

You can learn more in the [Vite documentation](https://vite.dev/guide/).

To learn React, check out the [React documentation](https://react.dev/).
