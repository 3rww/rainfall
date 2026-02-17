import React from 'react';
import { Table } from 'react-bootstrap';
import { HEADER_LABELS } from '../../store/config'

/**
* Table for Displaying Rainfall API results
*/
export const ResultsTable = ({ rows, header }) => {  

  // {"gauge":[{"id":"8","data":[{"val":3.61,"src":"G","ts":"2020-07-22T17:15:00+00:00/2020-10-27T17:00:00+00:00"}]}]}

  // return (
  //   <code>{JSON.stringify(results)}</code>
  // )
  let rs = rows.map((r, ir) => (
    <tr key={`r${ir}`}>
    {header.map((h, ih) => (
      <td key={`d${ir}${ih}`}><small>{r[h]}</small></td>)
    )}
    </tr>
  ))
  rs.push(<tr key={`r---}`}>{header.map((h, ih) => (
    <td key={`d---${ih}`}><small>...</small></td>)
  )}</tr>)

  return (
    <Table responsive striped bordered hover size="sm" className="download-table">
      <thead>
      <tr className="download-table-header">
        {header.map((h, ih) => (
        <th key={`h${ih}`}><small><em>{HEADER_LABELS[h]}</em></small></th>
        ))}
      </tr>
      </thead>
      <tbody>
        {rs}
      </tbody> 
    </Table>
  )

}

// const mapStateToProps = (state, ownProps) => {
//  return {}
// }

// const mapDispatchToProps = (dispatch, ownProps) => {
//  return {}
// }

// export default connect(mapStateToProps, mapDispatchToProps)(ResultsTable);
