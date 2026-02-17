import React, { useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useStore } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import { isEmpty, has, forEach } from 'lodash-es';

import {
  setStyle
} from '../../store/features/mapStyleSlice';
import {
  mapLoaded,
  setInitialStyleLoaded,
  startThinking,
  stopThinking
} from '../../store/features/progressSlice';
import { initDataFetch } from '../../store/features/appInitThunks';
import { pickSensorMiddleware } from '../../store/features/selectionThunks';
import { ENABLE_DEBUG_LOGS, LAYERS_W_MOUSEOVER, getInteractiveMapLayersForContext } from '../../store/config';
import diffStyles from '../../utilities/styleSpecDiff';
import { transformFeatureToOption } from '../../store/utils/transformers';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import { Tooltip } from './tooltip';
import MapLegend from './legend';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import './map.css';

const DEBUG = ENABLE_DEBUG_LOGS;
const MAPID = 'map';
const E2E_TEST_MODE = import.meta.env.VITE_E2E_TEST === 'true';

const ReactMap = ({ activeTab, token, zoom }) => {
  const dispatch = useAppDispatch();
  const store = useStore();
  const mapStyle = useAppSelector((state) => state.mapStyle);
  const initMap = useAppSelector((state) => state.initMap);

  const webmapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const tooltipContainerRef = useRef(null);
  const tooltipRootRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  const previousMapStyleRef = useRef(mapStyle);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const setTooltip = useCallback((features) => {
    if (!tooltipRootRef.current) {
      return;
    }

    if (features.length > 0) {
      tooltipRootRef.current.render(<Tooltip features={features} />);
      return;
    }

    tooltipRootRef.current.render(null);
  }, []);

  const makeTooltipOnHover = useCallback((event, tooltip) => {
    const map = webmapRef.current;
    if (!map || event === undefined) {
      return;
    }

    const layersToQuery = getInteractiveMapLayersForContext(activeTabRef.current);
    if (layersToQuery.length === 0) {
      map.getCanvas().style.cursor = '';
      setTooltip([]);
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: layersToQuery
    });

    tooltip.setLngLat(event.lngLat);
    map.getCanvas().style.cursor = features.length ? 'pointer' : '';
    setTooltip(features);
  }, [setTooltip]);

  const handleMapClick = useCallback((event) => {
    const map = webmapRef.current;
    if (!map) {
      return;
    }

    const layersToQuery = getInteractiveMapLayersForContext(activeTabRef.current);
    if (layersToQuery.length === 0) {
      return;
    }

    const bbox = [[event.point.x - 1, event.point.y - 1], [event.point.x + 1, event.point.y + 1]];
    const features = map.queryRenderedFeatures(bbox, { layers: layersToQuery });
    const selectionsBySensorType = {};

    if (features.length === 0) {
      return;
    }

    features.forEach((feature) => {
      const option = transformFeatureToOption(feature);
      if (has(selectionsBySensorType, feature.source)) {
        selectionsBySensorType[feature.source].push(option);
      } else {
        selectionsBySensorType[feature.source] = [option];
      }
    });

    forEach(selectionsBySensorType, (selectedOptions, sensorLocationType) => {
      dispatch(pickSensorMiddleware({
        contextType: activeTabRef.current,
        sensorLocationType,
        selectedOptions
      }));
    });
  }, [dispatch]);

  const getSourceLayerIds = useCallback((map, sourceId) => {
    const style = map.getStyle && map.getStyle();
    if (!style || !style.layers) {
      return [];
    }

    return style.layers
      .filter((layer) => layer.source === sourceId)
      .map((layer) => layer.id);
  }, []);

  const executeMapChange = useCallback((map, change) => {
    const { command, args = [] } = change;

    if (command === 'setGeoJSONSourceData') {
      const sourceId = args[0];
      const source = map.getSource(sourceId);
      const rawData = args[1];
      const normalizedData = (
        rawData
        && typeof rawData === 'object'
        && rawData.type === 'geojson'
        && rawData.data
      )
        ? rawData.data
        : rawData;
      if (source && typeof source.setData === 'function') {
        source.setData(normalizedData);
      } else {
        console.warn(`[mapStyle] setGeoJSONSourceData skipped: source "${sourceId}" is missing or non-geojson`);
      }
      return;
    }

    if (command === 'removeLayer') {
      const layerId = args[0];
      if (!map.getLayer(layerId)) {
        if (DEBUG) {
          console.debug(`[mapStyle] removeLayer noop: layer "${layerId}" is already absent`);
        }
        return;
      }

      try {
        map.removeLayer(layerId);
      } catch (error) {
        console.warn(`[mapStyle] removeLayer failed for layer "${layerId}"`, error);
      }
      return;
    }

    if (command === 'removeSource') {
      const sourceId = args[0];
      if (!map.getSource(sourceId)) {
        if (DEBUG) {
          console.debug(`[mapStyle] removeSource noop: source "${sourceId}" is already absent`);
        }
        return;
      }

      getSourceLayerIds(map, sourceId).forEach((layerId) => {
        if (!map.getLayer(layerId)) {
          return;
        }

        try {
          map.removeLayer(layerId);
          if (DEBUG) {
            console.debug(`[mapStyle] removed dependent layer "${layerId}" before source "${sourceId}"`);
          }
        } catch (error) {
          console.warn(`[mapStyle] failed removing dependent layer "${layerId}" for source "${sourceId}"`, error);
        }
      });

      try {
        map.removeSource(sourceId);
      } catch (error) {
        console.warn(`[mapStyle] removeSource failed for source "${sourceId}"`, error);
      }
      return;
    }

    if (command === 'addSource') {
      const sourceId = args[0];
      if (map.getSource(sourceId)) {
        if (DEBUG) {
          console.debug(`[mapStyle] addSource noop: source "${sourceId}" already exists`);
        }
        return;
      }

      try {
        map.addSource(...args);
      } catch (error) {
        console.warn(`[mapStyle] addSource failed for source "${sourceId}"`, error);
      }
      return;
    }

    if (command === 'addLayer') {
      const layerId = args[0] && args[0].id ? args[0].id : 'unknown-layer';
      if (layerId !== 'unknown-layer' && map.getLayer(layerId)) {
        if (DEBUG) {
          console.debug(`[mapStyle] addLayer noop: layer "${layerId}" already exists`);
        }
        return;
      }

      try {
        map.addLayer(...args);
      } catch (error) {
        console.warn(`[mapStyle] addLayer failed for layer "${layerId}"`, error);
      }
      return;
    }

    const mapMethod = map[command];
    if (typeof mapMethod !== 'function') {
      console.warn(`[mapStyle] unsupported command "${command}"`);
      return;
    }

    try {
      mapMethod.apply(map, args);
    } catch (error) {
      const primaryId = args[0] !== undefined ? ` (${String(args[0])})` : '';
      console.warn(`[mapStyle] command "${command}" failed${primaryId}`, error);
    }
  }, [getSourceLayerIds]);

  const updateMapStyle = useCallback((previousMapStyle, nextMapStyle) => {
    const map = webmapRef.current;

    if (
      !map
      || previousMapStyle === null
      || isEmpty(previousMapStyle)
      || nextMapStyle === null
      || isEmpty(nextMapStyle)
    ) {
      return;
    }

    const changes = diffStyles(previousMapStyle, nextMapStyle);
    if (DEBUG) {
      console.log(`updating mapStyle (${changes.map((change) => change.command)})`);
    }
    changes.forEach((change) => executeMapChange(map, change));
  }, [executeMapChange]);

  useEffect(() => {
    dispatch(startThinking('Loading the map'));

    const basemapStyleUrl = initMap?.mapboxSources?.['3rww-rainfall-base']?.url;
    if (!basemapStyleUrl) {
      console.error('Missing Mapbox style URL. Set VITE_MAPBOX_STYLE_BASEMAP in your .env file.');
      return undefined;
    }

    const mapConfig = {
      container: MAPID,
      style: basemapStyleUrl,
      center: [initMap.longitude, initMap.latitude],
      zoom,
      attributionControl: false
    };

    mapboxgl.accessToken = token;
    const webmap = new mapboxgl.Map(mapConfig);
    webmapRef.current = webmap;
    let didInitializeApp = false;

    const initializeApp = (loaded = true, message = 'Map loaded') => {
      if (didInitializeApp) {
        return;
      }
      didInitializeApp = true;
      dispatch(setInitialStyleLoaded(true));
      dispatch(mapLoaded(loaded));
      dispatch(stopThinking(message));
      dispatch(initDataFetch({ subscribe: store.subscribe }));
    };

    const resizeMap = () => {
      if (webmapRef.current) {
        webmapRef.current.resize();
      }
    };

    const resizeObserver = (
      typeof ResizeObserver !== 'undefined' && mapContainerRef.current
        ? new ResizeObserver(() => resizeMap())
        : null
    );
    if (resizeObserver && mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }
    window.addEventListener('resize', resizeMap);

    tooltipContainerRef.current = document.createElement('div');
    tooltipRootRef.current = createRoot(tooltipContainerRef.current);
    const tooltip = new mapboxgl.Marker({
      element: tooltipContainerRef.current,
      offset: [105, 0]
    }).setLngLat([0, 0]).addTo(webmap);

    const fallbackInitTimer = (
      E2E_TEST_MODE
        ? setTimeout(() => {
          initializeApp(true, 'Map loaded (e2e fallback)');
        }, 1500)
        : null
    );

    webmap.on('load', () => {
      import('@mapbox/mapbox-gl-geocoder')
        .then((geocoderModule) => {
          const MapboxGeocoder = geocoderModule.default || geocoderModule;
          const activeMap = webmapRef.current;
          if (!activeMap) {
            return;
          }

          activeMap.addControl(new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl,
            placeholder: 'Fly me to...',
            marker: false,
            collapsed: true,
            clearAndBlurOnEsc: true,
            clearOnBlur: true,
            countries: 'us'
          }));
        })
        .catch((error) => {
          console.warn('[map] geocoder control disabled: failed to load @mapbox/mapbox-gl-geocoder', error);
        });

      webmap.addControl(new mapboxgl.NavigationControl());
      webmap.addControl(new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: initMap.attribution
      }));

      initMap.sourcesToAdd.forEach((sourceDef) => {
        webmap.addSource(sourceDef.sourceName, sourceDef.sourceData);
      });

      initMap.layersToAdd.forEach((layerDef) => {
        layerDef.layerStyles.forEach((layerStyle) => {
          webmap.addLayer(layerStyle, layerDef.addLayerStylesAbove);
        });
      });

      // Ensure map canvas dimensions reflect final flex layout on first paint.
      resizeMap();
      requestAnimationFrame(() => resizeMap());

      dispatch(setStyle(webmap.getStyle()));
      initializeApp(webmap.loaded(), 'Map loaded');

      const hoveredStateId = {};
      LAYERS_W_MOUSEOVER.forEach((layerRef) => {
        const layerName = layerRef[0];
        const layerSource = layerRef[1];

        hoveredStateId[layerName] = null;

        webmap.on('mousemove', layerName, (event) => {
          const interactiveLayers = getInteractiveMapLayersForContext(activeTabRef.current);
          if (!interactiveLayers.includes(layerName)) {
            setTooltip([]);
            webmap.getCanvas().style.cursor = '';

            if (hoveredStateId[layerName]) {
              webmap.setFeatureState(
                { source: layerSource, id: hoveredStateId[layerName] },
                { hover: false }
              );
            }
            hoveredStateId[layerName] = null;
            return;
          }

          makeTooltipOnHover(event, tooltip);

          if (event.features.length > 0) {
            if (hoveredStateId[layerName]) {
              webmap.setFeatureState(
                { source: layerSource, id: hoveredStateId[layerName] },
                { hover: false }
              );
            }

            hoveredStateId[layerName] = event.features[0].id;
            webmap.setFeatureState(
              { source: layerSource, id: hoveredStateId[layerName] },
              { hover: true }
            );
          }
        });

        webmap.on('mouseleave', layerName, () => {
          setTooltip([]);
          webmap.getCanvas().style.cursor = '';

          if (hoveredStateId[layerName]) {
            webmap.setFeatureState(
              { source: layerSource, id: hoveredStateId[layerName] },
              { hover: false }
            );
          }

          hoveredStateId[layerName] = null;
        });
      });
    });

    webmap.on('click', (event) => handleMapClick(event));

    return () => {
      if (fallbackInitTimer) {
        clearTimeout(fallbackInitTimer);
      }
      window.removeEventListener('resize', resizeMap);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (tooltipRootRef.current) {
        const tooltipRoot = tooltipRootRef.current;
        tooltipRootRef.current = null;
        // In development strict mode, cleanup can run while React is still
        // processing renders. Defer unmount to avoid re-entrant root warnings.
        setTimeout(() => {
          tooltipRoot.unmount();
        }, 0);
      }
      if (webmapRef.current) {
        webmapRef.current.remove();
        webmapRef.current = null;
      }
    };
  // Intentionally initialize map only once on mount; map interactions read latest tab via refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previousMapStyle = previousMapStyleRef.current;
    if (previousMapStyle !== mapStyle) {
      updateMapStyle(previousMapStyle, mapStyle);
      previousMapStyleRef.current = mapStyle;
    }
  }, [mapStyle, updateMapStyle]);

  return (
    <div className="map-and-legend-container">
      <div className="map" id={MAPID} ref={mapContainerRef}></div>
      <div className="legend-container container-fluid">
        <MapLegend />
      </div>
    </div>
  );
};

export default ReactMap;
