import React from 'react';
import { ListGroup, Card } from 'react-bootstrap';
import { paddedRound } from '../../store/utils/index'

// export default class Tooltip extends React.Component {
//   render() {
import './tooltip.scss';

export const Tooltip = ({ features }) => {

  const c = features.filter(f => f.id !== undefined).length

  const renderFeature = (feature, i) => {
    let p = feature.properties
    // let d = JSON.parse(p.data)

    return (
      <ListGroup.Item key={i}>
        <h6 className="tooltip-header">{p.label}</h6>
        
        {(p.total !== "") ? (
          <p className="tooltip-body">Total rainfall: <strong>{paddedRound(p.total, 2)}</strong> inches</p>
        ) : (
          null
        )}

        {/* {(d.length > 0) ? (
          d.map(r => (
            <p className="small">{r.ts} | {r.val} | {r.src}</p>
          ))
        ) : (
          null
        )} */}
      </ListGroup.Item>
    )
  };

  if (c > 0) {
    return (
      // <Card style={{ width: '250px' }}>
      <Card>
        <ListGroup variant="flush">
          {features.filter(f => f.id !== undefined).map(renderFeature)}
        </ListGroup>
      </Card>
    )
  } else {
    return null
  }
}
// }