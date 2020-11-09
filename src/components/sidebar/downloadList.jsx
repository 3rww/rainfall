import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, ListGroup, Spinner } from 'react-bootstrap';
import { includes } from 'lodash-es'

import DownloadItem from './downloadItem'
import { pickDownload } from '../../store/middleware'
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

        {this.props.fetchHistory.slice(0).reverse().map((i, idx) => {

          let listColor = "" 
          if (i.isActive & i.status ) {
            listColor = "primary"
          } else if (includes(['deferred', 'failed', "does not exist", 'error'], i.status)) {
            listColor = "danger"
          }

          return (
            <ListGroup.Item
              key={idx}
              // active={i.isActive}
              // action
              as="div"
              className="mx-0"
              // onClick={() => this.handleListClick(i)}
              variant={listColor}
            >

              <Row noGutters>
                <Col sm={ i.isFetching ? (11) : (12) }>
                  <DownloadItem
                    fetchHistoryItem={i}
                    contextType={this.props.contextType}
                    rainfallDataType={this.props.rainfallDataType}
                    rainfallSensorType={this.props.rainfallSensorType}
                  />
                </Col>
                
                  {
                    i.isFetching ? (
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