import {
  selectFetchHistoryItemById
} from '../selectors';
import {
  pickActiveResultItem,
  removeFetchHistoryItem
} from './fetchKwargsSlice';

export const applyActiveResultToMap = ({ contextType, requestId }) => (dispatch) => {
  dispatch(pickActiveResultItem({ contextType, requestId }));
};

export const pickDownload = (payload) => {
  const { contextType, ...fetchHistoryItem } = payload;

  return (dispatch) => {
    if (!fetchHistoryItem.isActive) {
      dispatch(applyActiveResultToMap({
        contextType,
        requestId: fetchHistoryItem.requestId
      }));
    }
  };
};

export const deleteDownload = (payload) => {
  const { contextType, requestId } = payload;

  return (dispatch, getState) => {
    const state = getState();
    const fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType);

    if (!fetchHistoryItem) {
      return;
    }

    dispatch(removeFetchHistoryItem({ contextType, requestId }));
  };
};
