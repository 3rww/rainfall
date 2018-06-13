/**----------------------------------------
 * dependencies
 */

import {
  easeLinear,
  geoPath,
  geoTransform,
  scaleSqrt,
  select,
  transition,
} from 'd3';
import { interpolateYlGnBu } from 'd3-scale-chromatic';
import $, {
  ajax,
  each,
} from 'jquery';
import {
  LatLng,
  Map as LeafletMap,
  TileLayer,
} from 'leaflet';
import moment from 'moment';

// local
import { store, RainfallTally } from './store';


/**----------------------------------------
 * constants and vars
 */

// svg layers
let svgGrid;
let svgDots;


/**----------------------------------------
 * main exports
 */

// Leaflet map
export const leafletMap = setupMap();

export function attachEventPlayerListeners() {
  console.log('attachEventPlayerListeners');
  $('#reset-button').on('click', () => {
    resetViz();
  });

  $('#replay-button').on('click', () => {
    replayViz();
  });

  $('.event-list-item').on('click', (e) => {
    resetViz();
    console.log(e.currentTarget.dataset.id);
    store.current = e.currentTarget.dataset.id;
    const url = `https://3rww-rainfall-api.civicmapper.com/api/garrd/?interval=15-minute&basin=&ids=&keyed_by=time&zerofill=false&dates=${
      store.current}`;
    getData(url, store.current, generateViz);
  });
}

/**----------------------------------------
 * core logic
 */

function setupMap() {
  const leafletMap = new LeafletMap('map', {
    center: [40.44, -79.98],
    zoom: 11,
  });

  leafletMap.addLayer(new TileLayer(
    //  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png", {
    //  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
    //   attribution: "Basemap by <a href='https://carto.com'>CARTO</a>"
    // http://mapstack.stamen.com/edit.html#terrain-background[tint=$fff@100]/11/40.4710/-80.0711
    'http://c.sm.mapstack.stamen.com/(terrain-background,$fff[@60],$ffffff[hsl-color])/{z}/{x}/{y}.png'));
  // create another overlay pane for the lines + labels
  leafletMap.createPane('basemapOverlay');
  leafletMap.addLayer(new TileLayer(
    // "http://a.sm.mapstack.stamen.com/toner-hybrid[@80]/{z}/{x}/{y}.png", {
    'http://c.sm.mapstack.stamen.com/(streets-and-labels,$ffffff[hsl-color])[@50]/{z}/{x}/{y}.png', {
      attribution: "Basemaps by <a href='http://mapstack.stamen.com'>STAMEN & Mapbox</a>",
      pane: 'basemapOverlay',
    }));

  return leafletMap;
}

