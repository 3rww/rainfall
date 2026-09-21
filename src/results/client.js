// Transport and resource ownership only; lifecycle policy lives in Redux.
export function createResultsClient(workerFactory = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })) {
  let worker;
  let sequence = 0;
  let onFailure = () => {};
  const pending = new Map();
  const artifacts = new Map();
  function release(handle) {
    artifacts.get(handle)?.cleanup?.(); artifacts.delete(handle);
  }
  function releaseAll() { for (const handle of artifacts.keys()) release(handle); }
  function fail(error) {
    worker?.terminate(); worker = undefined;
    for (const op of pending.values()) { op.cleanup(); op.reject(error); }
    pending.clear(); releaseAll();
    onFailure(error.message);
  }
  function start() {
    if (worker) return;
    worker = workerFactory();
    worker.onerror = event => fail(new Error(event.message || 'Results worker failed. Please rerun the query.'));
    worker.onmessageerror = () => fail(new Error('Results worker communication failed. Please rerun the query.'));
    worker.onmessage = ({ data }) => {
      const op = pending.get(data.id);
      if (!op) return;
      if (data.progress) { op.progress(data.progress); return; }
      pending.delete(data.id); op.cleanup();
      if (data.error) { op.reject(new Error(data.error)); return; }
      op.progress({ done: true });
      if (op.signal?.aborted) {
        if (op.ingestHandle) worker?.postMessage({ type: 'dispose', handles: [op.ingestHandle] });
        op.reject(new DOMException('Canceled', 'AbortError')); return;
      }
      if (data.result?.blob) {
        const artifact = `artifact:${data.id}`;
        const releaseOnAbort = () => release(artifact);
        op.signal?.addEventListener('abort', releaseOnAbort, { once: true });
        artifacts.set(artifact, { ...data.result, handles: op.handles, cleanup: () => op.signal?.removeEventListener('abort', releaseOnAbort) });
        op.resolve({ artifact, filename: data.result.filename });
      } else op.resolve(data.result);
    };
  }
  return {
    onFailure(callback) { onFailure = callback; },
    run(type, payload, { signal, onProgress = () => {} } = {}) {
      const id = String(++sequence);
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(new DOMException('Canceled', 'AbortError')); return; }
        try { start(); } catch (error) { fail(error); reject(error); return; }
        let last = -Infinity;
        const abort = () => {
          worker?.postMessage({ type: 'cancel', id });
          if (type === 'ingest') worker?.postMessage({ type: 'dispose', handles: [payload.handle] });
          pending.delete(id); signal?.removeEventListener('abort', abort);
          reject(new DOMException('Canceled', 'AbortError'));
        };
        pending.set(id, { resolve, reject, signal, ingestHandle: type === 'ingest' ? payload.handle : null, handles: Object.values(payload.handles || {}), cleanup: () => signal?.removeEventListener('abort', abort), progress: value => {
          if (value.done || performance.now() - last >= 100) { last = performance.now(); onProgress(value); }
        } });
        signal?.addEventListener('abort', abort, { once: true });
        try { worker.postMessage({ id, type, payload }, payload.buffer ? [payload.buffer] : []); }
        catch (error) { pending.delete(id); signal?.removeEventListener('abort', abort); reject(error); }
      });
    },
    artifact(handle) { return artifacts.get(handle); },
    release,
    dispose(handles) {
      for (const [artifact, resource] of artifacts) if (resource.handles.some(h => handles.includes(h))) release(artifact);
      worker?.postMessage({ type: 'dispose', handles });
    },
    inspect() {
      if (!worker) return Promise.resolve({ datasets: 0, timestamps: 0, operations: 0, artifacts: 0 });
      return this.run('inspect', {}).then(stats => ({ ...stats, operations: pending.size, artifacts: artifacts.size }));
    },
    teardown() {
      worker?.terminate(); worker = undefined;
      for (const op of pending.values()) { op.cleanup(); op.reject(new DOMException('Store disposed', 'AbortError')); }
      pending.clear(); releaseAll(); onFailure = () => {};
    }
  };
}
