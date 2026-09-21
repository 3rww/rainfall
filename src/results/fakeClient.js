// Injected transport for Redux tests; production never falls back to the main thread.
import { createResultsEngine } from './engine';
export function createFakeResultsClient() {
  const engine = createResultsEngine();
  const artifacts = new Map();
  let sequence = 0;
  let failure;
  return {
    onFailure(fn) { failure = fn; },
    fail(message = 'Worker failed') { failure(message); },
    async run(type, payload, { signal, onProgress = () => {} } = {}) {
      const iterator = engine[type](payload);
      let step;
      do {
        if (signal?.aborted) throw new DOMException('Canceled', 'AbortError');
        step = iterator.next();
        if (!step.done) await Promise.resolve();
      } while (!step.done);
      onProgress({ done: true });
      if (!step.value?.blob) return step.value;
      const artifact = String(++sequence);
      artifacts.set(artifact, step.value);
      return { artifact, filename: step.value.filename };
    },
    artifact: handle => artifacts.get(handle),
    release: handle => artifacts.delete(handle),
    dispose: handles => engine.dispose(handles),
    inspect: () => ({ ...engine.inspect(), artifacts: artifacts.size }),
    teardown() { artifacts.clear(); }
  };
}
