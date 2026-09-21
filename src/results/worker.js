import { createResultsEngine } from './engine';
const engine = createResultsEngine();
const tasks = new Map();
let scheduled = false;
const channel = new MessageChannel();
let tick;
channel.port1.onmessage = () => tick();
function schedule() {
  if (scheduled || !tasks.size) return;
  scheduled = true;
  tick = () => {
    scheduled = false;
    // Each batch yields to messages. Ingestion/previews outrank exports.
    const task = [...tasks.values()].sort((a, b) => a.priority - b.priority)[0];
    if (!task) return;
    try {
      const step = task.iterator.next();
      if (step.done) {
        tasks.delete(task.id);
        postMessage({ id: task.id, result: step.value });
      } else if (performance.now() - task.lastProgress >= 100) {
        task.lastProgress = performance.now();
        postMessage({ id: task.id, progress: step.value });
      }
    } catch (error) {
      tasks.delete(task.id);
      postMessage({ id: task.id, error: error.message });
    }
    schedule();
  };
  channel.port2.postMessage(null);
}
onmessage = ({ data }) => {
  if (data.type === 'cancel') { tasks.delete(data.id); return; }
  if (data.type === 'dispose') { engine.dispose(data.handles); return; }
  if (data.type === 'inspect') { postMessage({ id: data.id, result: engine.inspect() }); return; }
  tasks.set(data.id, { id: data.id, iterator: engine[data.type](data.payload), priority: data.type === 'export' ? 2 : 0, lastProgress: 0 });
  schedule();
};
