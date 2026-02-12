import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "./rootReducer";

const store = configureStore ({
  reducer: rootReducer,
  devTools: true
});
/** NOTE
 * You may also pass an initial state to createStore which is useful for server
 * side rendering but for now we’re not interested in that.
 * The most important concept here is that the state in redux 
 * comes from reducers. Let’s make it clear: reducers produce 
 * the state of your application.
 */

export default store;
