var $ = (jQuery = require("jquery"));
var d3 = require("d3");
var L = require("leaflet");
topojson = require("topojson-client");

var url =
  "http://3rww-rainfall-api.civicmapper.com/api/garrd/?dates=2004-09-17T03%3A00%2F2004-09-18T00%3A00&interval=Hourly&basin=Saw%20Mill%20Run&ids=&zerofill=false";

function d31() {
  // Make the Leaflet Map
  var map = new L.Map("map", {
    center: [40.44, -79.98],
    zoom: 10
  }).addLayer(
    // new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
    new L.TileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png",
      {
        attribution: "Voyager Basemap by <a href='https://carto.com'>CARTO</a>"
      }
    )
  );

  /**
   * Use Leaflet to implement a D3 geometric transformation.
   */
  function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
  }

  const radigeography = d3
    .scaleSqrt()
    .domain([0, 5])
    .range([0, 15]);

  // add an svg element to the Leaflet Map's Overlay Pane
  var svg_map = d3.select(map.getPanes().overlayPane).append("svg");
  // append a g element to the svg element - this is where data will go
  var g = svg_map.append("g").attr("class", "leaflet-zoom-hide");
  // define the transformation used for the geodata
  var transform = d3.geoTransform({
    point: projectPoint
  });
  var gridAsPath = d3.geoPath().projection(transform);

  /**
   * add the grid to the map as a D3 element
   */
  function addGrid(geojson) {
    // define the path object

    var feature = g
      .selectAll("path")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("class", "mapgridcell");

    // add listeners
    // map.on("viewreset", reset);
    map.on("zoomend", reset);
    // map.on("moveend", reset);

    // reset the view
    reset();

    /**
     * Recalculate bounds for redrawing *grid* each time map changes
     */
    function reset() {
      console.log("reset");
      var bounds = gridAsPath.bounds(geojson);
      var topLeft = bounds[0];
      var bottomRight = bounds[1];

      svg_map
        .attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

      g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

      feature.attr("d", gridAsPath);
    }
  }

  function addData(geojson, data) {
    // sample from timeseries test data
    var rainfallobj = [];
    var d = data["2004-09-17T13:00:00"];
    console.log("adding...", geojson, d);
    $.each(d, function(i, v) {
      rainfallobj.push({
        id: i,
        rain: v
      });
    });
    var rainfall = new Map(rainfallobj.map(d => [d.id, d.rain]));
    console.log(rainfall);

    var g2 = svg_map
      .append("g")
      .attr("class", "leaflet-zoom-hide")
      .attr("fill", "blue")
      .attr("fill-opacity", 0.2)
      // .attr("stroke", "#fff")
      // .attr("stroke-width", 0.1)
      .selectAll("circle")
      .data(
        geojson.features
          .map(d => {
            var x = ((d.rain = rainfall.get(d.id)), d);
            if (!x.rain) {
              x.rain = 0;
            }
            // console.log(x);
            return x;
          })
          .sort((a, b) => b.id - a.id)
        // topojson
        //   .feature(geography, geography.objects)
        //   .features.map(d => ((d.population = population.get(d.id)), d))
        //   .sort((a, b) => b.id - a.id)
      )
      .enter()
      .append("circle")
      .attr("id", d => d.id)
      .attr("transform", d => `translate(${gridAsPath.centroid(d)})`)
      .attr("r", d => radigeography(d.rain))
      .append("title")
      .text(d => d.id);

    map.on("zoomend", resetData);
    // map.on("moveend", reset);

    // reset the view
    resetData();

    /**
     * Recalculate bounds for redrawing *grid* each time map changes
     */
    function resetData() {
      var bounds = gridAsPath.bounds(geojson);
      var topLeft = bounds[0];
      var bottomRight = bounds[1];
      console.log("reset", bounds, topLeft, bottomRight);

      svg_map
        .attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

      g2.attr(
        "transform",
        "translate(" + -topLeft[0] + "," + -topLeft[1] + ")"
      );

      g2.attr("d", gridAsPath);
    }
  }

  // get grid and add it
  d3.json("http://localhost:3000/data/grid.geojson", function(geojson) {
    addGrid(geojson);
    d3.json("http://localhost:3000/data/test.json", function(data) {
      addData(geojson, data);
    });
  });
}

// run this map-making function
d31();
