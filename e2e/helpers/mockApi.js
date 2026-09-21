export const MOCK_EVENT = {
  start_dt: "2025-10-01T00:00:00-04:00",
  end_dt: "2025-10-01T01:00:00-04:00",
  duration: 1,
  event_label: "EVT-1001"
};

const MOCK_EVENT_2 = {
  start_dt: "2025-10-02T00:00:00-04:00",
  end_dt: "2025-10-02T03:00:00-04:00",
  duration: 3,
  event_label: "EVT-1002"
};

const MOCK_STYLE = {
  version: 8,
  name: "mock-style",
  glyphs: "http://mock.api/fonts/{fontstack}/{range}.pbf",
  sources: {
    gauge: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    },
    pixel: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f5f5f5"
      }
    }
  ]
};

const MOCK_TIMESTAMPS = {
  "realtime-radar": "2025-10-01T03:00:00-04:00",
  "realtime-gauge": "2025-10-01T03:00:00-04:00",
  "calibrated-gauge": "2025-10-01T03:00:00-04:00",
  "calibrated-radar": "2025-10-01T03:00:00-04:00",
  "earliest-15min-calibrated-gauge": "2000-04-01T00:00:00-05:00",
  "latest-15min-calibrated-gauge": "2026-01-31T00:00:00Z",
  "earliest-15min-calibrated-radar": "2000-04-01T00:00:00-05:00",
  "latest-15min-calibrated-radar": "2026-01-31T00:00:00Z",
  "earliest-5min-calibrated-gauge": "2025-01-01T00:00:00-05:00",
  "latest-5min-calibrated-gauge": "2025-10-01T03:00:00-04:00",
  "earliest-5min-calibrated-radar": "2025-01-01T00:00:00-05:00",
  "latest-5min-calibrated-radar": "2025-10-01T03:00:00-04:00"
};

const MOCK_GAUGES = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "8",
      properties: {
        active: true,
        web_id: "8",
        name: "Mock Gauge",
        ext_id: "DW-8"
      },
      geometry: {
        type: "Point",
        coordinates: [-79.986, 40.448]
      }
    }
  ]
};

const MOCK_PIXELS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "100",
      properties: {
        pixel_id: "100"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-79.99, 40.45],
          [-79.98, 40.45],
          [-79.98, 40.44],
          [-79.99, 40.44],
          [-79.99, 40.45]
        ]]
      }
    }
  ]
};

const MOCK_GEOGRAPHY_LOOKUP = {
  basin: {
    "Mock Basin": {
      gauge: ["8"],
      pixel: ["100"]
    }
  }
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "*"
};

const jsonResponse = (route, body, status = 200) => route.fulfill({
  status,
  body: JSON.stringify(body),
  contentType: "application/json",
  headers: corsHeaders
});

const emptyResponse = (route, contentType = "text/plain") => route.fulfill({
  status: 200,
  body: "",
  contentType,
  headers: corsHeaders
});

