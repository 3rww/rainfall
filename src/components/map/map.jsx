import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { connect } from 'react-redux';
import Immutable from 'immutable';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { isEmpty, has, forEach, get } from 'lodash-es';

import {
  setStyle,
  mapLoaded,
  startThinking,
  stopThinking
} from '../../store/actions';
import { initDataFetch, pickSensorMiddleware } from '../../store/middleware';
import { LAYERS_W_MOUSEOVER } from '../../store/config'
import diffStyles from '../../utilities/styleSpecDiff';
import { transformFeatureToOption } from '../../store/utils/transformers'

import { Tooltip } from './tooltip'
import MapLegend from './legend'

import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import './map.scss'

let DEBUG = true
const MAPID = 'map'
const LAYERS_W_SELECT = LAYERS_W_MOUSEOVER.map(i => i[0])

class ReactMap extends Component {

  constructor(props) {
    super(props);
    this.state = {
      features: [],
    };
  }

  tooltipContainer;
  tooltipRoot;

  componentDidMount() {
    this.props.loadingMap()
    // create and load the map
    this.loadMap()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.mapStyle !== this.props.mapStyle) {
      this.updateMapStyle(prevProps.mapStyle, this.props.mapStyle)
    }
  }

  componentWillUnmount() {
    if (this.tooltipRoot) {
      this.tooltipRoot.unmount()
      this.tooltipRoot = null
    }
    if (this.webmap) {
      this.webmap.remove()
      this.webmap = null
    }
  }

  setTooltip(features) {
    if (!this.tooltipRoot) {
      return
    }
    if (features.length) {
      this.tooltipRoot.render(<Tooltip features={features} />);
    } else {
      this.tooltipRoot.render(null)
    }
  }

  makeTooltipOnHover(e, tooltip) {
    if (e === undefined) {
      return
    }
    const layersToQuery = ['HOVER-pixel', 'HOVER-gauge']
    // query tilesets with mouse hover
    const features = this.webmap.queryRenderedFeatures(e.point, {
      layers: layersToQuery
    });
    tooltip.setLngLat(e.lngLat);
    this.webmap.getCanvas().style.cursor = features.length ? 'pointer' : '';
    this.setTooltip(features);
    this.setState({
      features: features
    })
  }

  /**
   * run queryRenderedFeatures, using currentOverlays in redux store
   */
  handleMapClick(e) {
    // set bbox as 5px reactangle area around clicked point
    const bbox = [[e.point.x - 1, e.point.y - 1], [e.point.x + 1, e.point.y + 1]];

    /**
     * query rendered features
     * This may return multiple features. 
     */
    let features = this.webmap.queryRenderedFeatures(bbox, { layers: LAYERS_W_SELECT });
    

    // group selected features by the value of the `source` property;
    // {gauge: [value: 5, label: ]}
    let selectionsBySensorType = {};

    if (features.length > 0) {

      features.forEach(f => {

        let opt = transformFeatureToOption(f)

        // push those to an array within an object by sensor type
        if (has(selectionsBySensorType, f.source)) {
          selectionsBySensorType[f.source].push(opt)
        } else {
          selectionsBySensorType[f.source] = [opt]
        }
      })

      // for each sensor type, run the mapDispatchToProps function
      forEach(selectionsBySensorType, (v, k) => {
          this.props.makeChoiceOnMapClick({
            sensorLocationType: k,
            selectedOptions: v
          })
      })

      

      //   // pass the feature layer ID, layer source, and properties as a flat object to the connector


    }

  }


  /**
   * create the MapboxGL Map from our initial map state object in redux (initMap)
   * and set the created map's style sheet into the redux (mapStyle)
   */
  loadMap() {
    const basemapStyleUrl = this.props.initMap.mapboxSources["3rww-rainfall-base"].url
    if (!basemapStyleUrl) {
      console.error("Missing Mapbox style URL. Set VITE_MAPBOX_STYLE_BASEMAP in your .env file.")
      return
    }

    // set up the map
    const mapConfig = {
      container: MAPID,
      style: basemapStyleUrl,
      center: [this.props.initMap.longitude, this.props.initMap.latitude],
      zoom: this.props.zoom,
      attributionControl: false
    }

    mapboxgl.accessToken = this.props.token;
    this.webmap = new mapboxgl.Map(mapConfig);

    // setup the tooltip
    // Container to put React generated content in.
    this.tooltipContainer = document.createElement('div');
    this.tooltipRoot = createRoot(this.tooltipContainer);
    const tooltip = new mapboxgl.Marker({
      element: this.tooltipContainer,
      offset: [105, 0]
    }).setLngLat([0, 0]).addTo(this.webmap);

    this.webmap.on('load', () => {

      // ----------------------------------------------
      // CONTROLS

      // add a geocoder for quick map searches
      this.webmap.addControl(new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        placeholder: "Fly me to...",
        marker: false,
        collapsed: true,
        clearAndBlurOnEsc: true,
        clearOnBlur: true,
        countries: 'us'
      }));
      // add the navigation control
      this.webmap.addControl(new mapboxgl.NavigationControl());
      // add the custom attribution control
      this.webmap.addControl(new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: this.props.initMap.attribution
      }));

      // ----------------------------------------------
      // SOURCES AND LAYERS
      // add sources and layers not in the hosted style but configured in the
      // seed here:

      // add sources here
      this.props.initMap.sourcesToAdd.forEach(src => {
        this.webmap.addSource(src.sourceName, src.sourceData)
      })
      // add the style layers here
      this.props.initMap.layersToAdd.forEach(layer => {
        layer.layerStyles.forEach(layerStyle => {
          // insert the layer above this layer already in the style:
          this.webmap.addLayer(layerStyle, layer.addLayerStylesAbove)
        })
      })

      // ----------------------------------------------
      // STYLE TO STORE

      // Get the entire map stylesheet from the loaded map and put it in the 
      // mapStyle object state tree via (ulimtately) the setStyle action
      let style = this.webmap.getStyle();
      this.props.setStyle(style);

      // console.log("map loaded")
      //dispatch the mapLoadded action
      this.props.mapLoaded(this.webmap.loaded());

      this.props.initFetchData()

      let hoveredStateId = {};

      LAYERS_W_MOUSEOVER.forEach((lyrRef) => {
        let lyrName = lyrRef[0]
        let lyrSrc = lyrRef[1]

        hoveredStateId[lyrName] = null;
        // When the user moves their mouse over the HOVER-* layer, we'll update the
        // feature state for the feature under the mouse.
        this.webmap.on('mousemove', lyrName, (e) => {

          this.makeTooltipOnHover(e, tooltip)

          this.webmap.getCanvas().style.cursor = e.features.length ? 'pointer' : '';
          if (e.features.length > 0) {
            if (hoveredStateId[lyrName]) {
              this.webmap.setFeatureState(
                { source: lyrSrc, id: hoveredStateId[lyrName] },
                { hover: false }
              );
            }
            hoveredStateId[lyrName] = e.features[0].id;
            this.webmap.setFeatureState(
              { source: lyrSrc, id: hoveredStateId[lyrName] },
              { hover: true }
            );
          }
        });

        // When the mouse leaves the HOVER-* layer, update the feature state of the
        // previously hovered feature.
        this.webmap.on('mouseleave', lyrName, (e) => {

          this.makeTooltipOnHover(e, tooltip)

          this.webmap.getCanvas().style.cursor = '';
          if (hoveredStateId[lyrName]) {
            this.webmap.setFeatureState(
              { source: lyrSrc, id: hoveredStateId[lyrName] },
              { hover: false }
            );
          }
          hoveredStateId[lyrName] = null;
        });
      })

    });

    // ----------------------------------------------
    // BIND LAYER INTERACTIVITY MAP EVENTS TO ACTIONS

    this.webmap.on('click', (e) => this.handleMapClick(e))

  }


  /**
   * call this to update the map style. Utilizes Mapbox's diffStyles algorithm 
   * to turn differences between existing and next style sheets into mapbox
   * expressions used to programmatically modify the stylesheet
   */
  updateMapStyle(previousMapStyle, nextMapStyle) {

    // if the mapStyles prop (passed in from redux) is null/empty, nothing
    // to do here
    if (
      !this.webmap ||
      previousMapStyle === null ||
      isEmpty(previousMapStyle) ||
      nextMapStyle === null ||
      isEmpty(nextMapStyle)
    ) {
      return
    };

    const thisMap = this.webmap;

    // uses the stylesheets read into Immutable objects for the comparison

    // 'oldStyle' is what we have in redux
    const oldStyle = Immutable.fromJS(previousMapStyle);

    // newStyle is what we've just received
    const newStyle = Immutable.fromJS(nextMapStyle);

    // diffstyles crosswalks the difference in mapStyle to the types
    // of mapboxGL map methods that would need to be executed to make the change.
    if (!Immutable.is(oldStyle, newStyle)) {
      // console.log("changes detected between old and new style")
      let changes = diffStyles(oldStyle.toJS(), newStyle.toJS());
      if (DEBUG) { console.log(`updating mapStyle (${changes.map(c => c.command)})`) }

      // if changes are detected, then we apply each one to the map
      // this executes map methods to do things like pan, zoom, change layer
      // visibility and filters, and CRUD data sources
      changes.forEach((change) => this.executeMapChange(thisMap, change));
    }
  }

  getSourceLayerIds(map, sourceId) {
    const style = map.getStyle && map.getStyle()
    if (!style || !style.layers) {
      return []
    }

    return style.layers
      .filter(layer => layer.source === sourceId)
      .map(layer => layer.id)
  }

  executeMapChange(map, change) {
    const { command, args = [] } = change

    if (command === "setGeoJSONSourceData") {
      const sourceId = args[0]
      const source = map.getSource(sourceId)
      if (source && typeof source.setData === "function") {
        source.setData(args[1])
      } else {
        console.warn(`[mapStyle] setGeoJSONSourceData skipped: source "${sourceId}" is missing or non-geojson`)
      }
      return
    }

    if (command === "removeLayer") {
      const layerId = args[0]
      if (!map.getLayer(layerId)) {
        if (DEBUG) console.debug(`[mapStyle] removeLayer noop: layer "${layerId}" is already absent`)
        return
      }
      try {
        map.removeLayer(layerId)
      } catch (error) {
        console.warn(`[mapStyle] removeLayer failed for layer "${layerId}"`, error)
      }
      return
    }

    if (command === "removeSource") {
      const sourceId = args[0]
      if (!map.getSource(sourceId)) {
        if (DEBUG) console.debug(`[mapStyle] removeSource noop: source "${sourceId}" is already absent`)
        return
      }

      // Defensive cleanup: Mapbox requires removing dependent layers before a source.
      this.getSourceLayerIds(map, sourceId).forEach((layerId) => {
        if (!map.getLayer(layerId)) {
          return
        }
        try {
          map.removeLayer(layerId)
          if (DEBUG) console.debug(`[mapStyle] removed dependent layer "${layerId}" before source "${sourceId}"`)
        } catch (error) {
          console.warn(`[mapStyle] failed removing dependent layer "${layerId}" for source "${sourceId}"`, error)
        }
      })

      try {
        map.removeSource(sourceId)
      } catch (error) {
        console.warn(`[mapStyle] removeSource failed for source "${sourceId}"`, error)
      }
      return
    }

    if (command === "addSource") {
      const sourceId = args[0]
      if (map.getSource(sourceId)) {
        if (DEBUG) console.debug(`[mapStyle] addSource noop: source "${sourceId}" already exists`)
        return
      }
      try {
        map.addSource(...args)
      } catch (error) {
        console.warn(`[mapStyle] addSource failed for source "${sourceId}"`, error)
      }
      return
    }

    if (command === "addLayer") {
      const layerId = args[0] && args[0].id ? args[0].id : "unknown-layer"
      if (layerId !== "unknown-layer" && map.getLayer(layerId)) {
        if (DEBUG) console.debug(`[mapStyle] addLayer noop: layer "${layerId}" already exists`)
        return
      }
      try {
        map.addLayer(...args)
      } catch (error) {
        console.warn(`[mapStyle] addLayer failed for layer "${layerId}"`, error)
      }
      return
    }

    const mapMethod = map[command]
    if (typeof mapMethod !== "function") {
      console.warn(`[mapStyle] unsupported command "${command}"`)
      return
    }

    try {
      mapMethod.apply(map, args)
    } catch (error) {
      const primaryId = args[0] !== undefined ? ` (${String(args[0])})` : ""
      console.warn(`[mapStyle] command "${command}" failed${primaryId}`, error)
    }
  }

  render() {

    return (
      <div className="map-and-legend-container">
        <div className="map" id={MAPID}></div>
        <div className="legend-container container-fluid">
          <MapLegend />
        </div>
      </div>
    );
  }

}

function mapStateToProps(state) {
  return {
    mapStyle: state.mapStyle,
    initMap: state.initMap,
  };
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    loadingMap: payload => {
      dispatch(startThinking("Loading the map"))
    },
    setStyle: payload => {
      dispatch(setStyle(payload))
    },
    mapLoaded: payload => {
      dispatch(mapLoaded(payload))
      dispatch(stopThinking("Map loaded"))
    },
    initFetchData: payload => {
      return dispatch(initDataFetch(payload))
    },
    makeChoiceOnMapClick: payload => {
      // console.log("map:")
      dispatch(pickSensorMiddleware({
        contextType: ownProps.activeTab,
        ...payload
      }))
    },    
  }
}



export default connect(mapStateToProps, mapDispatchToProps)(ReactMap);
