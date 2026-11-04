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
} from '../../store/selectors';
import {
  pickSensorMiddleware,
  pickSensorByGeographyMiddleware
} from '../../store/features/selectionThunks';
import {
  pluralize
} from '../../store/utils/index';
import { CONTEXT_TYPES } from '../../store/config';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

const isValidOptionValue = (value) => (
  value !== undefined
  && value !== null
  && `${value}`.trim() !== ''
);

const MAX_PIXEL_CHIPS = 10;

const ActiveGeodataPicker = ({ contextType }) => {
  const dispatch = useAppDispatch();

  const pixelFeatures = useAppSelector((state) => selectMapStyleSourceDataFeatures(state, 'pixel'));
  const gaugeFeatures = useAppSelector((state) => selectMapStyleSourceDataFeatures(state, 'gauge'));
  const geographyOpts = useAppSelector(selectGeographyLookupsAsGroupedOptions);
  const selectedPixels = useAppSelector((state) => selectPickedSensors(state, contextType, 'pixel'));
  const selectedGauges = useAppSelector((state) => selectPickedSensors(state, contextType, 'gauge'));
  const selectedGeographies = useAppSelector((state) => selectPickedSensors(state, contextType, 'geographies'));

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
  const summarizePixels = pixelCount > MAX_PIXEL_CHIPS;

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
          <Tabs defaultActiveKey="sensor" id="geomPickerTypes" mountOnEnter unmountOnExit>
            <Tab eventKey="sensor" title="By Sensor" className="my-4">
              {contextType !== CONTEXT_TYPES.legacyGarr ? (
                <Row className="g-0">
                  <Col md={3}>
                    <small>Rain Gauges</small>
                  </Col>
                  <Col md={9}>
                    <Select
                      instanceId="geom-picker-gauge"
                      inputId="geom-picker-gauge-input"
                      aria-label="Rain Gauges"
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

              {contextType !== CONTEXT_TYPES.legacyGauge ? (
                <Row className="g-0">
                  <Col md={3}>
                    <small>Radar Pixels</small>
                  </Col>
                  <Col md={9}>
                    {/* Skip creating pixel chips for large selections, rather than hiding their DOM. */}
                    <Select
                      instanceId="geom-picker-pixel"
                      inputId="geom-picker-pixel-input"
                      aria-label="Radar Pixels"
                      aria-describedby={summarizePixels ? 'geom-picker-pixel-help' : undefined}
                      classNamePrefix="pixel-select"
                      isMulti
                      value={selectedPixels}
                      controlShouldRenderValue={!summarizePixels}
                      placeholder={summarizePixels ? `${pixelCount} pixels selected` : 'Select...'}
                      hideSelectedOptions={!summarizePixels}
                      onChange={handleSelectPixel}
                      options={pixelOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                    {summarizePixels && (
                      <small id="geom-picker-pixel-help" className="text-muted">
                        Search for a pixel to add or remove it, or clear all selections.
                      </small>
                    )}
                  </Col>
                </Row>
              ) : null}
            </Tab>

            {contextType !== CONTEXT_TYPES.legacyGauge ? (
              <Tab eventKey="geography" title="By Geography" className="my-4">
                <Row className="g-0">
                  <Col md={12}>
                    <Select
                      instanceId="geom-picker-geography"
                      inputId="geom-picker-geography-input"
                      aria-label="Basin, municipality, watershed, or region"
                      placeholder="Select radar pixels by basin, municipality, watershed, or region"
                      isMulti
                      value={selectedGeographies}
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

const GeodataPicker = ({ contextType }) => {
  const context = useAppSelector(selectContext);
  return context === contextType ? <ActiveGeodataPicker contextType={contextType} /> : null;
};

export default GeodataPicker;
