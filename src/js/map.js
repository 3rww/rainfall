var d3 = require("d3");

var url =
  "http://3rww-rainfall-api.civicmapper.com/api/garrd/?dates=2004-09-17T03%3A00%2F2004-09-18T00%3A00&interval=Hourly&basin=Saw%20Mill%20Run&ids=&zerofill=false";

d3
  .json("http://localhost:5000/api/garrd/grid?geom=polygon")
  .then(function(json) {
    console.log(json);

    var w = 400;
    var h = 400;

    var svg = d3
      .select("#chart")
      .append("svg")
      .attr("width", w)
      .attr("height", h);

    console.log(svg);

    //create geo.path object, set the projection to merator bring it to the svg-viewport
    var path = d3.geo.path().projection(d3.geo.mercator());

    console.log(path);

    //draw svg lines of the boundries
    svg
      .append("g")
      .attr("class", "black")
      .selectAll("path")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path);
  });
