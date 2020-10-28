
import React from 'react';
import { connect } from 'react-redux';
import {
  Card,
  Button,
} from 'react-bootstrap'
import { isEmpty } from 'lodash-es'

import DateTimePicker from './datetimePicker';
import GeodataPicker from './geomPicker';
import IntervalPicker from './intervalPicker'
import DownloadsList from './downloadList'

import { fetchRainfallDataFromApiV2 } from '../../store/middleware'
import { selectSelectedSensors, selectFetchHistory } from '../../store/selectors'

import './downloader.scss'


class RainfallDownloader extends React.Component {
  constructor(props) {
    super();
    this.handleDownloadClick = this.handleDownloadClick.bind(this);
  }

  handleDownloadClick() {
    this.props.fetchRainfallData({
      rainfallDataType: this.props.rainfallDataType,
      contextType: this.props.contextType
    })
  }

  render() {
    return (
      <div>
        <Card>
            <Card.Body>
              <DateTimePicker
                rainfallDataType={this.props.rainfallDataType}
                contextType={this.props.contextType}
              />
              <hr></hr>
              <GeodataPicker
                rainfallDataType={this.props.rainfallDataType}
                contextType={this.props.contextType}
              />
              <hr></hr>
              <IntervalPicker
                rainfallDataType={this.props.rainfallDataType}
                contextType={this.props.contextType}
              />
              <hr></hr>
              <Button
                onClick={this.handleDownloadClick}
                disabled={!this.props.hasKwargs}
                block
              >
                Get Rainfall Data
              </Button>
            </Card.Body>
        </Card>
        <br></br>
        {this.props.hasDownloads ? (
        <Card>
          <Card.Header>
              Retrieved Rainfall Data
          </Card.Header>
            <Card.Body>
                <DownloadsList 
                  contextType={this.props.contextType}
                  rainfallDataType={this.props.rainfallDataType} 
                /> 
            </Card.Body>
        </Card>
        ) : (null)}
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {

  let selectedSensors = selectSelectedSensors(state, ownProps.contextType)
  let downloadHistory = selectFetchHistory(state, ownProps.contextType)

  return {
    hasKwargs: !isEmpty(selectedSensors), // if this is not empty, then we have kwargs
    hasDownloads: downloadHistory.length > 0
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