export const registerMockApiRoutes = async (page, options = {}) => {
  const mode = options.mode || "success";
  const mockEvents = Array.isArray(options.mockEvents) && options.mockEvents.length > 0
    ? options.mockEvents
    : [MOCK_EVENT, MOCK_EVENT_2];
  const eventsPageSize = Number(options.eventsPageSize || 1);
  const eventsDelayMs = Number(options.eventsDelayMs || 0);
  const rainfallRequests = [];
  const lastRequestBySensor = new Map();

  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (requestUrl.hostname !== "mock.api") {
      return route.fallback();
    }

    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        body: "",
        headers: corsHeaders
      });
    }

    const path = requestUrl.pathname;

    if (path === "/style.json") {
      return jsonResponse(route, MOCK_STYLE);
    }

    if (path === "/sprite.json") {
      return jsonResponse(route, {});
    }

    if (path === "/sprite.png") {
      return emptyResponse(route, "image/png");
    }

    if (path.startsWith("/fonts/")) {
      return emptyResponse(route, "application/x-protobuf");
    }

    if (path === "/v2/rainfall-events/") {
      if (eventsDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, eventsDelayMs));
      }

      const pageParam = Number(requestUrl.searchParams.get("page") || "1");
      const pageNumber = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
      const startIndex = (pageNumber - 1) * eventsPageSize;
      const endIndex = startIndex + eventsPageSize;
      const results = mockEvents.slice(startIndex, endIndex);
      const next = endIndex < mockEvents.length
        ? `http://mock.api/v2/rainfall-events/?format=json&page=${pageNumber + 1}`
        : null;
      const previous = pageNumber > 1
        ? `http://mock.api/v2/rainfall-events/?format=json&page=${pageNumber - 1}`
        : null;

      return jsonResponse(route, {
        count: mockEvents.length,
        next,
        previous,
        results
      });
    }

    if (path === "/v2/latest-observations/") {
      return jsonResponse(route, options.timestamps || MOCK_TIMESTAMPS);
    }

    if (path === "/gauges/") {
      return jsonResponse(route, MOCK_GAUGES);
    }

    if (path === "/pixels/") {
      return jsonResponse(route, options.pixels || MOCK_PIXELS);
    }

    if (path === "/static/data/geography-lookup.json") {
      return jsonResponse(route, MOCK_GEOGRAPHY_LOOKUP);
    }

    const requestMatch = path.match(/^\/v2\/(gauge|pixel)\/(realtime|historic15|historic5)\/$/);
    if (requestMatch) {
      const sensor = requestMatch[1];
      const payload = request.postDataJSON() || {};

      rainfallRequests.push({ sensor, path, payload });
      lastRequestBySensor.set(sensor, { ...payload, endpoint: requestMatch[2] });

      return jsonResponse(route, {
        status: "queued",
        meta: {
          jobUrl: `http://mock.api/mock/jobs/${sensor}/1`
        },
        messages: []
      });
    }

    const jobMatch = path.match(/^\/mock\/jobs\/(gauge|pixel)\/(\d+)$/);
    if (jobMatch) {
      const sensor = jobMatch[1];
      const attempt = Number(jobMatch[2]);

      if (mode === "failed") {
        if (attempt === 1) {
          return jsonResponse(route, {
            status: "started",
            meta: {
              jobUrl: `http://mock.api/mock/jobs/${sensor}/2`
            },
            messages: []
          });
        }

        return jsonResponse(route, {
          status: "failed",
          messages: [`Mock ${sensor} polling failure`]
        });
      }

      if (attempt === 1) {
        return jsonResponse(route, {
          status: "started",
          meta: {
            jobUrl: `http://mock.api/mock/jobs/${sensor}/2`
          },
          messages: []
        });
      }

      const requestPayload = lastRequestBySensor.get(sensor) || {};
      const sensorId = sensor === "gauge" ? "8" : "100";
      const sourceCode = sensor === "gauge" ? "G" : "R";

      const points = [
        { ts: requestPayload.start_dt || MOCK_EVENT.start_dt, val: 0.25, src: sourceCode },
        { ts: requestPayload.end_dt || MOCK_EVENT.end_dt, val: null, src: "N/D" }
      ];
      const isTotal = requestPayload.rollup?.toLowerCase() === "total";
      const data = [{ id: sensorId, data: isTotal
            ? [{ ts: `${points[0].ts}/${points[1].ts}`, val: 0.25, src: `${sourceCode}, N/D` }]
            : points }];
      return jsonResponse(route, {
        status: "finished",
        args: requestPayload,
        messages: [],
        data: options.rainfallData ? options.rainfallData(sensor, requestPayload) : data
      });
    }

    return jsonResponse(route, { detail: `No mock route for ${path}` }, 404);
  });

  return {
    rainfallRequests
  };
};
