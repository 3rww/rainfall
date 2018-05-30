// jQuery + Bootstrap
var $ = require("jquery");
var jQuery = $;
require("bootstrap");

$(function () {
  $('#status-bar').hide();
  $('[data-toggle="tooltip"]').tooltip();
});