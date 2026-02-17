import React, { useCallback } from 'react';
import { Row, Col, ListGroup, Spinner, CloseButton } from 'react-bootstrap';
import { includes } from 'lodash-es';

import DownloadItem from './downloadItem';
import { pickDownload, deleteDownload } from '../../store/features/downloadThunks';
import { selectFetchHistory } from '../../store/selectors';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import './downloadList.css';

const DownloadsList = ({ contextType, rainfallDataType, rainfallSensorType }) => {
  const dispatch = useAppDispatch();

  const fetchHistory = useAppSelector((state) => selectFetchHistory(state, contextType));

  const handleListClick = useCallback((event, fetchHistoryItem) => {
    if (event.defaultPrevented) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('.modal')) {
      return;
    }

    dispatch(pickDownload({ ...fetchHistoryItem, contextType }));
  }, [contextType, dispatch]);

  const handleDeleteClick = useCallback((event, requestId) => {
    event.preventDefault();
    event.stopPropagation();
    dispatch(deleteDownload({ requestId, contextType }));
  }, [contextType, dispatch]);

  return (
    <ListGroup variant="flush">
      {fetchHistory.slice(0).reverse().map((item) => {
        const failedJob = includes(['deferred', 'failed', 'does not exist', 'error', 'timed_out', 'canceled'], item.status);

        let listColor;
        if (item.isActive && item.status === 'finished') {
          listColor = 'primary';
        } else if (failedJob) {
          listColor = 'danger';
        } else {
          listColor = '';
        }

        return (
          <ListGroup.Item
            key={item.requestId}
            as="div"
            className="mx-0 download-list-item"
            action
            onClick={(event) => handleListClick(event, item)}
            variant={listColor}
          >
            <CloseButton
              className="download-list-item-delete"
              aria-label="Delete rainfall query result"
              onClick={(event) => handleDeleteClick(event, item.requestId)}
            />

            <Row className="g-0 download-list-item-row">
              <Col sm={item.isFetching ? 11 : 12} className="download-list-item-content">
                <DownloadItem
                  fetchHistoryItem={item}
                  contextType={contextType}
                  rainfallDataType={rainfallDataType}
                  rainfallSensorType={rainfallSensorType}
                />
              </Col>

              {item.isFetching ? (
                <Col sm={1} className="download-list-item-spinner">
                  <Spinner
                    animation="border"
                    variant="primary"
                  >
                    <span className="visually-hidden">
                      Fetching rainfall data...
                    </span>
                  </Spinner>
                </Col>
              ) : null}
            </Row>
          </ListGroup.Item>
        );
      })}
    </ListGroup>
  );
};

export default DownloadsList;
