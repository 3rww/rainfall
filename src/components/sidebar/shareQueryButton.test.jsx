import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ShareQueryButton from './shareQueryButton';
import { buildRainfallShareUrl } from '../../store/urlShareState';
vi.mock('../../store/urlShareState', () => ({ buildRainfallShareUrl: vi.fn() }));

let container, root, clicked;
const query = { saved: 'first' };
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const render = async (value = query) => {
  await act(async () => root.render(<div onClick={clicked}><ShareQueryButton contextType="legacyGarr" query={value} /></div>));
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  clicked = vi.fn();
  vi.mocked(buildRainfallShareUrl).mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it('waits for generation, discards stale completions, and copies immediately without bubbling', async () => {
  const first = deferred(), second = deferred();
  vi.mocked(buildRainfallShareUrl).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const writeText = vi.fn().mockResolvedValue();
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  await render();
  expect(container.querySelector('button').disabled).toBe(true);
  const nextQuery = { saved: 'second' };
  await render(nextQuery);
  await act(async () => second.resolve('https://example.com/#s=second'));
  expect(container.querySelector('button').disabled).toBe(false);
  await act(async () => first.resolve('https://example.com/#s=first'));
  await act(async () => {
    container.querySelector('button').click();
    expect(writeText).toHaveBeenCalledWith('https://example.com/#s=second');
  });
  expect(clicked).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Link copied.');
  expect(buildRainfallShareUrl).toHaveBeenLastCalledWith('legacyGarr', nextQuery);
});
it.each(['rejected', 'unavailable'])('offers a selectable URL when clipboard is %s', async mode => {
  vi.mocked(buildRainfallShareUrl).mockResolvedValue('https://example.com/rainfall/#s=saved');
  vi.stubGlobal('navigator', mode === 'unavailable' ? {} : { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  await render();
  await act(async () => container.querySelector('button').click());
  const input = container.querySelector('input');
  expect(input.value).toBe('https://example.com/rainfall/#s=saved');
  expect(input.readOnly).toBe(true);
  await act(async () => input.click());
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  expect(clicked).not.toHaveBeenCalled();
});
it('keeps Share disabled and explains generation failure', async () => {
  vi.mocked(buildRainfallShareUrl).mockRejectedValue(new Error('compression failed'));
  await render();
  expect(container.querySelector('button').disabled).toBe(true);
  expect(container.textContent).toContain('Could not prepare');
});
it('ignores generation after the owning result unmounts', async () => {
  const pending = deferred();
  vi.mocked(buildRainfallShareUrl).mockReturnValue(pending.promise);
  await render();
  await act(async () => root.render(null));
  await act(async () => pending.resolve('https://example.com/#s=gone'));
  expect(container.textContent).toBe('');
});
