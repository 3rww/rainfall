import moment from 'moment'

/**
 * transform parts of the API calls
 * @param {str} dt - a date/time string
 * @param {str} when - one of ['start', 'end']
 */
export const parseDtToApiV1Kwargs = (dt, when) => {
    let m = moment.parseZone(dt)
    return {
        [`${when}year`] : m.year(),
        [`${when}month`] : m.month() + 1,
        [`${when}day`] : m.date(),
        [`${when}hour`] : m.hour()
    }
}


export const transformToMapboxSourceObject = (geojson) => {
  return {
    type: "geojson",
    data: geojson
  }
}

export const transformEventsJSON = (eventsJson) => {
  return eventsJson.events
    .slice(0)
    .reverse()
    .map((e, i) => ({
      ...e,
      hours: moment(e.end_dt).diff(moment(e.start_dt), 'hours'),
      isFetching: false
    }))
    .filter(e => e.hours > 0)
}

