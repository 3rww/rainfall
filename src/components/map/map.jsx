import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import Immutable from 'immutable';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { isEmpty } from 'lodash-es';

import {
  setStyle,
  mapLoaded,
  startThinking,
  stopThinking
} from '../../store/actions';
import { initDataFetch } from '../../store/middleware';
import { LAYERS_W_MOUSEOVER } from '../../store/config'
import diffStyles from '../../utilities/styleSpecDiff';

import { Tooltip } from './tooltip'
import MapLegend from './legend'

import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import './map.scss'

let DEBUG = true
const MAPID = 'map'

class ReactMap extends Component {

  constructor(props) {
    super(props);
    this.state = {
      features: [],
    };
  }

  tooltipContainer;

  componentDidMount() {
    this.props.loadingMap()
    // create and load the map
    this.loadMap()
  }

  componentWillReceiveProps(nextProps) {
    // update the map if the style sheet has changed
    this.updateMapStyle(nextProps.mapStyle)
  }

  setTooltip(features) {
    if (features.length) {
      ReactDOM.render(
        React.createElement(
          Tooltip, {
          features
        }
        ),
        this.tooltipContainer
      );
    } else {
      ReactDOM.unmountComponentAtNode(this.tooltipContainer)
    }
  }

    makeTooltipOnHover(e, tooltip) {
      if (e === undefined ) {
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
   * create the MapboxGL Map from our initial map state object in redux (initMap)
   * and set the created map's style sheet into the redux (mapStyle)
   */
  loadMap() {

    // set up the map
    const mapConfig = {
      container: MAPID,
      style: this.props.initMap.mapboxSources["3rww-rainfall-base"].url,
      center: [this.props.initMap.longitude, this.props.initMap.latitude],
      zoom: this.props.zoom,
      attributionControl: false
    }

    mapboxgl.accessToken = this.props.token;
    this.webmap = new mapboxgl.Map(mapConfig);

    // setup the tooltip
    // Container to put React generated content in.
    this.tooltipContainer = document.createElement('div');
    const tooltip = new mapboxgl.Marker(this.tooltipContainer, {
      offset: [105, 0]
    }).setLngLat([0,0]).addTo(this.webmap);

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

    });

    // ----------------------------------------------
    // LAYER INTERACTIVITY

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

  }


  /**
   * call this to update the map style. Utilizes Mapbox's diffStyles algorithm 
   * to turn differences between existing and next style sheets into mapbox
   * expressions used to programmatically modify the stylesheet
   */
  updateMapStyle(nextPropsMapStyle) {

    // if the mapStyles prop (passed in from redux) is null/empty, nothing
    // to do here
    if (this.props.mapStyle === null || isEmpty(this.props.mapStyle)) {
      return
    };

    const thisMap = this.webmap;

    // uses the stylesheets read into Immutable objects for the comparison

    // 'oldStyle' is what we have in redux
    const oldStyle = Immutable.fromJS(this.props.mapStyle);

    // newStyle is what we've just received
    const newStyle = Immutable.fromJS(nextPropsMapStyle);

    // diffstyles crosswalks the difference in mapStyle to the types
    // of mapboxGL map methods that would need to be executed to make the change.
    if (!Immutable.is(oldStyle, newStyle)) {
      // console.log("changes detected between old and new style")
      let changes = diffStyles(oldStyle.toJS(), newStyle.toJS());
      if (DEBUG) { console.log(`updating mapStyle (${changes.map(c => c.command)})`) }

      // if changes are detected, then we apply each one to the map
      // this executes map methods to do things like pan, zoom, change layer
      // visibility and filters, and CRUD data sources

      changes.forEach((change) => {

        // NOTE: this is a workaround for the setGeoJSONSourceData command,
        // which was throwing an error when called. We simply do what it otherwise
        // would have done to the style via the map's method.
        if (change.command == "setGeoJSONSourceData") {
          // thisMap.setGeoJSONSourceData.apply(thisMap, change.args)
          // console.log(change.args)
          let src = thisMap.getSource(change.args[0])
          // console.log(src)
          if (src) {
            src.setData(change.args[1])
          }
        } else {
          // console.log(thisMap)
          // console.log(thisMap[change.command])
          thisMap[change.command].apply(thisMap, change.args);
        }
      });
    }
  }

  render() {

    return (
      <div className="map-and-legend-container">
        <div className="map" id={MAPID}></div>
        <div className="legend-container container-fluid">
          <MapLegend/>
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
    }
  }
}



export default connect(mapStateToProps, mapDispatchToProps)(ReactMap);