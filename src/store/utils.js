import moment from 'moment'

import { round, mean, zip } from 'lodash-es'
import * as chroma from 'chroma-js'

export const paddedRound = (v, d) => round(v, d).toFixed(d)

/**
 * transform parts of the API calls
 * @param {str} dt - a date/time string
 * @param {str} when - one of ['start', 'end']
 */
export const parseDtToApiV1Kwargs = (dt, when) => {
  let m = moment.parseZone(dt)
  return {
    [`${when}year`]: m.year(),
    [`${when}month`]: m.month() + 1,
    [`${when}day`]: m.date(),
    [`${when}hour`]: m.hour()
  }
}


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
      id: f.id.toString(),
      data: [],
      total: null,
      ...f.properties
    },
    id: f.id,
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
 * @param {*} geojson 
 */
export const transformRainfallGaugesToMapboxSourceObject = geojson => {

  let features = geojson.features.map(f => {
    let { id, ...props } = f.properties
    return {
      properties: {
        id: f.id.toString(),
        data: [],
        total: null,
        dwid: id,
        ...props
      },
      id: f.id,
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

export const minmaxTableAttr = (table, attr) => {
  let values = table
    .map(row => row[attr])
    .filter(v => v >= 0)

  return {
    maxValue: Math.max(...values),
    minValue: Math.min(...values),
    maxRank: values.length
  }

}

/**
 * Given a table of data, return a color style expression.
 * 
 * @param {*} data table data (rows).
 * @param {*} attr the data attribute of interest, for which the color expression will be built
 * @param {*} joinField the field used to join the *data* with the geojson, used to build the filter expression. This 
 * @param {*} chromaScaleStr a color string representing a scale, to be interpreted by chroma-js to derive colors
 * @param {Number} breaks number of discrete breaks in the data
 * @param {*} method determines how data will be classified. takes a string parameter for the chroma.limits method;
 *  undefined defaults to linear stretch
 */
export const buildColorStyleExpression = (
  data,
  attr,
  joinField,
  chromaScaleStr,
  chromaColorMode,
  breaks,
  method,
  minMax
) => {

  let chromaObj = chroma.scale(chromaScaleStr)
  if (chromaColorMode) {
    chromaObj = chromaObj.mode(chromaColorMode)
  }

  // console.log("building style for", attr, joinField, chromaScaleStr, breaks, method, minMax)

  if (breaks === undefined) {
    breaks = 5
  }

  if (joinField === undefined) {
    joinField = 'id'
  }

  // build the first part of the style expressions
  var styleExp = ['match', ['get', joinField]];
  var heightExp = ['match', ['get', joinField]];
  var opacityExp = [
    'case',
    ['boolean', [joinField, []], false],
    1,
    0.5
  ]
  // create empty arrays, which will receive legend content
  let breakPoints = []
  let colors = []

  let maxValue, minValue
  // determine the min and max
  if (minMax === undefined) {
    minMax = minmaxTableAttr(data, attr)
    console.log("minMax on the fly", minMax)
  } else {
    console.log("minMax provided", minMax)
  }
  maxValue = minMax.maxValue
  minValue = minMax.minValue

  // by default use linear stretch.
  if (method === undefined) {

    method = "linear"
    breakPoints = chroma.limits(data.map(row => row[attr]), 'e', breaks).slice(1)
    colors = chromaObj.colors(breaks)

    // Calculate the exact color on a color scale for each feature from attr/maxValue
    data.forEach((row) => {
      // build the style expression
      let t = (row[attr] - minValue) / (maxValue - minValue)
      let color = chromaObj.classes(breaks)(t).hex('rgb')
      styleExp.push(row[joinField], color);
    })

  } else {

    breakPoints = chroma.limits(data.map(row => row[attr]), method, breaks).slice(1)
    colors = breakPoints.map(b => {
      let t = breakPoints.indexOf(breakPoints.filter(d => b <= d)[0]) / (breakPoints.length)
      let c = chroma
        .scale(chromaScaleStr)
        .classes(breaks)(t)
        .brighten(0.25).saturate(0.25).hex('rgb')
      return c
    })

    data.forEach((row) => {
      // build the style expression
      let t = breakPoints.indexOf(breakPoints.filter(b => row[attr] <= b)[0]) / (breakPoints.length)
      let color = chromaObj.classes(breaks)(t).brighten(0.25).saturate(0.25).hex('rgb')
      styleExp.push(row[joinField], color);

    })

  }

  let opaque_ids = []
  data.forEach(row => {
    let height = row[attr] * 500
    heightExp.push(row[joinField], height)
  })

  var opacityExp = [
    'case',
    ['boolean', [joinField, []], false],
    1,
    0.5
  ]  

  // create content for the legend


  let legendContent = {
    method: method,
    content: zip(breakPoints, colors)
  }

  // Last value is the default, used where there is no data
  styleExp.push('rgba(255,255,255,0)');
  // styleExp.push('rgba(200,200,200,0.1)');
  heightExp.push(0)

  return {
    styleExp: styleExp,
    legendContent: legendContent,
    heightExp: heightExp
  }
}

export const multiAttrColorStyleExp = (data, attrs, joinField, chromaScaleStr, breaks, method) => {

  let customAttr = "calcd"
  let customData = data.map(row => {
    let vals = []
    attrs.forEach(attr => vals.push(row[attr]))
    return {
      [customAttr]: mean(vals),
      [joinField]: row[joinField]
    }
  })
  let minMax = minmaxTableAttr(customData, customAttr)
  // console.log(customData, customAttr, minMax)

  return buildColorStyleExpression(customData, customAttr, joinField, chromaScaleStr, breaks, method, minMax)
}

/**
 * Detects color stored as hex value, and turns it into a light-dark-scale for use with chroma-scale
 * If the the color provided is not hex, it is returned as is.
 */
export const colorToScale = (colorStr) => {
  if (colorStr.startsWith("#")) {
    return [
      chroma(colorStr).brighten(3).hex(),
      colorStr,
      chroma(colorStr).darken(3).hex()
    ]
  } else {
    return colorStr
  }

}