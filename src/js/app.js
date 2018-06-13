// jQuery (where $ is loaded via Browserify)
import $ from 'jquery';
import jquery from 'jquery';
import 'bootstrap';
import 'babel-polyfill';

import './ui';
import { loadEvents } from './eventList';
import { attachEventPlayerListeners } from './map';


// load events data
loadEvents();

// attach listeners to DOM
attachEventPlayerListeners();