function generateViz(rainfallApiData) {
  const frameRate = 150;
  const frameTransition = 50;

  const radigeography = scaleSqrt()
    .domain([0, 2])
    .range([0, 15]);

  // add an svg element to the Leaflet Map's Overlay Pane
  const svgMap = select(leafletMap.getPanes().overlayPane).append('svg');

  // define the transformation used for the geodata
  const transform = geoTransform({
    point: projectPoint,
  });

  // d3geoPath
  const gridAsPath = geoPath().projection(transform);

  // grid container
  svgGrid = svgMap
    .append('g')
    .attr('id', 'grid')
    .attr('class', 'leaflet-zoom-hide');
  // circle container
  svgDots = svgMap
    .append('g')
    .attr('id', 'dots')
    .attr('class', 'leaflet-zoom-hide');

  let tally;

  /**
   * Use Leaflet to implement a D3 geometric transformation.
   */
  function projectPoint(x, y) {
    const point = leafletMap.latLngToLayerPoint(new LatLng(y, x));
    this.stream.point(point.x, point.y);
  }

  function makeCentroid(path, d) {
    const c = path.centroid(d);
    // console.log(c);
    return c;
  }

  /**
   * transforms the rainfall API response for a single point in time into a Map object
   * @param {*} data rainfall API response
   */
  function transformRainfallResponse(data) {
    const d = data;
    const rainfallobj = [];
    // console.log("adding...", geojson, d);
    each(d, (k, v) => {
      rainfallobj.push({
        id: k,
        rain: v,
      });
    });
    // console.log(rainfallobj);
    const rainfall = new Map(rainfallobj.map(d => [d.id, d.rain]));
    // console.log(rainfall);
    return rainfall;
  }

  /**
   * add the grid to the map as a D3 element
   */
  function addGrid(geojson, rainfall) {
    // append a g element to the svg element - this is where data will go
    const data = geojson.features
      .map((d) => {
        const x = ((d.properties.rain = rainfall.get(d.properties.id)), d);
        // console.log(x)
        if (!x.properties.rain) {
          x.properties.rain = 0;
        }
        return x;
      })
      .sort((a, b) => b.properties.id - a.properties.id);

    const gridcell = svgGrid
      .selectAll('path')
      .data(data)
      .enter()
      .append('path')
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('fill-opacity', 0)
      .attr('id', d => d.properties.id)
      .attr('class', 'mapgridcell');

    const circle = svgDots
      .selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('id', d => d.properties.id)
      .attr('transform', d => `translate(${makeCentroid(gridAsPath, d)})`)
      .attr('r', d => radigeography(d.properties.rain))
      // .attr("stroke", "#3890e2")
      // .attr("stroke-width", 3)
      // .attr("stroke-opacity", 0.3)
      // .attr("fill-opacity", 0.6)
      // .attr("fill", "#3890e2")
      .attr('stroke', '#051133')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.75)
      .attr('fill-opacity', 0)
      .attr('fill', 'white');
    // .append("title")
    // .text(d => `${d.properties.rain} inches | ${d.properties.watershed} | ${d.properties.ww_basin} `);

    // add listeners to reset the view
    leafletMap.on('zoomend', reset);
    // reset the view
    reset();

    /**
     * Recalculate bounds for redrawing *grid* each time map changes
     */
    function reset() {
      // console.log("reset");

      // calculate bounds
      const bounds = gridAsPath.bounds(geojson);
      const topLeft = bounds[0];
      const bottomRight = bounds[1];
      svgMap
        .attr('width', bottomRight[0] - topLeft[0])
        .attr('height', bottomRight[1] - topLeft[1])
        .style('left', `${topLeft[0]}px`)
        .style('top', `${topLeft[1]}px`);

      // calculate translation
      const gTranslate = `translate(${-topLeft[0]},${-topLeft[1]})`;
      // appy translation to the grid
      svgGrid.attr('transform', gTranslate);
      gridcell.attr('d', gridAsPath);

      // apply translation to the circles
      svgDots
        .attr('transform', gTranslate)
        .selectAll('circle')
        .attr('transform', d => `translate(${makeCentroid(gridAsPath, d)})`);
      circle.attr('d', gridAsPath);
    }
  }

  function updateData(geojson, rainfall) {
    const data = geojson.features
      .map((d) => {
        const x = ((d.properties.rain = rainfall.get(d.properties.id)), d);
        // console.log(x)
        if (!x.properties.rain) {
          x.properties.rain = 0;
        }
        return x;
      })
      .sort((a, b) => b.properties.id - a.properties.id);

    const transitionFx = transition()
      .duration(frameTransition)
      .ease(easeLinear);
    // .ease(d3.easeSinInOut)

    const gridcell = svgGrid
      .selectAll('path')
      .data(data)
      .transition(transitionFx)
      .attr('fill-opacity', (d) => {
        if (tally.accumulation[d.properties.id] < 0.001) {
          return 0;
        }
        return 0.85;
      })
      .attr('fill', (d) => {
        const v = tally.stretch(tally.accumulation[d.properties.id]);
        if (v === 0) {
          return '#fff';
        }
        const c = interpolateYlGnBu(v);
        // var c = d3ScaleChromatic.interpolateGnBu(v)
        // var c = d3ScaleChromatic.interpolateBlues(v)
        // var c = d3ScaleChromatic.interpolateCubehelixDefault(1 - v)
        return c;
      });
    // .attr("id", d => d.properties.id)
    // .attr("class", "mapgridcell")

    const circle = svgDots
      .selectAll('circle')
      .data(data)
      .transition(transitionFx)
      .attr('transform', d => `translate(${makeCentroid(gridAsPath, d)})`)
      .attr('r', d => radigeography(d.properties.rain))
      .text(
        d =>
        `${d.properties.rain} inches | ${d.properties.watershed} | ${
            d.properties.ww_basin
          } `,
      );
  }

  function run(geojson, data) {
    // parse the response
    tally = new RainfallTally(data);
    console.log(tally);

    // set the max rainfall for the legend
    $('#rainfall-max').html(tally.domainMax.toFixed(3));

    // set the progress bar

    // set up the viz and add in the first record
    // console.log("starting at", Object.keys(data)[0]);
    updateTimestamp(Object.keys(data)[0]);
    const first = data[Object.keys(data)[0]];
    addGrid(geojson, transformRainfallResponse(first));
    tally.accumulator(first);

    // then, process the remaining records (with a timeout).
    let i = 0;

    function doUpdate() {
      const pct = (i / tally.times.length) * 100;
      $('.progress-bar').width(`${pct}%`);
      i++;
      if (i >= Object.keys(data).length) {
        $('.progress-bar').width('100%');
        return;
      }
      setTimeout(() => {
        const t = Object.keys(data)[i];
        const next = data[t];
        tally.accumulator(next);
        // console.log(now)
        updateTimestamp(t);
        updateData(geojson, transformRainfallResponse(next));
        doUpdate();
      }, frameRate);
    }

    doUpdate();

    // then, clear the circles (?)
  }

  // get grid and add it
  ajax(`${window.location}data/grid.geojson`, {
    success(geojson) {
      let data;
      // console.log(geojson, typeof (geojson));
      if (typeof (geojson) === 'string') {
        data = JSON.parse(geojson);
      } else {
        data = geojson;
      }
      run(data, rainfallApiData);
    },
  });
}

function resetViz() {
  $('#status-bar').hide();
  $('.leaflet-overlay-pane').empty();
  $('#timestamp').empty();
  $('#rainfall-max').empty();
  console.log('viz reset');
}

function replayViz() {
  if (store.data) {
    console.log('replaying viz');
    $('#status-bar').show();
    $('.leaflet-overlay-pane').empty();
    $('#timestamp').empty();
    $('#rainfall-max').empty();
    generateViz(store.data[store.current]);
  } else {
    console.log('no viz loaded to replay');
  }
}

function getData(dataURL, id, callback) {
  $('#status-bar').show();
  // if (store.data.hasOwnProperty(id)) {
  if (Object.prototype.hasOwnProperty.call(store, 'id')) {
    console.log('Using data already acquired...');
    $('.progress-bar').removeClass('progress-bar-animated').width(0).addClass('bg-success');
    callback(store.data[id]);
  } else {
    console.log('Requesting data...');
    $('.progress-bar').removeClass('bg-success').addClass('progress-bar-animated').width('100%');
    ajax(dataURL, {
      method: 'POST',
      success(data) {
        console.log('...data received.');
        $('.progress-bar').removeClass('progress-bar-animated').width(0).addClass('bg-success');
        store.data[id] = data;
        callback(store.data[id]);
      },
    });
  }
}

function updateTimestamp(timestamp) {
  const t = moment(timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a');
  $('#timestamp').html(t);
}