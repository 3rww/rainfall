var List = require("list.js");

var options = {
  valueNames: ["date", "name", "url", {
    data: ['id']
  }],
  item: '<button id="" type="button" class="list-group-item list-group-item-action event-list-item"><span class="date"></span> <span class="name small"></span></button>'
};

var values = [{
    name: "Hurricane Ivan",
    date: "2004-09-17 03:00 to 2004-09-18 00:00",
    id: "2004-09-17T03:00/2004-09-18T00:00",
    url: "http://3rww-rainfall-api.civicmapper.com/api/garrd/?dates=2004-09-17T03:00/2004-09-18T00:00&interval=15-minute&basin=&ids=&keyed_by=time&zerofill=false"
  },
  {
    name: "",
    date: "2015-04-06 14:00 to 2015-04-07 14:00",
    id: "2015-04-06T14:00/2015-04-07T14:00",
    url: "http://3rww-rainfall-api.civicmapper.com/api/garrd/?dates=2015-04-06T14:00/2015-04-07T14:00&interval=15-minute&basin=&ids=&keyed_by=time&zerofill=false"
  },
  {
    name: "",
    date: "2015-04-07 22:00 to 2015-04-08 12:00",
    id: "2015-04-07T22:00/2015-04-08T12:00",
    url: "http://3rww-rainfall-api.civicmapper.com/api/garrd/?dates=2015-04-07T22:00/2015-04-08T12:00&interval=15-minute&basin=&ids=&keyed_by=time&zerofill=false"
  },
  {
    name: "",
    date: "2016-08-28 14:00 to 2016-08-29 02:00",
    id: "2016-08-28T14:00/2016-08-29T02:00",
    url: "http://3rww-rainfall-api.civicmapper.com/api/garrd/?dates=2016-08-28T14%3A00%2F2016-08-29T02%3A00&interval=15-minute&basin=&ids=&keyed_by=time&zerofill=false"
  },
];

var eventList = new List("event-list", options, values);