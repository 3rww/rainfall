# Map playback

The toolbar appears only for an active result; transport controls and the slider
appear only in Interval, Cumulative, and Combined modes. Icon buttons have tooltips, and the
compact Eastern timestamp and controls have dedicated columns beside the slider.
On narrow screens the slider wraps to its own full-width row. The full interval
is available in the timestamp tooltip. The toolbar switches the active rainfall query between
Query total, Interval, Cumulative, and Cumulative + interval bursts views. Playback uses the query's returned
resolution; Total-only queries must be rerun with a timestep interval.

Playback starts paused and stops at the end. Short results use 100 ms per
transition; longer results divide a ten-second playback schedule by the number
of transitions. An elapsed-time clock accounts for rendering time and skips
overdue frames on large results. Every timestep remains available when scrubbing,
and cumulative frames still include all preceding observations. The final frame
is scheduled within ten seconds; worker and browser rendering stalls can delay
its actual appearance. The slider follows the selected timestep immediately,
while the timestamp describes the frame actually displayed on the map.
Play at the end restarts it. Scrubbing, stepping, changing modes, and hiding the
browser tab pause playback. A different result, context, or result revision
restores Query total. Total, Interval, and Cumulative remember their 0.5-, 5-, or
10-inch legend preset for the session (defaults: 5, 0.5, and 5 inches respectively).
Combined reads and updates the same preset as Cumulative; it has no separate scale.

Cumulative values sum available nonnegative numeric observations from the start
of the query. Missing observations leave an existing sum unchanged, without an
incomplete-coverage indicator. Before the first valid observation, the map shows
no data. Zero is a valid observation in every playback mode. The timeline is the sorted
union of returned intervals, including explicit nulls; absent intervals are not
invented. Labels use Eastern time and distinguish EST from EDT.

## Cumulative + interval bursts

This view is offered for results containing radar pixels. Polygon fills retain
cumulative rainfall, and transparent circles with black outlines show rainfall
at pixel centers. Gauges retain cumulative styling without burst rings.

While playing, each burst represents the increase since the previous applied
frame, including any skipped intervals. This is an amount in inches, not an
instantaneous rainfall rate. The tooltip shows cumulative and selected-interval
rainfall and, when intervals were skipped, the burst amount and its time window.
Paused or scrubbed frames show static rings for the selected interval. The final
bursts finish before settling to static rings; manually pausing settles immediately.

Visual constants live at the top of `src/components/map/intervalBursts.js`:

| Constant | Default | Meaning |
| --- | --- | --- |
| `BURST_CELL_DIAMETER_FACTOR` | `1.5` | Maximum ring diameter divided by equivalent cell width |
| `BURST_LEGEND_FRACTION` | `0.10` | Interval amount at full size, as a fraction of the cumulative legend maximum |
| `BURST_OPACITY` | `0.45` | Black outline opacity before fading and when paused |
| `BURST_STROKE_WIDTH` | `1.25` | Outline width in screen pixels |
| `BURST_GROWTH_FRACTION` | `0.40` | Fraction of lifetime spent growing with cubic ease-out |
| `BURST_DURATION_FACTOR` | `2.5` | Lifetime divided by elapsed time between applied frames |
| `BURST_INITIAL_DURATION_MS` | `250` | Lifetime when no preceding application time exists |
| `BURST_MAX_DURATION_MS` | `400` | Maximum lifetime |
| `BURST_SLOTS` | `4` | Maximum overlapping bursts per pixel; oldest slot is reused |

The diameter is `1.5 × cell width × sqrt(min(amount / (0.10 × legend maximum), 1))`.
Thus 0.5 inches reaches full size with a 5-inch legend. Zero and unavailable
observations produce no ring. Cell width is the square root of polygon area in
Mercator coordinates; circles scale with zoom and align with the map plane.
Changing the shared legend rescales current rings without restarting them.

