import React, { Component } from 'react';

class InfoSection extends Component {

  convertRowToTR(row, index) {
    return (
      <tr key={index}>
        <td>{row.text}</td>
        <td className="info-section-number">{row.value}</td>
      </tr>
    )
  }

  render() {
    return (
      <div className="info-section">
        <h2>{this.props.title}</h2>
        <table>
          <tbody>
            {this.props.rows.map(this.convertRowToTR)}
          </tbody>
        </table>
      </div>
    )
  }
}

export default InfoSection;