var List = require("list.js");

var options = {
  valueNames: ["date", "name"],
  item:
    '<li class="list-group-item"><span class="date"></span> <span class="name small"></span></li>'
};

var values = [
  { name: "Hurricane Ivan", date: "Sept 2004" },
  { name: "Fall 2016", date: "Sept 2016" },
  { name: "Spring Storm 2018", date: "March 2018" },
  { name: "Spring Storm 2 2018", date: "April 2018" }
];

var hackerList = new List("event-list", options, values);
