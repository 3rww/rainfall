// jQuery + Bootstrap
var $ = (jQuery = require("jquery"));
require("bootstrap");



$(function () {
  $('#status-bar').hide();
  $('[data-toggle="tooltip"]').tooltip();
});