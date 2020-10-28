import React from 'react';
import { connect } from 'react-redux';
import { Modal, Button, Row, Col } from 'react-bootstrap';

/**
* Table for Displaying Rainfall API results
*/
export const ResultsTable = ({resultsTableData}) => {

// {"gauge":[{"id":"8","data":[{"val":3.61,"src":"G","ts":"2020-07-22T17:15:00+00:00/2020-10-27T17:00:00+00:00"}]}]}

  /*
  // holders for data to be rendered in the download table
  let data = []
  let tableRows = []
  let tableHeader = []
  let downloadData = ""
  
  // table columns come from the checked state of the filters, with the ID/label columns first
  let tableColumns = ['timestamp']

  // transform the results into tabular format here:
  // TODO
  
  
  // read the array of objects into a delimited text string.
  // this is what is sent via the File API
  downloadData = unparse(data)

  // convert back to object for rendering the table
  let tableContent = parse(downloadData).data

  // create the preview table
  if (tableContent.length > 0) {
   tableHeader = tableContent[0]
   tableRows = tableContent.slice(1)
  }
  
  
  let content = {
   header: tableHeader !== undefined ? tableHeader : [],
   rows: tableRows !== undefined ? tableRows : [],
   downloadData: downloadData
  }
  */



  return (
    <code>{JSON.stringify(resultsTableData)}</code>
  )

  // return (
  //   <Table responsive striped bordered hover size="sm" className="download-table">
  //     <thead>
  //     <tr className="download-table-header">
  //       {this.props.header.map((h, ih) => (
  //       <th key={`h${ih}`}><small><em>{h}</em></small></th>
  //       ))}
  //     </tr>
  //     </thead>
  //     <tbody>
  //     {this.props.rows.map((r, ir) => (
  //       <tr key={`r${ir}`}>
  //       {r.map((v, iv) => (
  //         <td key={`d${iv}`}><small>{v}</small></td>)
  //       )}
  //       </tr>
  //     ))}
  //     </tbody> 
  //   </Table>
  // )

}

// const mapStateToProps = (state, ownProps) => {
//  return {}
// }

// const mapDispatchToProps = (dispatch, ownProps) => {
//  return {}
// }

// export default connect(mapStateToProps, mapDispatchToProps)(ResultsTable);
