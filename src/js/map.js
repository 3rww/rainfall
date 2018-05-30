var $ = require("jquery");
var d3 = require("d3");
var d3ScaleChromatic = require("d3-scale-chromatic");
var _ = require("lodash");
var L = require("leaflet");
var moment = require("moment");

var store = {
  data: {},
  current: ""
};

// var geojson;
// get grid
//var geojson = await d3.json("http://localhost:3000/data/grid.geojson");

// Make the Leaflet Map
var map = new L.Map("map", {
  center: [40.44, -79.98],
  zoom: 11
});
map.addLayer(
  new L.TileLayer(
    //  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png", {
    //  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
    //   attribution: "Basemap by <a href='https://carto.com'>CARTO</a>"

    // http://mapstack.stamen.com/edit.html#terrain-background[tint=$fff@100]/11/40.4710/-80.0711
    "http://c.sm.mapstack.stamen.com/(terrain-background,$fff[@60],$ffffff[hsl-color])/{z}/{x}/{y}.png"
  )
);
// create another overlay pane for the lines + labels
map.createPane("basemapOverlay");
map.addLayer(
  // new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
  new L.TileLayer(
    // "http://a.sm.mapstack.stamen.com/toner-hybrid[@80]/{z}/{x}/{y}.png", {
    "http://c.sm.mapstack.stamen.com/(streets-and-labels,$ffffff[hsl-color])[@50]/{z}/{x}/{y}.png", {
      attribution: "Basemaps by <a href='http://mapstack.stamen.com'>STAMEN & Mapbox</a>",
      pane: "basemapOverlay"
    }
  )
);

// map.addLayer(
//   new L.geoJSON("https://opendata.arcgis.com/datasets/364f4c3613164f79a1d8c84aed6c03e0_0.geojson")
// )

var g, g2;

