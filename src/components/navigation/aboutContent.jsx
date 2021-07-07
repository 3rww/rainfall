import React from "react";
import { Tabs, Tab, Row, Col, Image, Card } from "react-bootstrap";
import ReactMarkdown from "react-markdown/with-html";

import { ROOT } from '../../store/config'

import "./aboutContent.scss";

const what1 = `
Have you ever wondered how rainfall is actually measured? Technical instruments, called rain gauges, are designed to collect and accurately measure rainfall during wet weather events. However, a rain gauge can only provide a specific rainfall measurement for the limited geographic area where the gauge is located.

On the flip side, radar systems, often used in weather reports, do not measure rainfall directly, but rather they detect the intensity of microwave energy reflected by raindrops, called reflectivity. Through the use of a mathematical formula, the reflectivity of the raindrops can be converted by the radar system into rainfall estimates for a particular defined area.

Neither measurement technique is perfect, but when the two are combined—when radar estimates are calibrated with actual rain gauge data—a highly accurate and valuable source of rainfall data can be calculated over large geographic areas.

Because engineers and planners addressing the wet weather issue need this level of accuracy, 3 Rivers Wet Weather created the calibrated radar rainfall system in 2001. Communities throughout Allegheny County use this data—provided in both real-time and historical formats—to design more cost-effective solutions to reduce or eliminate sewage overflows and improve stormwater management.

The NEXRAD radar (located in Moon Township) data is calibrated with the rain gauge measurements collected during the same time period and rain event for every square kilometer in Allegheny County. The resulting rainfall data is equivalent in accuracy to having 2,276 rain gauges placed across the County.
`;
const what2 = `
Currently, this site offers rainfall data in three buckets:

* **Real-time Rainfall** data: provisional rainfall data for rain gauges and radar pixels
* **Historical Rain Gauge** data: QA/QC'd rain gauge data, usually available within 30-60 days
* **Calibrated Radar Rainfall** data: QA/QC'd, gauge-adjusted radar rainfall observations, typically available within 30-60 days

Each of these is accessible from a tab at the top of the page.

### Real-time Rainfall Data

Provisional data from 3RWW's 33 rain gauges and NEXRAD radar pixels is collected and updated every 15 minutes to provide accurate, quality rainfall information as it is occurring. This includes both gauge and radar rainfall data. 

Data users are cautioned to consider carefully the provisional nature of the information before using it for decisions. Information concerning the accuracy and appropriate uses of these data or concerning other hydrologic data may be obtained from the 3RWW.

### Historical Rain Gauge

The data from 33 rain gauges, which typically is updated to include data points not transmitted by the gauges in real-time--is available in this section. The data may be retrieved for any combination of the rain gauges during a specified time span. The data may also be displayed in 15-minute increments or aggregated to hourly or daily data points.

### Calibrated Radar Rainfall

The calibrated radar rainfall section allows the retrieval of archived gauge-adjusted radar rainfall data for each of the 2313 pixels mapped by the NEXRAD radar cross-section. Calibration is performed by <a href="https://www.vieuxinc.com/" target="_blank">Vieux Associates</a>.
`;

const how1 = `
## Querying Rainfall

Select the start and end date/time, along with the interval and the gauges or basins (for radar pixels). Press "Get Rainfall Data" button to get the data.

Rainfall data is collected and stored in 15-minute increments, which allows for 15-minute, hourly, and daily aggregations to be calculated. Note that if a daily interval is selected, the start and end selections will begin at midnight and the start and end hour will be ignored.

Query results will be listed in a panel below on each page and shown on the map. The tabular data output may be viewed and downloaded on the page by selecting the 'View and Download Results' Button. Download formats currently include a CSV tabular format, for use in spreadsheet software. Spatial formats will be included in the future.

The output table for each query result contains:

* a gauge or pixel ID
* a date/time of the observation (presented as standard ISO 8061 datetime text). For hourly and daily aggregations, the start and end time of the observation is indicated using the standard ISO 8061 datetime range format, with start and end delimited by a "/".
* a rainfall amount (in inches) 
* a source code, which indicates where the rainfall measurement came from.

The source code can be found in the following table:

| Source |	Description |
| --- | --- |
| R |	Calibrated radar rainfall data |
| G-0 | No gauge or calibrated radar rainfall data is available, but not for the reasons given for N/D below |
| G-1 |	Derived from inverse distance squared weighting based on one rain gauge |
| G-2 |	Derived from inverse distance squared weighting based on two rain gauges |
| G-3 |	Derived from inverse distance squared weighting based on three rain gauges |
| N/D |	No data was collected for this data point. This may be because no data was collected at the time or the pixel may be outside of the data collection boundary. |
| RTRR | Real-time radar rainfall. Data shown are provisional.|
| RTRG | Real-time rain gauge data. Data shown are provisional. |


Note that the source code only appears for the 15-minute increments. Hourly or daily increment may include different source codes, depending on calibration method.
`;

const how2 = `
## 3RWW Data API

The rainfall data is served up from 3RWW's Data **A**pplication **P**rogramming **I**nterface (API). Currently a few functions are documented and available through [${process.env.REACT_APP_API_URL_ROOT}](${process.env.REACT_APP_API_URL_ROOT}).

## Project Roadmap

You can view the project roadmap on [Github](https://github.com/3rww/rainfall/projects/1). 

Encounter a bug or want to make a feature request? Submit an [issue](https://github.com/3rww/rainfall/issues) or email [3rww@civicmapper.com](mailto:3rww@civicmapper.com)


`;

export const AboutContent = () => {
  return (
    <Tabs 
      defaultActiveKey="what1" 
      id="about-tabs"
      variant="pills"
      mountOnEnter={true}
    >
      <Tab eventKey="what1" title="Overview">
        <div className="about-body">
          <ReactMarkdown children={what1} />
          <Card body className="about-logo-background">
          <p>This app is made possible with support from:</p>
          <Row >
            <Col sm={5}><Image className="about-logo mx-auto" src={`${ROOT}static/assets/vieux-logo-white-300.png`} placeholder="Vieux Associates" alt="Vieux Associates" fluid/></Col>
            <Col sm={2}><Image className="about-logo mx-auto" src={`${ROOT}static/assets/alcosan-logo.svg`} placeholder="ALCOSAN" alt="ALCOSAN" fluid/></Col>
            <Col sm={5}><Image className="about-logo mx-auto" src={`${ROOT}static/assets/DataWise.png`} placeholder="DataWise" alt="DataWise" fluid/></Col>
          </Row>
          </Card>
        </div>               
      </Tab>
      <Tab eventKey="what2" title="Available Datasets">
        <div className="about-body">
          <ReactMarkdown children={what2} />
        </div>
      </Tab>
      <Tab eventKey="how1" title="Getting Data">
        <div className="about-body">
          <ReactMarkdown children={how1} />
        </div>
      </Tab>
      <Tab eventKey="more" title="Webinar">
        <div className="about-body">
          <h2>Learn more!</h2>
          <p>Our January 2021 webinar provides an overview of the rainfall system and a how-to for using this site.</p>
          <div className="embed-responsive embed-responsive-16by9">
            <iframe className="embed-responsive-item" src="https://www.youtube.com/embed/mwOu2QRx6oU" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>  
          </div> 
        </div>
      </Tab>
      <Tab eventKey="how2" title="Under the hood">
        <div className="about-body">
          <ReactMarkdown children={how2} />
        </div>
      </Tab>


    </Tabs>
  );
};
