// jQuery + Bootstrap
import $ from 'jquery';


export default function initBootstrapConfigs() {
  console.log('initBootstrapConfigs');
  $('#status-bar').hide();
  $('[data-toggle="tooltip"]').tooltip();
}

initBootstrapConfigs();