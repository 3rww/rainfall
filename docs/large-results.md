# Large rainfall results

The API contract and submission/polling routes are unchanged. Rainfall responses are
fetched as ArrayBuffers and transferred to a single lazy Web Worker per Redux store.
The worker decodes JSON and owns observations; neither Redux actions nor history nor
map GeoJSON contains detailed readings. Reference resources continue using ordinary
JSON requests.

## Ownership and lifecycle

- `results/engine.js` contains yielding ingestion, preview and export operations.
  Each successful sensor response gets a new opaque handle. It computes counts and
  null-aware totals once. Timestamp parsing and export formatting are cached per
  dataset and shared across its sensors. Original readings remain available until
  that history item is replaced/deleted, or the worker fails.
- `results/worker.js` schedules bounded batches through a MessageChannel. Ingestion
  and previews have priority over exports; cancellation is processed between batches.
  JSON decoding itself is synchronous inside the worker, never on the UI thread.
- `results/client.js` owns transport, abort bridging and Blob artifacts. It transfers
  input buffers and returns serializable summaries or opaque artifact handles.
  Progress is limited to 10 updates/second with an unconditional terminal update.
- `fetchKwargsSlice` owns query history, per-sensor handles, revisions and summaries.
  Partial gauge/pixel completion increments the revision and invalidates old previews.
  Late polling responses cannot replace a newer attempt's data.
- `resultsPresentationSlice` owns per-result preferences, operation status and the
  global 16-entry preview LRU. `preparePreview` and `generateExport` are async thunks;
  their lifecycle actions are the source of operation status.
- `resultsListeners` starts/cancels thunks in response to UI intentions, invalidates
  previews on replacement, disposes deleted results and saves completed exports.
  Its abortable thunk promises stay outside Redux. The same preview or export is not
  started twice while pending. Preview cancellation never cancels an export.
- `createAppStore` injects one adapter into thunk/listener extras. Tests inject a fake;
  production has no main-thread processing fallback. `store.teardown()` aborts polling
  and processing, clears listeners and terminates the worker (also used during HMR).
  `store.inspectResults()` reports only resource counts for diagnostics/tests.

Worker failure keeps sensor summaries but marks detailed results unavailable. The
modal asks the user to rerun the query. Closing the modal preserves preferences and
completed previews, cancels unfinished previews, and leaves exports running. Export
failures can be retried; a failed save attempt retains an artifact for the originating
modal's “Ready to save” button. Successful saves, cancellation, replacement and deletion
release adapter references. FileSaver/browser download lifetime is separate.

## Preview semantics

Average by Type uses every returned sensor of each type. Individual mode allows ten
sensors total, initially the first ten ordered by type and natural ID. The picker is
searchable. Date controls apply to the chart only, in Eastern calendar time.

The worker chooses the finest interval with at most 1,000 returned-grid buckets,
starting at the requested interval and progressing through 15-minute, hourly, daily,
monthly and yearly. Totals remain a single observation. Native five/fifteen-minute
end labels belong to the preceding accumulation period when coarsened. Explicit
hourly ranges use their start; daily labels use Eastern midnight. Coarse calendar
buckets use Eastern boundaries, including 23/25-hour DST days.

An individual bucket sums available measurements. An average bucket first averages
available sensors **at each original timestamp**, then sums those averages. Zeros
contribute; nulls do not. Entirely missing buckets stay null and chart lines do not
bridge them. Tooltip coverage reports contributing versus expected readings and the
number of timestamps, using the returned grid (not invented observations). Preview
values retain the existing three-decimal presentation; downloads use original values.

CSV and SWMM are generated on demand in chunks. CSV retains preferred/extra columns,
source codes, timestamp formatting and escaping. SWMM retains type/natural-ID order,
chronological readings, null exclusion, six-decimal rounding and the existing range
start convention. Byte-equivalence fixtures compare both against the prior helpers.
The map joins only summaries and reuses geometry references; preview/export progress
does not dispatch map source updates.

## Validation and reproduction

```sh
VITE_API_URL_ROOT=http://testserver/rainfall/ npm test
npm run build
npm run test:e2e -- --workers=2
RAINFALL_BENCHMARK=1 npm run test:e2e -- --config playwright.benchmark.config.js
```

Install Playwright Chromium if needed. The benchmark builds production assets, serves
`/rainfall/` locally, mocks the API, and runs a real Web Worker. It generates 165 sensors
× 8,929 five-minute observations = 1,473,285 records (including zeros, nulls and source
exceptions). The fixture is generated in the test runner, not in browser state.
The JSON benchmark report is attached to the Playwright test. No production data is
modified or fetched.

On this machine, September 21, 2026, the production Chromium run measured:

| Measurement | Result |
| --- | ---: |
| Click to painted modal shell | 15 ms |
| Modal click to first rendered preview | 896 ms |
| Ingestion complete to first rendered preview, including test click delay | 1,484 ms |
| Preview buckets | 745 hourly buckets |
| CSV generation and download start | 1,515 ms |
| SWMM generation and download start | 505 ms |
| Observed main-thread long tasks after submission | one 51 ms task (1 ms beyond the 50 ms threshold) |
| Serialized query-history state | 27,632 bytes |
| Reported main-thread JS heap at preview | approximately 23 MB |
| Worker datasets/timestamp caches/pending operations/artifacts after deletion | 0 / 0 / 0 / 0 |

Both downloads completed after closing the modal. Opening another result is separately
covered by real-worker browser tests; reducer/listener tests also verify scoped progress,
replacement, stale responses, failure, cancellation and LRU eviction.

The supplied Firefox development profile showed about 31 seconds of synchronous modal
preparation (both charts and both exports), with CSV serialization about 1.14 seconds
later and individual-series switching about 5 seconds. The new design removes that
up-front export work and bounds chart rendering. These timings are directional, not a
controlled browser comparison: the new run uses Chromium production, a deterministic
fixture and a mocked map/API. Firefox's process allocation counter (roughly +3.68 GiB
at peak) is **not comparable** to Chromium's main-thread JS-heap estimate above, which
excludes the worker and Blob storage. Resource-count assertions prove reference cleanup;
no immediate browser heap reduction or total-memory target is claimed.

No backend changes, feature flag or persistent migration are required. Rollback is
reverting the frontend release.