The design credits Adam Pearce's [Hurricane How-To](https://roadtolarissa.com/hurricane/)
and the [New York Times Hurricane Harvey visualization](https://www.nytimes.com/interactive/2017/08/24/us/hurricane-harvey-texas.html).
These credits also appear in About → Under the Hood.

## Implementation

- `src/results/playback.js` builds worker-owned sparse indexes and prefix sums.
  `preparePlayback` takes result handles, rollup, and a session ID and returns
  timeline metadata and sensor identities. `playbackFrame` takes the session,
  index, and mode and returns values keyed by source and feature ID.
  `releasePlayback` and result disposal release the indexes.
- Combined frames retain cumulative `value` and add raw `intervalValue` to each
  reading. Differences are computed against the previous applied frame in the
  map controller, not against prefetched frames. Seeks, replay, and result/mode
  changes reset that comparison.
- The playback Redux slice owns controls, timeline metadata, pending/displayed
  frames, and availability. Its controller cancels superseded work, validates
  result identity/revision and seek generation, and retains the displayed frame
  plus at most two successors. Prefetch waits for map acknowledgement so the
  previous displayed frame is released first.
- The map applies frames with `requestAnimationFrame` and acknowledges them to
  Redux. Paint expressions use the `rainfall` and `rainfallAvailable` feature-state
  keys. Frames do not update GeoJSON sources or rebuild paint expressions. Hover
  state is independent. Source/style replacement reapplies the current frame.
- Query totals keep the existing property-based rendering. Playback does not
  change API requests, downloads, charts, or shared URLs.
- The map owns one derived point source and four native circle layers for bursts,
  above pixel fills and below hover/gauge layers. Animation changes feature state
  through `requestAnimationFrame`, outside Redux/React, without rewriting sources
  or rebuilding paint expressions. Paused views have no animation loop. Geometry
  is retained across seeks and replay; only animation state is reset. Resource
  restoration reapplies state without emitting duplicate bursts; exiting the mode
  or deleting a result releases the source, layers, and scheduled animation.

## Validation

```sh
npm test -- --maxWorkers=2
npx playwright test --workers=2
npm run build
RAINFALL_BENCHMARK=1 npx playwright test --config=playwright.benchmark.config.js playback.spec.js --grep 'large playback'
RAINFALL_BENCHMARK=1 npx playwright test --config=playwright.benchmark.config.js combinedPlayback.spec.js --grep 'full radar grid'
```

The benchmark uses 165 rendered pixels and 8,929 observations per pixel. It
asserts that all pixels are present in the rendered result layer before timing
playback. Its `playback-performance.json` attachment records preparation,
applied-frame cadence, seek-to-application latency, cache bounds, and cleanup.
`store.inspectPlayback()` reports live worker sessions and controller cache
counts for tests. Timings are machine-dependent.

The mock style includes a glyphs URL because the existing gauge label layer
requires one; omitting it prevents subsequent rainfall layers from being added
in the style diff. Browser tests assert real result-layer creation and rendering,
as well as tooltip refresh, source restoration, no source writes during playback,
keyboard controls, responsive layout, and no additional rainfall requests.

### Initial implementation validation (500 ms playback)

On 2026-09-21, all 159 unit tests and all 20 browser tests passed, and the
production build succeeded. Browser checks used installed Microsoft Edge
153.0.4234.46 (Chromium) via a temporary Playwright config because the bundled
Playwright Chromium executable was unavailable. No repository-specific browser
path was added.

The production benchmark verified all 165 pixels were rendered and retained all
8,929 timesteps (1,473,285 observations). Preparation through first-frame
application took 427 ms; seeking to the last frame took 94 ms. Subsequent playing
frames were applied 502–516 ms apart. The initial paused frame-to-play delay is
excluded from cadence. The cache peaked at three frames. Deleting the result
left zero playback sessions, cached frames, datasets, or pending operations.
These are local measurements, not cross-device performance guarantees.

### Compact controls and 100 ms playback

All 159 unit tests and four playback browser tests passed after the toolbar
update, including production-build layout assertions and the full benchmark.
With all 165 pixels rendered, preparation took 423 ms and seeking took
92 ms. Subsequent frame applications were 114–186 ms apart with the
100 ms delay; rendering adds some overhead. The frame cache remained bounded to
three frames and cleanup left no sessions or cached frames.

### Adaptive playback and manual scrubbing

All 163 unit tests and five playback browser tests passed, along with the
production build and the 165-pixel, 8,929-timestep production benchmark. Browser
checks used installed Microsoft Edge through a temporary Playwright config.
Mouse drags in both directions at desktop and mobile widths keep the slider's
position and width stable. The benchmark checks completion against a ten-second
schedule with 500 ms tolerance for frame application; it measures the final
frame's application timestamp, excluding test-driver serialization and polling.

### Combined bursts validation (2026-11-03)

Unit coverage includes combined worker frames, shared cumulative legend settings,
Mercator cell geometry, skipped-interval differences, burst timing, bounded
overlap, pause/seek/replay behavior, rescaling, and resource restoration. Browser
checks cover actual Mapbox rendering, camera rotation/pitch, transparent fills,
mixed radar/gauge results, tooltips, mobile controls, hidden-tab pausing, source
write counts, cleanup, and the About credits.

All three production benchmarks passed: cumulative and combined playback with
165 pixels × 8,929 intervals, plus combined playback with all 2,313 radar cells
visible and 101 intervals. Each met the ten-second schedule with the existing
500 ms final-frame tolerance. Frame caches remained bounded to three frames;
the full-grid run retained at most four overlapping burst cohorts. These are
local Chromium measurements, not cross-device performance guarantees.
