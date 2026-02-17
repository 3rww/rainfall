import React, { useMemo, useCallback } from 'react';
import {
  Row,
  Col,
  Badge,
  Tabs,
  Tab
} from 'react-bootstrap';

import Select from 'react-select';

import {
  selectMapStyleSourceDataFeatures,
  selectGeographyLookupsAsGroupedOptions,
  selectPickedSensors,
  selectContext
} from '../../../store/selectors';
import {
  pickSensorMiddleware,
  pickSensorByGeographyMiddleware
} from '../../../store/features/selectionThunks';
import {
  pluralize
} from '../../../store/utils/index';
import { CONTEXT_TYPES } from '../../../store/config';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';

const isValidOptionValue = (value) => (
  value !== undefined
  && value !== null
  && `${value}`.trim() !== ''
);

const GeodataPicker = ({ contextType }) => {
  const dispatch = useAppDispatch();

  const context = useAppSelector(selectContext);
  const pixelFeatures = useAppSelector((state) => selectMapStyleSourceDataFeatures(state, 'pixel'));
  const gaugeFeatures = useAppSelector((state) => selectMapStyleSourceDataFeatures(state, 'gauge'));
  const geographyOpts = useAppSelector(selectGeographyLookupsAsGroupedOptions);
  const selectedPixels = useAppSelector((state) => selectPickedSensors(state, contextType, 'pixel'));
  const selectedGauges = useAppSelector((state) => selectPickedSensors(state, contextType, 'gauge'));

  const pixelOpts = useMemo(() => pixelFeatures
    .filter((feature) => isValidOptionValue(feature?.properties?.id))
    .map((feature) => ({ value: `${feature.properties.id}`, label: `${feature.properties.id}` })), [pixelFeatures]);

  const gaugeOpts = useMemo(() => gaugeFeatures
    .filter((feature) => feature.properties.active === true)
    .filter((feature) => isValidOptionValue(feature?.properties?.id))
    .map((feature) => ({
      value: `${feature.properties.id}`,
      label: `${feature.properties.id}: ${feature.properties.name}`
    })), [gaugeFeatures]);

  const gaugeCount = selectedGauges.length;
  const pixelCount = selectedPixels.length;

  const handleSelectGauge = useCallback((selectedOptions) => {
    dispatch(pickSensorMiddleware({
      contextType,
      inputType: 'geomPicker',
      sensorLocationType: 'gauge',
      selectedOptions
    }));
  }, [contextType, dispatch]);

  const handleSelectPixel = useCallback((selectedOptions) => {
    dispatch(pickSensorMiddleware({
      contextType,
      inputType: 'geomPicker',
      sensorLocationType: 'pixel',
      selectedOptions
    }));
  }, [contextType, dispatch]);

  const handleSelectGeography = useCallback((selectedOptions) => {
    dispatch(pickSensorByGeographyMiddleware({
      contextType,
      inputType: 'geomPicker',
      sensorLocationType: 'geography',
      selectedOptions
    }));
  }, [contextType, dispatch]);

  return (
    <div>
      <Row className="g-0 mb-2">
        <Col>
          <strong>Where</strong>
          {gaugeCount > 0 ? (
            <span className="mx-1 my-1"><Badge pill bg="primary">
              {`${gaugeCount} ${pluralize(gaugeCount, 'gauge', 'gauges')}`}
            </Badge>
            </span>
          ) : null}
          {pixelCount > 0 ? (
            <span className="mx-1 my-1"><Badge pill bg="primary">
              {`${pixelCount} ${pluralize(pixelCount, 'pixel', 'pixels')}`}
            </Badge>
            </span>
          ) : null}
        </Col>
      </Row>

      <Row className="g-0">
        <Col>
          <Tabs defaultActiveKey="sensor" id="geomPickerTypes">
            <Tab eventKey="sensor" title="By Sensor" className="my-4">
              {context !== CONTEXT_TYPES.legacyGarr ? (
                <Row className="g-0">
                  <Col md={3}>
                    <small>Rain Gauges</small>
                  </Col>
                  <Col md={9}>
                    <Select
                      instanceId="geom-picker-gauge"
                      inputId="geom-picker-gauge-input"
                      isMulti
                      value={selectedGauges}
                      onChange={handleSelectGauge}
                      options={gaugeOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                  </Col>
                </Row>
              ) : null}

              {context !== CONTEXT_TYPES.legacyGauge ? (
                <Row className="g-0">
                  <Col md={3}>
                    <small>Radar Pixels</small>
                  </Col>
                  <Col md={9}>
                    <Select
                      instanceId="geom-picker-pixel"
                      inputId="geom-picker-pixel-input"
                      isMulti
                      value={selectedPixels}
                      onChange={handleSelectPixel}
                      options={pixelOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                  </Col>
                </Row>
              ) : null}
            </Tab>

            {context !== CONTEXT_TYPES.legacyGauge ? (
              <Tab eventKey="geography" title="By Geography" className="my-4">
                <Row className="g-0">
                  <Col md={12}>
                    <Select
                      instanceId="geom-picker-geography"
                      inputId="geom-picker-geography-input"
                      placeholder="Select radar pixels by basin, municipality, or watershed"
                      isMulti
                      onChange={handleSelectGeography}
                      options={geographyOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                  </Col>
                </Row>
              </Tab>
            ) : null}
          </Tabs>
        </Col>
      </Row>
    </div>
  );
};

export default GeodataPicker;
