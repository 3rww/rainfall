import { get, includes, intersectionBy, unionBy, xorBy } from 'lodash-es';

import {
  getSelectableSensorTypesForContext,
  SENSOR_TYPES
} from '../config';
import {
  selectFetchKwargs,
  selectMapStyleSourceDataFeatures,
  selectSensorGeographyLookup
} from '../selectors';
import { pickSensor } from './fetchKwargsSlice';
import { highlightSensor } from './mapStyleSlice';
import { transformFeatureToOption } from '../utils/transformers';

const normalizeSensorLocationType = (sensorLocationType) => {
  if (sensorLocationType === 'geography') {
    return 'geographies';
  }
  return sensorLocationType;
};

export const pickSensorMiddleware = (payload, isMappable = true) => {
  const { contextType, selectedOptions, inputType } = payload;
  const sensorLocationType = normalizeSensorLocationType(payload.sensorLocationType);

  return (dispatch, getState) => {
    const state = getState();
    const activeKwargs = selectFetchKwargs(state, contextType);
    const sensorLocations = activeKwargs?.sensorLocations || {};

    let mergedOptions = [];

    if (Array.isArray(selectedOptions)) {
      const newOptions = Array.isArray(selectedOptions)
        ? selectedOptions.filter((option) => option !== null)
        : [];
      const oldOptions = Array.isArray(sensorLocations[sensorLocationType])
        ? [...sensorLocations[sensorLocationType]]
        : [];

      if (inputType === 'geomPicker') {
        mergedOptions = newOptions.length < oldOptions.length
          ? intersectionBy(oldOptions, newOptions, 'value')
          : unionBy(oldOptions, newOptions, 'value');
      } else {
        mergedOptions = xorBy(oldOptions, newOptions, 'value');
      }
    }

    const nextPayload = {
      contextType,
      sensorLocationType,
      selectedOptions: mergedOptions
    };

    dispatch(pickSensor(nextPayload));
    if (isMappable) {
      dispatch(highlightSensor(nextPayload));
    }
  };
};

export const pickSensorByGeographyMiddleware = (payload) => {
  const { selectedOptions, contextType, inputType } = payload;

  return (dispatch, getState) => {
    const state = getState();

    dispatch(pickSensorMiddleware(payload, false));

    const allowedSensorTypes = getSelectableSensorTypesForContext(contextType);
    const allSensorTypes = [SENSOR_TYPES.gauge, SENSOR_TYPES.pixel];
    const disallowedSensorTypes = allSensorTypes.filter((sensorType) => !allowedSensorTypes.includes(sensorType));

    disallowedSensorTypes.forEach((sensorType) => {
      dispatch(pickSensorMiddleware({
        contextType,
        sensorLocationType: sensorType,
        selectedOptions: [],
        inputType
      }));
    });

    allowedSensorTypes.forEach((sensorType) => {
      const sensorIds = new Set();

      if (Array.isArray(selectedOptions) && selectedOptions.length > 0) {
        selectedOptions.forEach((option) => {
          const lookup = selectSensorGeographyLookup(state, option.value);
          get(lookup, sensorType, []).forEach((value) => sensorIds.add(value.toString()));
        });
      }

      const selectedFeatures = selectMapStyleSourceDataFeatures(state, sensorType)
        .filter((feature) => includes([...sensorIds], feature.properties.id));

      const selectedSensorOptions = selectedFeatures.map((feature) => transformFeatureToOption(feature));

      dispatch(pickSensorMiddleware({
        contextType,
        sensorLocationType: sensorType,
        selectedOptions: selectedSensorOptions,
        inputType
      }));
    });
  };
};
