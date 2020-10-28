import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, ListGroup, Spinner } from 'react-bootstrap';
import { keys } from 'lodash-es'

import DownloadItem from './downloadItem'
import { pickDownload } from '../../store/actions'
import { selectFetchHistory } from '../../store/selectors'

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
              className="mx-0"
              // onClick={() => this.handleListClick(fetchHistoryItem)}
              variant={(fetchHistoryItem.isActive) ? ("primary"): ("")}
            >

              <Row noGutters>
                <Col sm={ fetchHistoryItem.isFetching ? (11) : (12) }>
                  <DownloadItem
                    fetchHistoryItem={fetchHistoryItem}
                    contextType={this.props.contextType}
                    rainfallDataType={this.props.rainfallDataType}
                    rainfallSensorType={this.props.rainfallSensorType}
                  />
                </Col>
                
                  {
                    fetchHistoryItem.isFetching ? (
                      <Col sm={1}>
                        <Spinner
                          animation="border"
                          variant="primary"
                        >
                          <span className="sr-only">
                            "Fetching rainfall data...
                          </span>
                        </Spinner>
                      </Col>
                    ) : (null)
                  }
              </Row>

            </ListGroup.Item>
          )
        })}

      </ListGroup>

    )
  }
}

const mapStateToProps = (state, ownProps) => {
  let fh = selectFetchHistory(state, ownProps.contextType)
  return {
    fetchHistory: fh,
    hasDownloads: fh.length > 0,
    rainfallDataType: ownProps.rainfallDataType
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    pickDownload: payload => {
      dispatch(pickDownload({...payload, contextType: ownProps.contextType}))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsList);