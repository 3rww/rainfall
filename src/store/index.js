import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './rootReducer';
import { createRainfallListeners } from './listenerMiddleware';
import { createResultsClient } from '../results/client';
import { registerResultsListeners } from './resultsListeners';
import { workerFailed } from './features/resultsPresentationSlice';

export function createAppStore({ results = createResultsClient(), preloadedState, saveFile, middleware = [] } = {}) {
  const extra = { results, pollingJobs: new Map(), saveFile };
  const listeners = createRainfallListeners(extra);
  const disposeListeners = registerResultsListeners(listeners, extra);
  const store = configureStore({
    reducer: rootReducer, preloadedState,
    middleware: getDefault => getDefault({ thunk: { extraArgument: extra } }).prepend(listeners.middleware).concat(middleware),
    devTools: true
  });
  results.onFailure(message => store.dispatch(workerFailed(message)));
  store.inspectResults = () => results.inspect();
  store.teardown = () => {
    for (const job of extra.pollingJobs.values()) { job.controller.abort('canceled'); clearTimeout(job.timer); }
    extra.pollingJobs.clear(); disposeListeners(); listeners.clearListeners(); results.teardown();
  };
  return store;
}
const store = createAppStore();
if (import.meta.hot) import.meta.hot.dispose(() => store.teardown());
export default store;
