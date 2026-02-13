import { createSlice } from '@reduxjs/toolkit';
import { cloneDeep, get, includes } from 'lodash-es';

import { initialState } from '../initialState';
import { LAYERS_W_RESULTS } from '../config';
import { buildRainfallColorStyleExp } from '../utils/mb';

const unwrapSourcePayload = (payload) => {
  if (
    payload
    && typeof payload === 'object'
    && payload.type === 'geojson'
    && payload.data
  ) {
    return {
      sourceType: 'geojson',
      sourceData: payload.data
    };
  }

  return {
    sourceType: 'geojson',
    sourceData: payload
  };
};

const mapStyleSlice = createSlice({
  name: 'mapStyle',
  initialState: initialState.mapStyle,
  reducers: {
    setStyle: (_state, action) => action.payload,
    addLayers: (state, action) => {
      (action.payload || []).forEach((layerConfig) => {
        if (layerConfig && Object.prototype.hasOwnProperty.call(layerConfig, 'INDEX')) {
          const { INDEX, ...layer } = layerConfig;
          const layers = [...(state.layers || [])];
          layers.splice(INDEX, 0, layer);
          state.layers = layers;
          return;
        }

        if (!Array.isArray(state.layers)) {
          state.layers = [];
        }
        state.layers.push(layerConfig);
      });
    },
    setSourceData: (state, action) => {
      const { sourceName, data } = action.payload || {};
      if (!sourceName) {
        return;
      }
      const { sourceType, sourceData } = unwrapSourcePayload(data);

      if (!state.sources) {
        state.sources = {};
      }

      if (!state.sources[sourceName]) {
        state.sources[sourceName] = {
          type: sourceType,
          data: sourceData
        };
        return;
      }

      state.sources[sourceName].type = state.sources[sourceName].type || sourceType;
      state.sources[sourceName].data = sourceData;
    },
    setSourceDataBatch: (state, action) => {
      const sourceDataByName = action.payload?.sourceDataByName || {};
      Object.entries(sourceDataByName).forEach(([sourceName, data]) => {
        const { sourceType, sourceData } = unwrapSourcePayload(data);

        if (!state.sources) {
          state.sources = {};
        }

        if (!state.sources[sourceName]) {
          state.sources[sourceName] = {
            type: sourceType,
            data: sourceData
          };
        } else {
          state.sources[sourceName].type = state.sources[sourceName].type || sourceType;
          state.sources[sourceName].data = sourceData;
        }
      });
    },
    resetLayerSrcs: (state, action) => {
      const sourceDataByName = action.payload?.sourceDataByName || {};
      Object.entries(sourceDataByName).forEach(([sourceName, data]) => {
        const { sourceType, sourceData } = unwrapSourcePayload(data);

        if (!state.sources) {
          state.sources = {};
        }

        if (!state.sources[sourceName]) {
          state.sources[sourceName] = {
            type: sourceType,
            data: cloneDeep(sourceData)
          };
        } else {
          state.sources[sourceName].type = state.sources[sourceName].type || sourceType;
          state.sources[sourceName].data = cloneDeep(sourceData);
        }
      });
    },
    highlightSensor: (state, action) => {
      const { sensorLocationType, selectedOptions } = action.payload || {};
      const features = get(state, ['sources', sensorLocationType, 'data', 'features'], []);
      const selectedIds = Array.isArray(selectedOptions)
        ? selectedOptions.map((option) => option.value)
        : [];

      features.forEach((feature) => {
        feature.properties.selected = includes(selectedIds, feature.id);
      });
    },
    applyColorStretch: (state, action) => {
      const { breaks } = action.payload || {};
      const { colorExp } = buildRainfallColorStyleExp('total', breaks);
      const mapLayers = get(state, ['layers'], []);

      LAYERS_W_RESULTS.forEach((layerId) => {
        if (!Array.isArray(mapLayers)) {
          return;
        }

        const layer = mapLayers.find((candidate) => candidate.id === layerId);
        if (!layer || !layer.type || !layer.paint) {
          return;
        }

        layer.paint[`${layer.type}-color`] = colorExp;
      });
    }
  }
});

export const {
  setStyle,
  addLayers,
  setSourceData,
  setSourceDataBatch,
  resetLayerSrcs,
  highlightSensor,
  applyColorStretch
} = mapStyleSlice.actions;

export default mapStyleSlice.reducer;
