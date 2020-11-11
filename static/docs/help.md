# Help

*NOTE: THIS WAS COPIED FROM THE ORIGINAL TOOL. The content related to rainfall data, intervals, availability, and calibration are still relevant with the latest tool; content related to the UI functionality is not.*

## Real-time Rainfall Data

Data from 33 rain gauges is collected and updated every 15 minutes to calibrate live weather radar to provide accurate, quality rainfall information as it is occurring.

Rain gauge data also is available in this section for the most recent 30-to-60-day period, spanning from the first day of the previous month to the current date in the present month. (Example: If the date is November 15, data can be obtained for as little as one day up to 45 days—October 1-November 15. If it is the last day of the present month—November 30—a full 60 days of data is available).

Fully calibrated rainfall data (older than 30 days with completed QA/QC) for any given month is available through the “calibrated radar rainfall data” section, generally within 15 days of the end of each month.

Several options for data output are provided on the real-time site via simple links.

* A bar graph and data table (in 15-min. increments) showing rainfall over the last 4 hours for a specified pixel on the map (2,276 pixels are available).
* An animated map showing the rainfall over the last 2-hour, 4-hour or 6-hour time period.
* A table recording the raw rainfall data for individual rain gauges over the last 30-60 days.
* A cumulative color-coded map showing the amount of rainfall occurring over a specified period. Data can be accessed from the first day of the previous month to the current date. Be sure to specify the time period, and select the appropriate rainfall scale (.5 inch, 5 inches or 10 inches.) For particularly long periods of time or heavy rainfall periods, a higher scale will provide a better range of colors in the final map.
* Rainfall amount collected over the most recent 4-hour period by an individual rain gauge. A bar graph and data table show the actual rainfall collected by the specific gauge in 15-min. increments. 

## Historical Rain Gauge

The data from 33 rain gauges is archived in this section. The data may be retrieved for any combination of the rain gauges during a specified time span. The data may also be displayed in 5-minute increments or compressed to hourly or daily data points. The data may be viewed on the page or downloaded into a comma-separated output format which may be saved and loaded into a spreadsheet or database that accepts comma-separated files.

As of March 1, 2003, the historical rain gauge sampling interval was switched from a 5-minute interval to a 15-minute interval. You can only download data gathered prior to March 1 in a 5-minute resolution or an error will result. Fifteen-minute and larger intervals may still be displayed and downloaded from the entire sampling timeframe.


## Calibrated Radar Rainfall

The calibrated radar rainfall section allows the retrieval of data for each of the 872 pixels mapped by the radar cross-section. Each pixel is represented by an X (horizontal) and Y (vertical) coordinate that overlays the coverage map. This section of the site allows quick access to data and a way to remember commonly searched pixels. It also provides access to notes compiled for each month that detail the data and any unusual events that occurred.

### QuickFind

To quickly access the data for an individual pixel, the QuickFind feature allows a graphical selection of the target pixel through a series of maps. The first map allows the selection of an individual watershed by clicking on the map or selecting the watershed from a list of names below the map. This leads to a watershed map that shows the individual pixels with a grid overlay. Most web browsers will show a pop-up with the appropriate pixel coordinates if you momentarily pause over a pixel. After selecting a pixel, you are presented with the output format screen.

### Output

The output format screen is similar to the one used for the historical rain gauge section. At the top, it will list the pixel(s) that will appear in the output data. Selection of the start and end time of the output can be chosen, along with the interval and zero-fill option. Calibrated data is collected and calculated in 15-minute increments, which allows for 15-minute, hourly, and daily intervals as options for the selectable increment. Note that if a daily increment is selected, the start and end selections will begin at midnight and the start and end hour will be ignored. By default, any row that does not contain any rainfall is eliminated from the output data. Selecting the zero-fill option will include these rows in the output.

The data output may be shown on the page by selecting the 'View' option or formatted as a set of comma-separated output points for use with a spreadsheet or database by choosing the 'Download' option. The output for each pixel/timestamp contains an amount and a source. The amount is the rainfall in inches, and the source can be found in the following table:

| Source |	Description |
| --- | --- |
| R |	Calibrated radar rainfall data |
|G-0 |	No gauge or calibrated radar rainfall data is available, but not for the reasons given for N/D below |
| G-1 |	Derived from inverse distance squared weighting based on one rain gauge |
| G-2 |	Derived from inverse distance squared weighting based on two rain gauges |
| G-3 |	Derived from inverse distance squared weighting based on three rain gauges |
| N/D |	No data was collected for this data point. This may be because no data was collected at the time or the pixel may be outside of the data collection boundary. |

~Note that the source code only appears for the 15-minute increments because an hourly or daily increment may include many different sources.~ *TODO: Note that for rollups now, all sources that were used are provided as a comma-delimited list alongside the aggregated rainfall value.*

### Predefined Search

The calibrated radar rainfall section also allows for searches to be created. A search is simply a collection of pixels that will be used for the output data. A search can be created by clicking on the 'Create Search' button and leads to a screen that allows a single pixel to be selected, similar to the QuickFind section, and a formula section where the pixel coordinates may be entered manually. Clicking on 'Single Pixel' will present the same maps as in the QuickFind section. After the pixel is selected, a name may be entered for the search which is then saved is the user's account. Clicking 'Use Formula' will allow the input of a search name and formula that is saved in the user's account. The formula is in the form of 'xcoor1,ycoor1;xcoor2,ycoor2;xcoor3,ycoor3' in which each pixel is entered in the form 'xcoor,ycoor' with the coordinates separated by a comma and each pixel is separated by a semi-colon.

After a search is created, it may be used at any time by selecting its name from the Search pop-up menu and clicking on the 'Go' button. This will present the output format box as detailed above, where time spans, interval, and output format may be selected.

A search may also be deleted by selecting its name in the pop-up menu and clicking the 'Delete Search' button. 
