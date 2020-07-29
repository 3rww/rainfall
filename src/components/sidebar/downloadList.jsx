import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, ListGroup, Spinner } from 'react-bootstrap';
import { keys } from 'lodash-es'

import DownloadItem from './downloadItem'
import { pickDownload } from '../../store/actions'

import './downloadList.scss'

/**
* Downloads List Component. 
*/
class DownloadsList extends React.Component {

  constructor(props, context) {
    super(props, context);
    this.handleListClick = this.handleListClick.bind(this);
  }

  handleListClick(fh) {
    this.props.pickDownload(fh)
  }

  render() {

    return (

      <ListGroup variant="flush">

        {this.props.fetchHistory.slice(0).reverse().map((fetchHistoryItem, idx) => {

          return (
            <ListGroup.Item
              key={idx}
              // active={fetchHistoryItem.isActive}
              // action
              as="div"              
              // onClick={() => this.handleListClick(fetchHistoryItem)}
              variant={(fetchHistoryItem.isActive) ? ("primary"): ("")}
            >

              <Row noGutters>
                <Col>
                  <DownloadItem
                    fetchHistoryItem={fetchHistoryItem}
                    rainfallDataType={this.props.rainfallDataType}
                  />
                </Col>
                <Col sm={1}>
                  {
                    fetchHistoryItem.isFetching ? (
                      <Spinner
                        animation="border"
                        variant="primary"
                      >
                        <span className="sr-only">
                          "Fetching rainfall data...
                        </span>
                      </Spinner>
                    ) : (null)
                  }
                </Col>
              </Row>

            </ListGroup.Item>
          )
        })}

      </ListGroup>

    )
  }
}

const mapStateToProps = (state, ownProps) => {
  let hasSelections = keys(state.fetchKwargs[ownProps.rainfallDataType].sensorLocations).filter(k => state.fetchKwargs[ownProps.rainfallDataType].sensorLocations[k].length > 0)
  return {
    fetchHistory: state.fetchHistory[ownProps.rainfallDataType],
    hasDownloads: state.fetchHistory[ownProps.rainfallDataType].length > 0,
    hasKwargs: !hasSelections.length > 0,
    rainfallDataType: ownProps.rainfallDataType
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    pickDownload: payload => {
      // jam the rainfallDataType along side of the fetchHistoryItem props (payload)
      dispatch(pickDownload({...payload, rainfallDataType: ownProps.rainfallDataType}))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsList);