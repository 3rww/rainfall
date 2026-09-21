# Map playback

The toolbar appears only for an active result; transport controls and the slider
appear only in Interval and Cumulative modes. Icon buttons have tooltips, and the
compact Eastern timestamp sits at the end of the slider (the full interval is
available in its tooltip). The toolbar switches the active rainfall query between
Query total, Interval, and Cumulative views. Interval and Cumulative use the query's returned
resolution; Total-only queries must be rerun with a timestep interval.

Playback starts paused, requests a new frame every 100 ms (up to ten frames per
second), and stops at the end.
Play at the end restarts it. Scrubbing, stepping, changing modes, and hiding the
browser tab pause playback. A different result, context, or result revision
restores Query total. Each mode remembers its own 0.5-, 5-, or 10-inch legend
preset for the session (defaults: 5, 0.5, and 5 inches respectively).

Cumulative values sum available nonnegative numeric observations from the start
of the query. Missing observations leave an existing sum unchanged, without an
incomplete-coverage indicator. Before the first valid observation, the map shows
no data. Zero is a valid observation in both modes. The timeline is the sorted
union of returned intervals, including explicit nulls; absent intervals are not
invented. Labels use Eastern time and distinguish EST from EDT.

## Implementation

- `src/results/playback.js` builds worker-owned sparse indexes and prefix sums.
  `preparePlayback` takes result handles, rollup, and a session ID and returns
  timeline metadata and sensor identities. `playbackFrame` takes the session,
  index, and mode and returns values keyed by source and feature ID.
  `releasePlayback` and result disposal release the indexes.
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

## Validation

```sh
npm test -- --maxWorkers=2
npx playwright test --workers=2
npm run build
RAINFALL_BENCHMARK=1 npx playwright test --config=playwright.benchmark.config.js playback.spec.js --grep 'large playback'
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