function generateViz(rainfallApiData) {
  /**
   * store rainfall tallies from the Rainfall API
   * @param {*} data
   */
  var rainfallTally = class {
    /**
     * pass in the initial API response, and pre-calculate some things
     */
    constructor(data) {
      // store the data
      this.data = data;
      // populate a list of times
      this.times = Object.keys(this.data);
      // total rainfall per cell
      this.total = {};
      // accumulation per cell
      this.accumulation = {};
      this.domainMax = 0;

      // stub out the accumulation property with all cell ids, each set to zero
      Object.keys(this.data[Object.keys(this.data)[0]]).map(x => {
        this.accumulation[x] = 0;
        this.total[x] = 0;
      });

      // calculate total rainfall per cell, and determine max rainfall anywhere
      this._tally();
      // implement a streth function from D3 using available data
      this.stretch = d3
        .scaleLinear()
        .domain([0, this.domainMax])
        .range([0.15, 1]);
    }
    /**
     * helper method, applies mergeWith with an additive customizer function
     * @param {*} source
     * @param {*} plus
     */
    _merger(source, plus) {
      return _.mergeWith(source, plus, function (objValue, srcValue) {
        return objValue + srcValue;
      });
    }
    /**
     * calculate total accumulation per cell. Effectively, this does what accumulator does, except
     * all at once and ahead of time.
     * @param {*} data
     */
    _tally() {
      // accumulate total rainfall per cell from the data
      _.each(this.data, (v, k) => {
        this._merger(this.total, v);
      });
      // set the upper bounds
      _.each(this.total, (v, k) => {
        if (v > this.domainMax) {
          this.domainMax = v;
        }
      });
    }
    /**
     * Increment rainfall total by cell ID, passing in a new rainfall response object for a given time.
     * Updates the accumulation property
     */
    accumulator(addThis) {
      return this._merger(this.accumulation, addThis);
    }
  };

  var frameRate = 150;
  var frameTransition = 50;

  const radigeography = d3
    .scaleSqrt()
    .domain([0, 2])
    .range([0, 15]);

  // add an svg element to the Leaflet Map's Overlay Pane
  var svg_map = d3.select(map.getPanes().overlayPane).append("svg");

  // define the transformation used for the geodata
  var transform = d3.geoTransform({
    point: projectPoint
  });

  // d3geoPath
  var gridAsPath = d3.geoPath().projection(transform);
  // grid container
  var g = svg_map
    .append("g")
    .attr("id", "grid")
    .attr("class", "leaflet-zoom-hide");
  // circle container
  var g2 = svg_map
    .append("g")
    .attr("id", "dots")
    .attr("class", "leaflet-zoom-hide");

  var tally;

  /**
   * Use Leaflet to implement a D3 geometric transformation.
   */
  function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
  }

  /**
   * similar to projectPoint this function converts lat/long to svg coordinates
   * except that it accepts a point from our GeoJSON
   */
  function applyLatLngToLayer(d) {
    var y = d.geometry.coordinates[1];
    var x = d.geometry.coordinates[0];
    if (y & x) {
      var result = map.latLngToLayerPoint(new L.LatLng(y, x));
      return result;
    } else {
      return null;
    }
  }

  function makeCentroid(path, d) {
    var c = path.centroid(d);
    // console.log(c);
    return c;
  }

  /**
   * transforms the rainfall API response for a single point in time into a Map object
   * @param {*} data rainfall API response
   */
  function transformRainfallResponse(data) {
    var d = data;
    var rainfallobj = [];
    // console.log("adding...", geojson, d);
    $.each(d, function (k, v) {
      rainfallobj.push({
        id: k,
        rain: v
      });
    });
    // console.log(rainfallobj);
    var rainfall = new Map(rainfallobj.map(d => [d.id, d.rain]));
    // console.log(rainfall);
    return rainfall;
  }

  /**
   * add the grid to the map as a D3 element
   */
  function addGrid(geojson, rainfall) {
    // append a g element to the svg element - this is where data will go
    var data = geojson.features
      .map(d => {
        var x = ((d.properties.rain = rainfall.get(d.properties.id)), d);
        // console.log(x)
        if (!x.properties.rain) {
          x.properties.rain = 0;
        }
        return x;
      })
      .sort((a, b) => b.properties.id - a.properties.id);

    var gridcell = g
      .selectAll("path")
      .data(data)
      .enter()
      .append("path")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("fill-opacity", 0)
      .attr("id", d => d.properties.id)
      .attr("class", "mapgridcell");

    var circle = g2
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("id", d => d.properties.id)
      .attr("transform", d => `translate(${makeCentroid(gridAsPath, d)})`)
      .attr("r", d => radigeography(d.properties.rain))
      // .attr("stroke", "#3890e2")
      // .attr("stroke-width", 3)
      // .attr("stroke-opacity", 0.3)
      // .attr("fill-opacity", 0.6)
      // .attr("fill", "#3890e2")
      .attr("stroke", "#051133")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.75)
      .attr("fill-opacity", 0)
      .attr("fill", "white");
    // .append("title")
    // .text(d => `${d.properties.rain} inches | ${d.properties.watershed} | ${d.properties.ww_basin} `);

    // add listeners
    map.on("zoomend", reset);
    // reset the view
    reset();

    /**
     * Recalculate bounds for redrawing *grid* each time map changes
     */
    function reset() {
      // console.log("reset");

      // calculate bounds
      var bounds = gridAsPath.bounds(geojson);
      var topLeft = bounds[0];
      var bottomRight = bounds[1];
      svg_map
        .attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

      // calculate translation
      var gTranslate = "translate(" + -topLeft[0] + "," + -topLeft[1] + ")";
      // appy translation to the grid
      g.attr("transform", gTranslate);
      gridcell.attr("d", gridAsPath);

      // apply translation to the circles
      g2
        .attr("transform", gTranslate)
        .selectAll("circle")
        .attr("transform", d => `translate(${makeCentroid(gridAsPath, d)})`);
      circle.attr("d", gridAsPath);
    }
  }

  function updateData(geojson, rainfall) {
    var data = geojson.features
      .map(d => {
        var x = ((d.properties.rain = rainfall.get(d.properties.id)), d);
        // console.log(x)
        if (!x.properties.rain) {
          x.properties.rain = 0;
        }
        return x;
      })
      .sort((a, b) => b.properties.id - a.properties.id);

    var transitionFx = d3
      .transition()
      .duration(frameTransition)
      .ease(d3.easeLinear);
    // .ease(d3.easeSinInOut)

    var gridcell = g
      .selectAll("path")
      .data(data)
      .transition(transitionFx)
      .attr("fill-opacity", d => {
        if (tally.accumulation[d.properties.id] < 0.001) {
          return 0;
        } else {
          return 0.85;
        }
      })
      .attr("fill", d => {
        var v = tally.stretch(tally.accumulation[d.properties.id]);
        if (v == 0) {
          return "#fff";
        } else {
          var c = d3ScaleChromatic.interpolateYlGnBu(v);
          // var c = d3ScaleChromatic.interpolateGnBu(v)
          // var c = d3ScaleChromatic.interpolateBlues(v)
          // var c = d3ScaleChromatic.interpolateCubehelixDefault(1 - v)
          return c;
        }
      });
    // .attr("id", d => d.properties.id)
    // .attr("class", "mapgridcell")

    var circle = g2
      .selectAll("circle")
      .data(data)
      .transition(transitionFx)
      .attr("transform", d => `translate(${makeCentroid(gridAsPath, d)})`)
      .attr("r", d => radigeography(d.properties.rain))
      .text(
        d =>
        `${d.properties.rain} inches | ${d.properties.watershed} | ${
            d.properties.ww_basin
          } `
      );

    return;
  }

  function run(geojson, data) {
    // parse the response
    tally = new rainfallTally(data);
    console.log(tally);

    // set the max rainfall for the legend
    $("#rainfall-max").html(tally.domainMax.toFixed(3));

    // set the progress bar

    // set up the viz and add in the first record
    // console.log("starting at", Object.keys(data)[0]);
    updateTimestamp(Object.keys(data)[0]);
    var first = data[Object.keys(data)[0]];
    addGrid(geojson, transformRainfallResponse(first));
    tally.accumulator(first);

    // then, process the remaining records (with a timeout).
    var i = 0;

    function doUpdate() {
      var pct = (i / tally.times.length) * 100;
      $(".progress-bar").width(`${pct}%`);
      i++;
      if (i >= Object.keys(data).length) {
        $(".progress-bar").width('100%');
        return;
      }
      setTimeout(function () {
        var t = Object.keys(data)[i];
        var next = data[t];
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
  $.ajax("/data/grid.geojson", {
    success: function (geojson, status, jqXHR) {
      var data;
      // console.log(geojson, typeof (geojson));
      if (typeof (geojson) === 'string') {
        data = JSON.parse(geojson);
      } else {
        data = geojson
      }
      run(data, rainfallApiData);
    }
  })
}

function resetViz() {
  $("#status-bar").hide();
  $(".leaflet-overlay-pane").empty();
  $("#timestamp").empty();
  $("#rainfall-max").empty();
  console.log("viz reset")
}

function replayViz(id) {
  if (store.data) {
    console.log("replaying viz");
    $("#status-bar").show();
    $(".leaflet-overlay-pane").empty();
    $("#timestamp").empty();
    $("#rainfall-max").empty();
    generateViz(store.data[store.current]);
  } else {
    console.log("no viz loaded to replay");
  }
}

function getData(dataURL, id, callback) {
  $("#status-bar").show();
  if (store.data.hasOwnProperty(id)) {
    console.log("Using data already acquired...");
    $(".progress-bar").removeClass('progress-bar-animated').width(0).addClass('bg-success');
    callback(store.data[id]);
  } else {
    console.log("Requesting data...");
    $(".progress-bar").removeClass('bg-success').addClass('progress-bar-animated').width('100%');
    $.ajax(dataURL, {
      method: "POST",
      success: function (data, status, jqXHR) {
        console.log("...data received.");
        $(".progress-bar").removeClass('progress-bar-animated').width(0).addClass('bg-success');
        store.data[id] = data;
        callback(store.data[id]);
      }
    });
  }

}

function updateTimestamp(timestamp) {
  var t = moment(timestamp).format("dddd, MMMM Do YYYY, h:mm:ss a");
  $("#timestamp").html(t);
}

$(".event-list-item").on("click", function (e) {
  resetViz();
  console.log(e.currentTarget.dataset.id);
  store.current = e.currentTarget.dataset.id
  var url =
    "http://3rww-rainfall-api.civicmapper.com/api/garrd/?interval=15-minute&basin=&ids=&keyed_by=time&zerofill=false&dates=" +
    store.current;
  getData(url, store.current, generateViz);
});

$("#reset-button").on("click", function (e) {
  resetViz();
});

$("#replay-button").on("click", function (e) {
  replayViz();
});