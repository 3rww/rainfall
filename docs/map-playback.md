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
| `BURST_OPACITY` | `0.25` | Black outline opacity before fading and when paused |
| `BURST_STROKE_WIDTH` | `0.75` | Outline width in screen pixels |
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

## Architecture and renderer selection

`store.playbackRuntime` owns the worker session, elapsed-time clock, cancellation,
current frame, indexed tooltip lookup, reusable GPU value array, and prefetch.
The three-frame retention bound includes the displayed frame. Only one
presentation can be in flight. The worker retains its sparse sensor indexes and
prefix sums; its frame-response format is unchanged. There is no dense
sensor-by-timestep matrix.

Redux holds controls, availability, timeline/summary metadata, legend presets,
and a lightweight progress snapshot (`appliedIndex`, `interval`, `status`).
Per-sensor values and pending frames never enter Redux actions or state.
Automatic progress is published at most every 100 ms, on a timer outside the
Mapbox render callback. Commands, errors, and completion publish immediately.
Progress cannot advance the clock. Visible tooltips subscribe to the same
notifications and look up `(source, ID)` in the runtime; hovering refreshes
immediately. The map and legends do not subscribe to playback progress.

The runtime renderer contract is `updateGeometry`, `updateSettings`,
`present(frame, payload)`, `restore`, and `dispose`. `present` resolves after
Mapbox submits the frame's draw. It neither waits for React nor forces GPU
synchronization. Generation checks reject obsolete worker replies and draw
acknowledgements after seeks, mode changes, or result replacement.

