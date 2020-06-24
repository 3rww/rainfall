import axios from 'axios';
import { MD5 } from 'object-hash'
import { has } from 'lodash-es'

import {
  requestRainfallData,
  requestRainfallDataInvalid,
  requestRainfallDataSuccess,
  requestRainfallDataFail,
  requestJson,
  requestJsonSuccess,
  requestJsonFail
} from './actions'
import {
  selectFetchKwargsKeys
} from './selectors'

import { API_URL_ROOT } from './config'

import store from './index'

/**
 * Request JSON from a URL; put response.data into store via props 
 * spec'd in pathArray. Optionally transform response.data via passed-in
 * transformer function
 * @param {*} payload 
 */
export function fetchJSON(payload) {
  // Thunk middleware knows how to handle functions.
  // It passes the dispatch method as an argument to the function,
  // thus making it able to dispatch actions itself.

  // First dispatch: the app state is updated to inform
  // that the API call is starting; the currentEvent
  // is set in the store
  return function (dispatch) {

    const { url, pathArray, transformer, keepACopy } = payload

    console.log(`getting data from "${url}" and loading to store.${pathArray.join(".")}`)

    dispatch(requestJson(url))

    let data;

    // The function called by the thunk middleware can return a value,
    // that is passed on as the return value of the dispatch method.
    // In this case, we return a promise to wait for.
    // This is not required by thunk middleware, but it is convenient for us.
    return axios({
      url: url,
      method: 'GET',
    })
      .then(
        (response) => {
          if (transformer) {
            data = transformer(response.data)
          } else {
            data = response.data
          }

            // NOTE: We can dispatch many times!
            // Here, we update the app state with the results of the API call. 
          dispatch(requestJsonSuccess({ data: data, pathArray: pathArray, keepACopy: keepACopy }))
          
          return true
        },
          // Do not use catch, because that will also catch
          // any errors in the dispatch and resulting render,
          // causing a loop of 'Unexpected batch number' errors.
          // https://github.com/facebook/react/issues/6895        
        (error) => {
          console.log('An error occurred.', error)
          dispatch(requestJsonFail('An error occurred.'))
          return false
        }
      )


  }
}

/**
 * request data from the 3RWW Rainfall API
 * @param {*} payload 
 */
export function fetchRainfallDataFromApiV2(payload) {

  return function (dispatch) {

    // get the current set of fetchKwargs; use the payload if provided, 
    // otherwise get from the state tree
    let kwargs
    if (payload !== undefined) {
      if (selectFetchKwargsKeys(store.getState()).every(k => has(payload, k))) {
        kwargs = {...payload}
      } else {
        kwargs = {...store.getState().fetchKwargs}
      }
    } else {
      kwargs = {...store.getState().fetchKwargs}
    }


    // generate a unique ID, based on the hash of the kwargs
    // this will let us 1) update the correct object in fetchHistory
    // with the results, and 2) not retrieve the same data twice
    let requestId = MD5(kwargs)

    // TODO: return data from selectedEvent if it's available (previously been fetched)

    // TODO: handle validation (here or in component)
    // requestRainfallDataInvalid(s)

    // parse the props of selectedEvent to form the body of the API request
    let requestSensors = ['raingauge', 'basin']
    requestSensors.forEach((s, i) => {

      // skip if no selections
      if (kwargs.sensorLocations[s].length == 0 ) {
        return
      }

      // assemble the request params, except IDs
      let requestParams = {
        start_dt: kwargs.selectedEvent.start_dt,
        end_dt: kwargs.selectedEvent.end_dt,
        rollup: kwargs.rollup,
        f: kwargs.f
      }

      // then deal with the IDs.

      // little weird here: get the correct names used for various 
      // api params and state tree lookups
      // 0: api url endpoint and state tree path, 1: api param
      let sensor = (s == 'basin') ? ['pixel', 'pixels'] : ['raingauge', 'gauges']

      requestParams[sensor[1]] = kwargs.sensorLocations[sensor[0]].map(i => i.value).join(",")


      // indicate that the request is proceeding in the UI
      // (this will include looked-up pixel locations)
      dispatch(requestRainfallData({ 
        fetchKwargs: kwargs, 
        requestId: requestId,
        sensor: sensor[0]
      }))

      console.log(requestParams)
      
      axios({
        url: `${API_URL_ROOT}v2/${sensor[0]}`,
        method: 'GET',
        params: requestParams
      })
        .then(
          (response) => {
            console.log(response) //.data.meta.records, "records retrieved")

            let responseData = {...response.data}

            let processedData = responseData.data.reduce(function(result, item) {
              let {id, ...attrs} = item
              attrs.total = attrs.data.map(i => i.val).reduce((a, b) => a + b, 0)
              result[id] = attrs
              return result;
            }, {});

            dispatch(requestRainfallDataSuccess(
              {
                requestId: requestId,
                results: {
                  [sensor[0]]: processedData
                },
                kwargs: {...responseData.args}
              }
            ))
            return true
          },

          (error) => {
            console.log('An error occurred.', error)
            dispatch(requestRainfallDataFail({
              requestId: requestId,
              results: {
                [sensor[0]]: false
              }
            }))
            return false
          }
        )
      


    })

  }


}