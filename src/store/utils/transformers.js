import moment from 'moment'
import { get } from 'lodash-es'

export const transformToMapboxSourceObject = geojson => {
  return {
    type: "geojson",
    data: geojson
  }
}

/**
 * takes the Rainfall pixels geojson layer and nests it within an object expected
 * within the Mapbox sources object. Additionally, this takes the geojson
 * feature id and copies it into the properties as a string, since the Rainfall
 * API returns the IDs as strings.
 * @param {*} geojson 
 */
export const transformRainfallPixelsToMapboxSourceObject = geojson => {
  let features = geojson.features.map(f => ({
    properties: {
      id: f.properties.pixel_id.toString(), // f.id.toString(),
      label: `Virtual Gauge ${f.properties.pixel_id.toString()}`,// `Virtual Gauge ${f.id.toString()}`,
      data: [],
      total: "",
      selected: false,
      ...f.properties
    },
    id: f.properties.pixel_id.toString(),
    geometry: f.geometry
  }))
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: features }
  }
}

/**
 * takes the Rainfall gauge geojson layer and nests it within an object expected
 * within the Mapbox sources object. Additionally, this takes the geojson
 * feature id and copies it into the properties as a string, and renames the
 * existing 'id' property as dwid (datawise id) so there is no conflict.
 * 
 * TODO: this currently filters inactive gauges; in the future we will want to
 * expose those and style them differently for the purposes of enabling 
 * download of historic/archived gauge data
 * 
 * @param {*} geojson 
 */
export const transformRainfallGaugesToMapboxSourceObject = geojson => {

  let features = geojson.features
    .filter(f => f.properties.active)
    .map(f => {
    let { id, ...props } = f.properties
    return {
      properties: {
        id: props.web_id, // f.id.toString(),
        label: `Gauge ${props.web_id}: ${props.name}`, //`Gauge ${f.id.toString()}: ${props.name}`,
        data: [],
        total: "",
        selected: false,
        dwid: props.ext_id,
        active: props.active,
        ...props
      },
      id: props.web_id,
      geometry: f.geometry
    }
  })

  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: features }
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
      let { start_dt, end_dt, ...event } = e
      return event
    })
    .filter(e => e.hours > 0)
}

export const transformDataApiEventsJSON = (eventsJson) => {
  return eventsJson
    .map((e, i) => ({
      ...e,
      startDt: e.start_dt,
      endDt: e.end_dt,
      hours: e.duration,
      isFetching: false,
      selected: false,
      eventid: e.event_label
    }))
    .map((e) => {
      let { start_dt, end_dt, event_label, duration, ...event } = e
      return event
    })
    .filter(e => e.hours > 0)
}

// export const join_tables = (t1, t2, on) => (
//   _map(t1, (item) => _extend(item, _find(t2, { id: item[on] })))
// )


export const joinTables = (t1, t2, on1, on2) => (
  t1.map(a1 => (
    {
      ...a1,
      ...t2.find(a2 => get(a2, on2) === get(a1, on1))
    }
  ))
)

/**
 * Given a geojson and table (array of objects), perform a left join of the 
 * table to the geojson using given attributes. Preserves all geojson features
 * 
 * @param {Object} gj geojson as an object (left side of join)
 * @param {Array} table array of objects (right side of join)
 * @param {String} onGeojsonProp feature property used for the join, as a path (array or string), e.g., 'properties.uid' or ['properties', 'uid]. Defaults to the feature `id`
 * @param {String} onTableProp object property used for the join, as a path (array or string), e.g., 'uid'. Defaults to `id`
 * @param {Boolean} dropFeatures optional parameter to drop features that don't have matches in the table, effectively making this a right join.
 */
export const joinTabletoGeojson = (gj, table, onGeojsonProp, onTableProp, dropFeatures) => {

  if (dropFeatures === undefined) {
    dropFeatures = false
  }

  if (onGeojsonProp === undefined) {
    onGeojsonProp = 'id'
  }

  if (onTableProp === undefined) {
    onTableProp = false
  }

  let newFeatures = gj.features
    .map(feature => {

      let new_props = table.find(a2 => (
        get(a2, onTableProp) === get(feature, onGeojsonProp)
      ))

      if (new_props === undefined) {
        if (dropFeatures) {
          return false
        } else {
          return feature
        }
      } else {
        return {
          id: feature.id,
          geometry: feature.geometry,
          properties: { ...feature.properties, ...new_props }
        }
      }

    })

  if (dropFeatures) {
    newFeatures = newFeatures.filter(f => f !== false)
  }
  return {
    "type": "FeatureCollection",
    "features": newFeatures
  }

}

/**
 * transform the rainfall API results object
 * @param {*} r 
 */
export const transformRainfallResults = (r) => {

  r.data.forEach((s) => {

    // The API results don't come with rainfall total per sensor, 
    // so we tabulate rainfall values from one for all observation 
    // intervals for each sensor.we exclude erroneous negative numbers
    let initialValue = 0;

    let total = (
      s.data.length > 1 & s.data.length !== 0
    ) ? (
        s.data
          .filter(i => i.val >= 0) // for the total, we exclude erroneous negative numbers
          .map(i => i.val)
          .reduce((totalValue, currentValue) => totalValue + currentValue, initialValue)
      ) : (
        s.data[0].val
      )
    // we assign negative totals as null, so they don't later on skew the symbology.
    // s.total = (total >= 0) ? total : null
    s.total = total

  })

  // let totals = r.data.map(row => row.total)
  // r.maxValue = Math.max(...totals)
  // r.minValue = Math.min(...totals)

  return r

}

/**
 * from a geojson feature, derive assemble an object which 
 * resembles a select menu option object (i.e., it has a value and a label)
 * Note that it assumes the feature has an id and the label can be derived from
 * a property within the feature's properties object 
 * @param {*} f a single geojson
 */
export const transformFeatureToOption = (f, featureNamePropertyPath, featureIdPropertyPath) => {

    // defaults
    if (featureIdPropertyPath === undefined) {featureIdPropertyPath = 'properties.id'}
    if (featureNamePropertyPath === undefined) { featureNamePropertyPath = 'properties.name'}

    // get values from the feature 
    let featureId = get(f, featureIdPropertyPath, false)
    let featureName = get(f, featureNamePropertyPath, false)

    // create the option object
    let opt;
    if (featureName) {
      opt = {value: featureId, label: `${f.id}: ${featureName}`}
    } else {
      opt = {value: featureId, label: `${f.id}`}
    }

    return opt
}