The WebGL backend uses three public Mapbox
[custom layers](https://docs.mapbox.com/mapbox-gl-js/api/properties/#customlayerinterface), inserted at the radar
fill, burst, and gauge positions. They are owned imperatively and excluded from
the serialized Redux style. Native rainfall-result layers are hidden during
custom playback; native interaction, selection, outline, label, and basemap
layers retain their ordering and feature state.

- Radar polygons and multipolygons (including holes) are triangulated with the
  direct `earcut@3.0.2` dependency. Geometry is built once per geometry/result
  identity. Coordinates use a local Mercator origin; the camera translation is
  computed in double precision before uploading its float matrix.
- Radar/gauge sensor pairs have distinct stable numeric indexes. One RGBA32F
  texture stores rainfall and validity separately, preserving measured zero.
  Values upload once per applied timestep, with restoration uploads after a
  context/style rebuild. Geometry stays unchanged during seeking and rescaling.
- Gauges use instanced viewport-aligned quads, the native zoom radius, map pitch
  scaling, white outline, and opacity. Radar rings use map-aligned instanced
  quads and derivative-based antialiasing.
- Four bounded burst cohorts store amounts and timing. Shader uniforms drive
  growth/fade between frames; those animation draws do not loop over sensors,
  upload values, rewrite GeoJSON, rebuild paint expressions, or write rainfall
  feature state. Skipped intervals accumulate from the previous applied frame.
  Paused rings and final settling retain the original semantics.
  Inactive cohorts are skipped, empty/expired instances are clipped before
  rasterization, and black rings bypass rainfall texture/color lookups. These
  avoid substantial unnecessary work on software WebGL implementations.
- `rainfallColorStops` supplies identical rounded RGB stops to both backends.
  Missing values are transparent; numeric values clamp to the legend endpoints.
  Burst visual constants remain in `intervalBursts.js` (including opacity 0.25
  and stroke width 0.75, correcting the old documentation).

The native backend uses the same imperative runtime with the original
feature-state fills/circles and four native burst layers. Query-total rendering,
API requests, downloads, charts, and shared application state are unchanged.
Returning to totals releases the playback GPU resources and worker session.

### Diagnostics and recovery

**Custom WebGL is the default**, following the correctness and production
performance gates recorded below. A startup-only URL parameter selects the
requested renderer:

- `?playbackRenderer=custom`: request custom WebGL.
- `?playbackRenderer=native`: request the native backend.

The override has no visible control and is not stored in Redux or shared state.
Custom rendering requires Mercator without terrain. Unsupported configurations
and shader/resource initialization failures automatically use native rendering.
`store.playbackRuntime.inspect()` reports `requestedBackend`, effective `backend`,
`fallbackReason`, frame/cache counts, upload counts, geometry builds, and live
GPU resource counts. `store.inspectPlayback()` adds worker session counts.
Benchmark runs requesting custom must fail if they fall back.

Style replacement reattaches the layers and restores the current frame without
emitting duplicate bursts. WebGL context loss pauses playback; restoration
recreates resources and displays the last frame paused. Restoration failures
fall back to native. Teardown removes listeners, timers, layers, GL buffers,
textures/programs, subscriptions, and worker sessions.

For inspection, `getCurrentFrame()` and `getReadout(source, id)` expose the
current frame and indexed readings. Treat these values as read-only.
`subscribe` observes throttled UI progress; `subscribePresentation` observes
every applied frame for diagnostics without using Redux.

## Validation

```sh
npm test -- --maxWorkers=2
npx playwright test --workers=2
npm run build
RAINFALL_BENCHMARK=1 PLAYBACK_RENDERER=custom npx playwright test --config=playwright.benchmark.config.js playback.spec.js --grep 'large playback'
RAINFALL_BENCHMARK=1 PLAYBACK_RENDERER=native npx playwright test --config=playwright.benchmark.config.js combinedPlayback.spec.js --grep 'full radar grid'
```

The benchmark uses 165 rendered pixels and 8,929 observations per pixel. It
asserts that all pixels are present in the rendered result layer before timing
playback. Its `playback-performance.json` attachment records preparation,
applied-frame cadence, seek-to-application latency, cache bounds, and cleanup.
`store.inspectPlayback()` reports live worker sessions and controller cache
counts for tests. Timings are machine-dependent.
Repeat the long-series command with `PLAYBACK_RENDERER=native` and
`PLAYBACK_BROWSER=firefox` to cover both backends and browsers. Set
`PLAYBACK_BUILD=/path/to/production-output` to reuse a compiled build and
`PLAYBACK_REPORT_DIR=/tmp/rainfall-long-series` to save the run metrics.

The mock style includes a glyphs URL because the existing gauge label layer
requires one; omitting it prevents subsequent rainfall layers from being added
in the style diff. Browser tests assert real result-layer creation and rendering,
as well as tooltip refresh, source restoration, no source writes during playback,
keyboard controls, responsive layout, and no additional rainfall requests.

### Reproducing the renderer comparison

Use an isolated production output directory for each revision. Preserve the
original build before refactoring, using the same environment as below. The
renderer benchmark normalizes all 2,313 repository radar polygons and all 33
repository gauge locations into active API fixtures, and asserts that all are
rendered before timing starts. Each mode uses 101 intervals and one warmup plus
five measured playbacks, with the same viewport, camera, data, and browser.

```sh
VITE_E2E_TEST=true VITE_ENABLE_SHARE_STATE=false \
VITE_MAPBOX_TOKEN=test-token VITE_MAPBOX_STYLE_BASEMAP=http://mock.api/style.json \
VITE_API_URL_ROOT=http://mock.api/ \
npx vite build --outDir /tmp/rainfall-runtime-build

RAINFALL_BENCHMARK=1 PLAYBACK_BUILD=/tmp/rainfall-runtime-build \
PLAYBACK_BROWSER=firefox PLAYBACK_RENDERER=custom \
PLAYBACK_REPORT_DIR=/tmp/rainfall-custom \
MOZ_PROFILER_STARTUP=1 MOZ_PROFILER_STARTUP_FEATURES=js,stackwalk,cpu \
MOZ_PROFILER_STARTUP_FILTERS=GeckoMain MOZ_PROFILER_STARTUP_ENTRIES=16000000 \
MOZ_PROFILER_SHUTDOWN=/tmp/rainfall-custom-profile.json \
npx playwright test -c playwright.renderer.config.js

python3 scripts/playback-profile-cpu.py \
  /tmp/rainfall-custom-profile.json /tmp/rainfall-custom
```

Repeat with `PLAYBACK_RENDERER=native`, then the preserved original build, using
separate report/profile paths. Run benchmarks serially, without other browser
tests or builds competing for CPU. `PLAYBACK_BROWSER=chromium` records Long Tasks
API data where supported. An unsupported API is explicitly recorded, rather
than interpreted as zero long tasks.

Each report records environment/GPU, applied frame indexes and draw timestamps,
seek latency, RAF and active-burst callback gaps, long tasks, and resource/upload
counts. Original Redux acknowledgements are followed through to Mapbox's
`render` event, so all backends measure draw submission. CPU extraction sums
Firefox's `GeckoMain` nanosecond CPU samples in each marked ten-second playback
window; it excludes the warmup. It does not infer CPU from wall time or stack
sample counts. Profiles remain local and can be opened in Firefox Profiler.

The default-enablement gate is a **50% reduction in median main-thread CPU in
each mode**, with no fewer applied timesteps, no worse seek latency, and final
frame submission within 10.5 seconds. Cadence is reported without a fixed FPS
floor. If any gate fails, native remains the default and the URL override remains
available for further measurements.

After all three variants finish, aggregate the per-run metrics and evaluate the
CPU, timestep, seek, fallback, and final-frame gates:

```sh
python3 scripts/summarize-playback-benchmark.py /tmp/playback-comparison.json \
  original=/tmp/rainfall-original \
  runtime-native=/tmp/rainfall-native custom=/tmp/rainfall-custom
```

The summarizer exits unsuccessfully if a required comparison is missing or a
gate fails.

Correctness workflows for both browsers:

```sh
npx playwright test -c playwright.playback.config.js --workers=1
```

These include actual canvas pixel/patch comparisons, polygon holes, missing
versus zero, gauge/ring appearance, bearing/pitch/high zoom, DPR 1 and 2, tooltip
refresh, mobile controls, hidden tabs, style replacement, context recovery,
unsupported projection, and forced initialization/restoration failure.

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

### Custom WebGL production comparison (2026-11-03)

The fresh original baseline is commit `383c84e`. All variants use the same
normalized 2,313-radar + 33-gauge fixture, 101 timesteps, camera, 1280 × 720
viewport, DPR 1, and minimal mock basemap. Gauges are asserted to be rendered:
the mock glyph endpoint returns a valid empty protobuf Fontstack, avoiding an
older fixture error that prevented native gauge tiles from loading. The empty
font fixture omits label glyph drawing equally in all variants.

Firefox 146.0.1 (Playwright 1.58.2) production profiles record actual main-thread
CPU deltas, with identical profiler settings and serial runs. Its WebGL diagnostic
reports “NVIDIA GeForce GTX 980, or similar”; that browser-reported string is
not a hardware identification guarantee. The figures below are medians of five
runs after warmup, in milliseconds.

| Mode | Original CPU | Runtime + native CPU | Custom CPU | CPU reduction |
| --- | ---: | ---: | ---: | ---: |
| Interval | 9,653 | 8,660 | 1,234 | 87.2% |
| Cumulative | 9,739 | 9,407 | 1,210 | 87.6% |
| Combined | 9,694 | 9,652 | 1,434 | 85.2% |

| Mode | Displayed timesteps: original / runtime-native / custom | Seek: original / runtime-native / custom | Custom final draw |
| --- | ---: | ---: | ---: |
| Interval | 92 / 101 / 101 | 114 / 95 / 15 ms | 10,009 ms |
| Cumulative | 73 / 101 / 101 | 120 / 107 / 9 ms | 10,010 ms |
| Combined | 45 / 51 / 101 | 129 / 108 / 7 ms | 10,010 ms |

Every Firefox custom run displayed all 101 timesteps and finished within 10.018 seconds.
No custom run fell back. Two original combined runs exceeded the 10.5-second
limit (10.788 and 10.668 seconds); all runtime-native runs passed it. Decoupling
delivery improves scheduling, but native burst rendering still dominates CPU.

Across each custom mode's warmup and five measured runs, geometry was built
once, GPU resources were built once, and 613 applied frames (including seeks)
produced exactly 613 rainfall texture uploads. Live resources remained five
buffers, three vertex arrays, two textures, and one program. The frame cache
peaked at three. Cohort uploads also reflect playback controls and final settling;
ring growth/fading between those events uses uniforms only.

These measurements describe this fixture and browser environment; they are not
cross-device performance guarantees. Firefox does not expose the Long Tasks API
in this environment, so its reports mark that metric unsupported. Chromium
records the API directly. Raw profiles and detailed run reports are kept outside
the repository; the summary includes per-run numbers and reproduction commands
above.

Chromium 145.0.7632.6 reports ANGLE Vulkan SwiftShader software rendering. Its
final custom runs all displayed 101 timesteps, with zero Long Tasks API entries
in every measured run. The slowest custom final draw was 10.050 seconds.

| Mode | Displayed timesteps: original / runtime-native / custom | Seek: original / runtime-native / custom | Custom final draw | Long tasks: original / runtime-native / custom |
| --- | ---: | ---: | ---: | ---: |
| Interval | 101 / 101 / 101 | 55 / 47 / 18 ms | 10,012 ms | 7 / 0 / 0 |
| Cumulative | 101 / 101 / 101 | 68 / 46 / 21 ms | 10,009 ms | 28 / 6 / 0 |
| Combined | 69 / 94 / 101 | 63 / 48 / 19 ms | 10,041 ms | 133 / 74 / 0 |

During active combined bursts, pooled Chromium RAF probe gaps across the five
runs had median/p95/max values of 100/116.7/116.8 ms for the original renderer,
50/116.7/116.8 ms for runtime-native, and 33.3/50/50.1 ms for custom. These measure
callback cadence while bursts are active; there is no fixed FPS acceptance
threshold.

Firefox's corresponding active-burst RAF probe gaps were 200.2/217.2/233.9 ms
(original), 99.8/200.2/217.0 ms (runtime-native), and 17.1/17.2/34.2 ms (custom).
The [versioned comparison](benchmarks/playback-2026-11-03.json) includes all five
runs, browser/GPU diagnostics, resource/upload counts, and an explicit passing
acceptance result for each browser/mode. The session's raw CPU profiles are
`/tmp/rainfall-perf/baseline-validated-firefox.json`,
`/tmp/rainfall-perf/runtime-native-firefox.json`, and
`/tmp/rainfall-perf/custom-optimized-firefox.json`; these large files are not
versioned.

The retained 165-sensor × 8,929-timestep workload (1,473,285 observations) also
passed cumulative and combined regression checks for both backends in both
browsers. These long-series checks use one run per case, separately from the
five-run full-grid acceptance comparison. Every case retained the full timeline,
kept at most three frames, and released worker sessions, cached frames, result
datasets/operations, and owned GPU resources on deletion.

| Browser | Custom mode | Preparation | Seek | Final draw | Frames displayed during replay |
| --- | --- | ---: | ---: | ---: | ---: |
| Chromium | Cumulative | 535 ms | 87 ms | 10,023 ms | 602 |
| Chromium | Combined | 527 ms | 84 ms | 10,021 ms | 601 |
| Firefox | Cumulative | 901 ms | 57 ms | 10,018 ms | 595 |
| Firefox | Combined | 904 ms | 56 ms | 10,025 ms | 596 |

The [long-series results](benchmarks/playback-2026-11-03-long-series.json) include
native timings and cleanup diagnostics. Skipping overdue display steps in this
workload preserves the ten-second schedule; all 8,929 timesteps remain seekable.

The correctness gate passed all 193 unit tests and 34 browser workflows across
Chromium and Firefox, including actual canvas comparisons, DPR 1/2, high zoom,
pitch/rotation, holes, missing/zero, gauges, burst overlap, tooltips, mobile
controls, style reloads, context recovery, and forced fallback. The two legacy
full-grid browser cases are intentionally skipped in the correctness command;
the dedicated production comparison above covers the full grid with gauges.
Custom rendering is enabled by default following these gates; native remains
available through the URL override and automatic compatibility/resource fallback.
The final production build passed, and startup smoke tests in both browsers
selected custom rendering without a diagnostic URL override.
