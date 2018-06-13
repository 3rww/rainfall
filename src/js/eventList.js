/**----------------------------------------
 * dependencies
 */

import $ from 'jquery';
import List from 'list.js';
import Moment from 'moment';
import { extendMoment } from 'moment-range';


/**----------------------------------------
 * constants
 */

const moment = extendMoment(Moment);

const options = {
  valueNames: ['date', 'name', 'url', {
    data: ['id'],
  }],
  item: '<button id="" type="button" class="list-group-item list-group-item-action event-list-item"><span class="date"></span> <span class="name small"></span></button>',
};

/**----------------------------------------
 * main exports
 */

export const eventList = new List('event-list', options);

export async function loadEvents() {
  await getAndAddEvents();
}

/**----------------------------------------
 * core logic
 */

function getAndAddEvents() {
  $.ajax(`${window.location}data/events.json`, {
    success(rainfallEvents) {
      const values = rainfallEvents.map(e => ({
          name: e.name,
          date: `${e.start} to ${e.end}`,
          id: moment.range(new Date(e.start), new Date(e.end)).toString(),
          report: e.report,
        }));
      console.log(values.length, 'events loaded');
      console.log(values);
      eventList.add(values);
    },
  });
}