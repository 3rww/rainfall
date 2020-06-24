export const transformToMapboxSourceObject = (geojson) => {
  return {
    type: "geojson",
    data: geojson
  }
}

export const testFetchHistoryItems = [{
  fetchKwargs: {
    selectedEvent: {
      start_dt: '2019-11-23T14:00:00-05:00',
      end_dt: '2019-11-24T09:00:00-05:00',
      eventid: null,
      report: null
    },
    sensorLocations: {
      raingauge: [
        {
          value: 1,
          label: '1: PWSA (Observatory Hill)'
        }
      ],
      basin: [],
      pixel: []
    },
    rollup: 'Hourly',
    zerofill: true,
    f: 'sensor'
  },
  requestId: '2d2e1e09485c09ed7eaa1e87e48687bb',
  isFetching: false,
  isActive: true,
  results: {
    raingauge: {
      '1': {
        data: [
          {
            ts: '2019-11-23T14:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-23T15:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-23T16:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-23T17:00:00',
            val: 0.11,
            src: 'G'
          },
          {
            ts: '2019-11-23T18:00:00',
            val: 0.12,
            src: 'G'
          },
          {
            ts: '2019-11-23T19:00:00',
            val: 0.09,
            src: 'G'
          },
          {
            ts: '2019-11-23T20:00:00',
            val: 0.23,
            src: 'G'
          },
          {
            ts: '2019-11-23T21:00:00',
            val: 0.13,
            src: 'G'
          },
          {
            ts: '2019-11-23T22:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-23T23:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-24T00:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T01:00:00',
            val: 0.02,
            src: 'G'
          },
          {
            ts: '2019-11-24T02:00:00',
            val: 0.03,
            src: 'G'
          },
          {
            ts: '2019-11-24T03:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-24T04:00:00',
            val: 0.03,
            src: 'G'
          },
          {
            ts: '2019-11-24T05:00:00',
            val: 0.02,
            src: 'G'
          },
          {
            ts: '2019-11-24T06:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T07:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T08:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T09:00:00',
            val: 0,
            src: 'G'
          }
        ],
        total: 0.81
      }
    }
  }
}, {
  fetchKwargs: {
    selectedEvent: {
      start_dt: '2019-11-23T14:00:00-05:00',
      end_dt: '2019-11-24T09:00:00-05:00',
      eventid: null,
      report: null
    },
    sensorLocations: {
      raingauge: [
        {
          value: 3,
          label: '3: Shaler'
        }
      ],
      basin: [],
      pixel: []
    },
    rollup: 'Hourly',
    zerofill: true,
    f: 'sensor'
  },
  requestId: 'aab13da7cf724b9a6ebb3355be127bb6',
  isFetching: false,
  isActive: false,
  results: {
    raingauge: {
      '3': {
        data: [
          {
            ts: '2019-11-23T14:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-23T15:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-23T16:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-23T17:00:00',
            val: 0.11,
            src: 'G'
          },
          {
            ts: '2019-11-23T18:00:00',
            val: 0.1,
            src: 'G'
          },
          {
            ts: '2019-11-23T19:00:00',
            val: 0.11,
            src: 'G'
          },
          {
            ts: '2019-11-23T20:00:00',
            val: 0.18,
            src: 'G'
          },
          {
            ts: '2019-11-23T21:00:00',
            val: 0.13,
            src: 'G'
          },
          {
            ts: '2019-11-23T22:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-23T23:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-24T00:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-24T01:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-24T02:00:00',
            val: 0.02,
            src: 'G'
          },
          {
            ts: '2019-11-24T03:00:00',
            val: 0.02,
            src: 'G'
          },
          {
            ts: '2019-11-24T04:00:00',
            val: 0.05,
            src: 'G'
          },
          {
            ts: '2019-11-24T05:00:00',
            val: 0.01,
            src: 'G'
          },
          {
            ts: '2019-11-24T06:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T07:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T08:00:00',
            val: 0,
            src: 'G'
          },
          {
            ts: '2019-11-24T09:00:00',
            val: 0,
            src: 'G'
          }
        ],
        total: 0.7700000000000001
      }
    }
  }
}
]