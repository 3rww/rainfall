# 3RWW Rainfall *beta*

Have you ever wondered how rainfall is actually measured? Technical instruments, called rain gauges, are designed to collect and accurately measure rainfall during wet weather events. However, a rain gauge can only provide a specific rainfall measurement for the limited geographic area where the gauge is located.

On the flip side, radar systems, often used in weather reports, do not measure rainfall directly, but rather they detect the intensity of microwave energy reflected by raindrops, called reflectivity. Through the use of a mathematical formula, the reflectivity of the raindrops can be converted by the radar system into rainfall estimates for a particular defined area.

Neither measurement technique is perfect, but when the two are combined—when radar estimates are calibrated with actual rain gauge data—a highly accurate and valuable source of rainfall data can be calculated over large geographic areas.

Because engineers and planners addressing the wet weather issue need this level of accuracy, 3 Rivers Wet Weather created the calibrated radar rainfall system in 2001. Communities throughout Allegheny County use this data—provided in both real-time and historical formats—to design more cost-effective solutions to reduce or eliminate sewage overflows and improve stormwater management.

The NEXRAD radar (located in Moon Township) data is calibrated with the rain gauge measurements collected during the same time period and rain event for every square kilometer in Allegheny County. The resulting rainfall data is equivalent in accuracy to having 2,276 rain gauges placed across the County.

## Functionality

Currently, this site offers search, download, and mapping capability for rainfall data in three buckets:

* **Real-time Rainfall data**: provisional rainfall data for both rain gauges and radar pixels. Real-time gauge data is sourced from [Datawise](https://datawise.software/),and pixels are sourced from [Vieux Associates](https://www.vieuxinc.com/). This data is updated every 15 minutes.
* **Historical Rain Gauge data**: QA/QC'd rain gauge data, usually available within 30-60 days. QA/QC is performed by [ALCOSAN](https://www.alcosan.org/) and 3RWW.
* **Calibrated Radar Rainfall data**: QA/QC'd, gauge-adjusted radar rainfall observations, typically available within 30-60 days. Calibration is performed by [Vieux Associates](https://www.vieuxinc.com/).

### Powered By *The 3RWW Data API*

The rainfall data is served up from [3RWW's Data API](https://github.com/3rww/data-api). Currently a few low-level API functions are documented and accessible through https://trwwapi.herokuapp.com/rainfall/.

## Status

This project is a work-in-progress. We're currently looking to replicate the workflows of the original rainfall downloads site. In the future and with feedback, we'll build out new ways to explore and view the rainfall data. We'll also provide resources for helping you integrate this data into your workflows and use it in your tools.

## Some notes on development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

Use Node NPM, Yarn, or PNPM to install dependencies. While we use PNPM, the commands shown the sections below are the same with any of those tools.

NOTE: dependencies as spec'd are currently only building with Node V16.

### Clone and Installation

Run `git clone https://github.com/3rww/rainfall.git` to clone this codebase.

Running `pnpm install` will install dependencies.

### Available Scripts

In the project directory, you can run:

#### `pnpm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

#### `pnpm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

#### `pnpm build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br /> Your app is ready to be deployed!

#### `pnpm serve`

Locally serves the **built** site  [http://localhost:3000](http://localhost:3000). 

#### `pnpm deploy`

Runs the `build` script and commits the changes the `gh-pages` branch, and pushes it to GitHub pages.

#### `pnpm eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (Webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

### Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
