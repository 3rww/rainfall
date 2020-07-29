import React, { Component } from 'react';
import { connect } from 'react-redux';
import Immutable from 'immutable';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { isEmpty } from 'lodash-es'

import { 
  setStyle, 
  mapLoaded, 
  startThinking, 
  stopThinking 
} from '../../store/actions';
import { initDataFetch } from '../../store/middleware';
import { transformToMapboxSourceObject } from '../../store/utils'

import {
  URL_GARRD_GEOJSON,
  URL_GAUGE_GEOJSON,
  MAP_LAYERS
} from '../../store/config'

import diffStyles from '../../utilities/styleSpecDiff';

import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import './map.scss'


let DEBUG = true
const MAPID = 'map'

class ReactMap extends Component {

  constructor(props) {
    super(props);
    this.state = {
      zoom: 0,
      lng: 0,
      lat: 0,
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

  //   setTooltip(features) {
  //     if (features.length) {
  //       ReactDOM.render(
  //         React.createElement(
  //           Tooltip, {
  //             features
  //           }
  //         ),
  //         this.tooltipContainer
  //       );
  //     } else {
  //     	ReactDOM.unmountComponentAtNode(this.tooltipContainer)
  //     }
  //   }

  /**
   * run queryRenderedFeatures, using currentOverlays in redux store
   */
  //   handleMapClick(e) {
  //     // set bbox as 5px reactangle area around clicked point
  //     const bbox = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];

  //     /**
  //      * query rendered features
  //      */
  //     let features = this.webmap.queryRenderedFeatures(bbox, { layers: this.props.activeOverlays });
  //     // if we've hit a feature from currentOverlays
  //     if (features.length > 0) {
  //       // console.log('querying rendered features')
  //       features.forEach(f => {
  //         this.props.makeChoiceOnMapClick({ layerId: f.layer.id, ...f.properties })
  //       })
  //     } else {
  //       // console.log('querying highlights instead')
  //       // if we didn't hit a feature from currentOverlays but did hit a feature from currentHighlights...
  //       // (this happens where we have selections and filtering on the map, and we don't want to lose
  //       // the selections across filters)
  //       features = this.webmap.queryRenderedFeatures(bbox, { layers: this.props.currentHighlights });
  //       if (features.length > 0) {
  //         // we use that layer to figure out what our base layer was, and trigger the map click that way.
  //         features
  //           .filter(f => (f.layer.id.startsWith(LYR_HIGHLIGHT_PREFIX) && !f.layer.id.endsWith(LYR_HIGHLIGHT_SUFFIX)))
  //           .forEach(f => {
  //             const layerId = getBaseLayerIdFromHighlightLayerId(f.layer.id)
  //             // console.log(f.layer.id, layerId)
  //             this.props.makeChoiceOnMapClick({ layerId: layerId, ...f.properties })
  //           })
  //       }
  //     }
  //   }

  /**
   * store zoom and center in the local component state
   */
  //   handleMapMove(e) {
  //     // console.log(e)
  //     this.setState({
  //       zoom: e.zoom,
  //       lng: e.lng,
  //       lat: e.lat
  //     })
  //   }

  //   handleHover(e, tooltip) {
  //     const layersToQuery = [...this.props.currentOverlays, ...this.props.refOverlays].filter(lyr => !includes(['ppt-concept-areas'], lyr))
  //     // query tilesets with mouse hover
  //     const features = this.webmap.queryRenderedFeatures(e.point, { 
  //       layers: layersToQuery
  //     });
  //     tooltip.setLngLat(e.lngLat);
  //     this.webmap.getCanvas().style.cursor = features.length ? 'pointer' : '';
  //     this.setTooltip(features);
  //     this.setState({
  //       features: features
  //     })
  //   }

  mapSources = [{
      url: URL_GAUGE_GEOJSON,
      pathArray: ["mapStyle", "sources", "gauge"],
      transformer: transformToMapboxSourceObject
    },{
      url: URL_GARRD_GEOJSON,
      pathArray: ["mapStyle", "sources", "pixel"],
      transformer: transformToMapboxSourceObject
  }]
  /**
   * asynchronously fetch map layers,
   * return when all fetches have completed
   */
  fetchMapLayers() {
    


  }



  /**
   * create the MapboxGL Map from our initial map state object in redux (initMap)
   * and set the created map's style sheet into the redux (mapStyle)
   */
  loadMap() {

    // console.log("loading the map")
    // console.log(this.props.initMap)
    // ({initMap, styleUrl, longitude, latitude, zoom, token } = this.props.initMap)

    const { lng, lat, zoom } = this.state;

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
    // this.tooltipContainer = document.createElement('div');
    // const tooltip = new mapboxgl.Marker(this.tooltipContainer, {
    //   offset: [105, 0]
    // }).setLngLat([0,0]).addTo(this.webmap);

    this.webmap.on('load', () => {

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

      // Get the entire map stylesheet from the loaded map and put it in the 
      // mapStyle object state tree via (ulimtately) the setStyle action
      let style = this.webmap.getStyle();
      // style = {
      //   ...style,
      //   transition: {
      //     "duration": 50,
      //     "delay": 0
      //   }
      // }
      // // console.log("set style 1")
      this.props.setStyle(style);


      // console.log("map loaded")
      //dispatch the mapLoadded action
      this.props.mapLoaded(this.webmap.loaded());

      // dispatch actions that add geojson sources to the mapStyle.source object in redux,
      // this.fetchMapLayers().then(() => {
      //   // then add the layers
      //   this.props.addLayersToMap(mapLayers)
      // })

      this.props.initFetchData()
        
      


    });

    // this.webmap.on('move', () => {
    //   const { lng, lat } = this.webmap.getCenter();
    //   this.handleMapMove({
    //     lng: Number(lng.toFixed(4)),
    //     lat: Number(lat.toFixed(4)),
    //     zoom: Number(this.webmap.getZoom().toFixed(2))
    //   })
    // });
    // this.webmap.on('mousemove', (e) => this.handleHover(e, tooltip))
    // this.webmap.on('click', (e) => this.handleMapClick(e))

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
      if (DEBUG) { console.log(`updating mapStyle (${changes.map(c => c.command)})`)}

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

  // updateControlVisibility()

  render() {

    // const { lng, lat, zoom} = this.state;

    return (
      // <div className="map-container">
      //   <div className="inline-block absolute top left mt12 ml12 bg-darken75 color-white z1 py6 px12 txt-s txt-bold">
      //     <div>{`Longitude: ${lng} Latitude: ${lat} Zoom: ${zoom}`}</div>
      //   </div>
      <div className="map" id={MAPID}></div>
      // </div>
    );
  }

}

// class Tooltip extends React.Component {
//   render() {
//     const { features } = this.props;
//     const c = features.filter(f => f.properties.title !== undefined).length

//     const renderFeature = (feature, i) => {
//       return (
//         <ListGroup.Item key={i}>
//           <span className="small">{feature.properties.title}</span>
//           {/* <strong className='mr3'>{feature.layer['source-layer']}:</strong>
//           <span className='color-gray-light'>{feature.layer.id}</span> */}
//         </ListGroup.Item>
//       )
//     };

//     if (c > 0) {
//       return (
//         <Card style={{ width: '180px' }}>
//           <ListGroup variant="flush">
//             {features.filter(f => f.properties.title !== undefined).map(renderFeature)}
//           </ListGroup>
//         </Card>
//       )
//     } else {
//       return null
//     }
//   }
// }

function mapStateToProps(state) {
  return {
    mapStyle: state.mapStyle,
    initMap: state.initMap,
  };
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    // makeChoiceOnMapClick: payload => {
    //   dispatch(makeChoiceOnMapClick(payload))
    // },
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