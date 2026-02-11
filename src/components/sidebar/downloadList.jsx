import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, ListGroup, Spinner, CloseButton } from 'react-bootstrap';
import { includes } from 'lodash-es'

import DownloadItem from './downloadItem'
import { pickDownload, deleteDownload } from '../../store/middleware'
import { selectFetchHistory } from '../../store/selectors'

import './downloadList.scss'

/**
* Downloads List Component. 
*/
class DownloadsList extends React.Component {

  constructor(props, context) {
    super(props, context);
    this.handleListClick = this.handleListClick.bind(this);
    this.handleDeleteClick = this.handleDeleteClick.bind(this);
  }

  handleListClick(fh) {
    this.props.pickDownload(fh)
  }

  handleDeleteClick(e, requestId) {
    e.preventDefault()
    e.stopPropagation()
    this.props.deleteDownload({ requestId: requestId })
  }

  render() {

    // console.log(this.props)

    return (

      <ListGroup variant="flush">

        {this.props.fetchHistory.slice(0).reverse().map((i) => {

          let failedJob = includes(['deferred', 'failed', "does not exist", 'error'], i.status)

          let listColor
          if (i.isActive && i.status === 'finished') {
            listColor = "primary"
          } else if (failedJob) {
            listColor = "danger"
          } else {
            listColor = ""
          }

          return (
            <ListGroup.Item
              key={i.requestId}
              // active={i.isActive}
              as="div"
              className="mx-0 download-list-item"
              action
              onClick={() => this.handleListClick(i)}
              variant={listColor}
            >
              <CloseButton
                className="download-list-item-delete"
                aria-label="Delete rainfall query result"
                onClick={(e) => this.handleDeleteClick(e, i.requestId)}
              />

              <Row className="g-0 download-list-item-row">
                <Col sm={ i.isFetching ? (11) : (12) } className="download-list-item-content">
                  <DownloadItem
                    fetchHistoryItem={i}
                    contextType={this.props.contextType}
                    rainfallDataType={this.props.rainfallDataType}
                    rainfallSensorType={this.props.rainfallSensorType}
                  />
                </Col>
                
                  {
                    i.isFetching ? (
                      <Col sm={1} className="download-list-item-spinner">
                        <Spinner
                          animation="border"
                          variant="primary"
                        >
                          <span className="visually-hidden">
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
    },
    deleteDownload: payload => {
      dispatch(deleteDownload({...payload, contextType: ownProps.contextType}))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsList);
