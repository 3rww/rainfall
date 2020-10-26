
import React from 'react';
import { connect } from 'react-redux';
import {
  Accordion,
  Card,
  Button,
  ButtonToolbar,
  ButtonGroup,
  ListGroup,
  Row,
  Col
} from 'react-bootstrap'
import moment from 'moment'
import { keys, isEmpty } from 'lodash-es'

import DateTimePicker from './datetimePicker';
import GeodataPicker from './geomPicker';
import IntervalPicker from './intervalPicker'
import DownloadsList from './downloadList'

import { fetchRainfallDataFromApiV2 } from '../../store/middleware'
import { selectActiveFetches } from '../../store/selectors'

import './downloader.scss'


class RainfallDownloader extends React.Component {
  constructor(props) {
    super(props);

    this.handleDownloadClick = this.handleDownloadClick.bind(this);
  }

  handleDownloadClick() {
    this.props.fetchRainfallData(
      // rainfallDataType is either "historic" or "realtime"
      this.props.rainfallDataType
    )
  }

  toggleAccordion(e) {console.log(e.target)}

  render() {
    return (
      <Accordion defaultActiveKey="0">

        <Card>
          <Card.Header className="accordian-card-header">
            <Accordion.Toggle as={Button} variant="link" eventKey="0">
              When and Where
            </Accordion.Toggle>
          </Card.Header>
          <Accordion.Collapse eventKey="0">
            <Card.Body>
              <DateTimePicker rainfallDataType={this.props.rainfallDataType}/>
              <hr></hr>
              <GeodataPicker rainfallDataType={this.props.rainfallDataType}/>
              <hr></hr>
              <IntervalPicker rainfallDataType={this.props.rainfallDataType}/>
              <hr></hr>
              <Button
                onClick={this.handleDownloadClick}
                disabled={this.props.hasKwargs}
                block
              >Get Rainfall Data
              </Button>
            </Card.Body>
          </Accordion.Collapse>
        </Card>

        <Card>
          <Card.Header className="accordian-card-header">
            <Accordion.Toggle as={Button} variant="link" eventKey="1">
              Retrieved Rainfall Data
            </Accordion.Toggle>
          </Card.Header>
          <Accordion.Collapse eventKey="1">
            <Card.Body>
              {this.props.hasDownloads ? (
                <DownloadsList rainfallDataType={this.props.rainfallDataType}/>  
              ) : (
                <p>Fetched rainfall data will be available here.</p>
              )}
            </Card.Body>
          </Accordion.Collapse>
        </Card>

      </Accordion>

    );
  }
}

function mapStateToProps(state, ownProps) {

  let hasSelections = keys(state.fetchKwargs[ownProps.rainfallDataType].sensorLocations)
    .filter(k => state.fetchKwargs[ownProps.rainfallDataType].sensorLocations[k].length > 0)

  return {
    hasDownloads: state.fetchHistory[ownProps.rainfallDataType].length > 0,
    hasKwargs: !hasSelections.length > 0
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    fetchRainfallData: payload => {
      dispatch(fetchRainfallDataFromApiV2(payload))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(RainfallDownloader);