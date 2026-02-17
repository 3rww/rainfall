import React, { useCallback, useMemo } from 'react';
import {
  Card,
  Button
} from 'react-bootstrap';
import { isEmpty } from 'lodash-es';

import DateTimePicker from '../datetimePicker';
import GeodataPicker from '../geomPicker';
import IntervalPicker from '../intervalPicker';
import DownloadsList from '../downloadList';

import { fetchRainfallDataFromApiV2 } from '../../../store/features/rainfallThunks';
import {
  makeSelectSelectedSensors,
  selectFetchHistory
} from '../../../store/selectors';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';

import './downloader.css';

const RainfallDownloader = ({ rainfallDataType, contextType }) => {
  const dispatch = useAppDispatch();
  const selectSelectedSensorsByContext = useMemo(makeSelectSelectedSensors, []);

  const hasKwargs = useAppSelector((state) => {
    const selectedSensors = selectSelectedSensorsByContext(state, contextType);
    return !isEmpty(selectedSensors);
  });

  const hasDownloads = useAppSelector((state) => {
    const downloadHistory = selectFetchHistory(state, contextType);
    return downloadHistory.length > 0;
  });

  const handleDownloadClick = useCallback(() => {
    dispatch(fetchRainfallDataFromApiV2({
      rainfallDataType,
      contextType
    }));
  }, [contextType, dispatch, rainfallDataType]);

  return (
    <div>
      <Card>
        <Card.Body>
          <DateTimePicker
            rainfallDataType={rainfallDataType}
            contextType={contextType}
          />
          <hr></hr>
          <GeodataPicker
            rainfallDataType={rainfallDataType}
            contextType={contextType}
          />
          <hr></hr>
          <IntervalPicker
            rainfallDataType={rainfallDataType}
            contextType={contextType}
          />
          <hr></hr>
          <Button
            onClick={handleDownloadClick}
            disabled={!hasKwargs}
            className="w-100"
          >
            Get Rainfall Data
          </Button>
        </Card.Body>
      </Card>
      <br></br>
      {hasDownloads ? (
        <Card>
          <Card.Header>
            Retrieved Rainfall Data
          </Card.Header>
          <DownloadsList
            contextType={contextType}
            rainfallDataType={rainfallDataType}
          />
        </Card>
      ) : null}
    </div>
  );
};

export default RainfallDownloader;
