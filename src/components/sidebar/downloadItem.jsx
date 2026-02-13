import React, { useCallback, useState, lazy, Suspense } from 'react';
import { Row, Col, Button, Card, Alert } from 'react-bootstrap';
import { includes } from 'lodash-es';

import { pickDownload } from '../../store/features/downloadThunks';
import { useAppDispatch } from '../../store/hooks';
import { formatDateTime } from '../../store/utils/dateTime';

import './downloadItem.css';

const DownloadModal = lazy(() => import('./downloadModal'));

const DownloadsItem = ({ fetchHistoryItem, contextType }) => {
  const dispatch = useAppDispatch();
  const [show, setShow] = useState(false);

  const handleClose = useCallback(() => {
    setShow(false);
  }, []);

  const handleShow = useCallback((event) => {
    setShow(true);

    if (!fetchHistoryItem.isActive) {
      console.log(event);
      console.log('Loading data from', fetchHistoryItem.requestId, 'to the map');
      dispatch(pickDownload({ ...fetchHistoryItem, contextType }));
    }
  }, [contextType, dispatch, fetchHistoryItem]);

  const fetchKwargs = fetchHistoryItem.fetchKwargs;
  const sensorLocations = fetchKwargs.sensorLocations;
  const gauges = sensorLocations.gauge;
  const pixels = sensorLocations.pixel;
  const hasResults = fetchHistoryItem.results !== false;
  const processedKwargs = fetchHistoryItem.processedKwargs;
  const failedJob = includes(['deferred', 'failed', 'does not exist', 'error', 'timed_out', 'canceled'], fetchHistoryItem.status);
  const failureMessages = (
    Array.isArray(fetchHistoryItem.messages) && fetchHistoryItem.messages.length > 0
      ? fetchHistoryItem.messages
      : [`Rainfall request failed (${fetchHistoryItem.status || 'unknown status'}). Please try again.`]
  );

  return (
    <div className="download-item-wrapper">
      <Row>
        <Col sm={12}>
          <Card.Title>{formatDateTime(fetchKwargs.startDt, 'DD MMM YYYY, h:mm a')} to {formatDateTime(fetchKwargs.endDt, 'DD MMM YYYY, h:mm a')}</Card.Title>
          <hr></hr>
        </Col>
      </Row>

      {gauges.length > 0 ? (
        <Row>
          <Col lg={3}>
            <p className="di-header">Gauges:</p>
          </Col>
          <Col lg={9}>
            <p>{gauges.map((gauge) => gauge.label).join(', ')}</p>
          </Col>
        </Row>
      ) : null}

      {pixels.length > 0 ? (
        <Row>
          <Col lg={3}>
            <p className="di-header">Pixels:</p>
          </Col>
          <Col lg={9}>
            <p>{pixels.length} pixels queried</p>
          </Col>
        </Row>
      ) : null}

      <Row>
        <Col lg={3}>
          <p className="di-header">Aggregation:</p>
        </Col>
        <Col lg={9}>
          <p>{fetchKwargs.rollup}</p>
        </Col>
      </Row>

      {processedKwargs === undefined ? null : (
        <Row>
          <Col lg={3}>
            <p className="di-header">Date/time range queried:</p>
          </Col>
          <Col lg={9}>
            <p>{processedKwargs.start_dt}/{processedKwargs.end_dt}</p>
          </Col>
        </Row>
      )}

      {hasResults ? (
        <Row>
          <Col>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleShow}
            >
              View and Download Results
            </Button>
          </Col>
        </Row>
      ) : null}

      {failedJob ? (
        failureMessages.map((message, index) => (
          <Alert dismissible key={index} variant="danger">
            <small>{`${message}`}</small>
          </Alert>
        ))
      ) : null}

      {show ? (
        <Suspense fallback={<p className="small mb-0"><em>Loading results…</em></p>}>
          <DownloadModal
            show={show}
            onHide={handleClose}
            fetchHistoryItem={fetchHistoryItem}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default DownloadsItem;
