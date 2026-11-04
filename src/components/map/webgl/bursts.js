import { burstAmounts, BURST_SLOTS, BURST_DURATION_FACTOR, BURST_INITIAL_DURATION_MS, BURST_MAX_DURATION_MS } from '../intervalBursts';
import { sensorKey } from '../../../store/playbackController';

// CPU work happens on presentation/control changes only; growth and fading run in the shader.
export function createBurstCohorts(count, indexes, now = () => performance.now()) {
  const amounts = new Float32Array(Math.max(1, count) * BURST_SLOTS);
  const born = new Float32Array(BURST_SLOTS), durations = new Float32Array(BURST_SLOTS);
  const epoch = now();
  let frame = null, settings, slot = 0, lastApplied = null, staticRings = false, finishing = false, emitted = 0, summary = null;
  let revision = 0;
  function clear() { amounts.fill(0); durations.fill(0); slot = 0; lastApplied = null; summary = null; finishing = false; revision++; }
  function write(values, offset) {
    amounts.fill(0, offset * Math.max(1, count), (offset + 1) * Math.max(1, count));
    for (const [id, value] of values) {
      const index = indexes.get(sensorKey('pixel', id));
      if (index !== undefined) amounts[offset * count + index] = value;
    }
    revision++;
  }
  function settle() {
    clear(); staticRings = Boolean(frame);
    if (frame) write(burstAmounts(frame, null), 0);
  }
  function update(next) {
    if (!settings || settings.key !== next.key || settings.generation !== next.generation || settings.mode !== next.mode) { clear(); frame = null; staticRings = false; }
    else if (settings.playing !== next.playing) {
      if (next.playing) { clear(); staticRings = false; }
      else if (!finishing || document.hidden) settle();
    } else if (document.hidden && finishing) settle();
    settings = next;
  }
  function apply(next, config) {
    update(config);
    if (next === frame) return;
    const previous = frame && next.index > frame.index ? frame : null; frame = next;
    if (config.mode !== 'combined') return;
    if (!config.playing) { settle(); return; }
    const time = now() - epoch, values = burstAmounts(frame, previous);
    const duration = lastApplied === null ? BURST_INITIAL_DURATION_MS : Math.min(BURST_MAX_DURATION_MS, Math.max(1, time - lastApplied) * BURST_DURATION_FACTOR);
    write(values, slot); born[slot] = time; durations[slot] = [...values.values()].some(value => value > 0) ? duration : 0;
    slot = (slot + 1) % BURST_SLOTS; lastApplied = time; staticRings = false; emitted++;
    summary = previous && frame.index - previous.index > 1 ? { index: frame.index, count: frame.index - previous.index,
      amounts: values, startMs: config.timeline[previous.index + 1].startMs, endMs: frame.interval.endMs } : null;
    finishing = frame.index === config.timeline.length - 1;
  }
  function tick() {
    const time = now() - epoch;
    for (let i = 0; i < BURST_SLOTS; i++) if (time >= born[i] + durations[i]) durations[i] = 0;
    const active = durations.some(d => d > 0);
    if (finishing && !active) { settle(); return { time, active: false, settled: true }; }
    return { time, active };
  }
  return { amounts, born, durations, update, apply, tick, summary: () => summary,
    get revision() { return revision; }, get staticRings() { return staticRings; },
    inspect: () => ({ emitted, activeBursts: durations.filter(d => d > 0).length, animated: durations.some(d => d > 0), staticRings }) };
}
