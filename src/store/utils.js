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
      startDt: e.start_dt,
      endDt: e.end_dt,
      hours: moment(e.end_dt).diff(moment(e.start_dt), 'hours'),
      isFetching: false,
      selected: false
    }))
    .map((e) => {
      let {start_dt, end_dt, ...event} = e
      return event
    })
    .filter(e => e.hours > 0)
}

// export const transformResultsToCSV = (r) => {

//   let g = r.gauge
//   let h = ["timestamp"]
//   Object.keys(g).forEach(k => {
//     h.push(k), h.push(k +"-metadata")
//   })

// }