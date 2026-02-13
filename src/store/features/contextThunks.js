import { switchTab } from './progressSlice';

export const switchContext = (contextType) => (dispatch) => {
  dispatch(switchTab(contextType));
};
