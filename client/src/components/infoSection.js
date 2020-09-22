import React, { Component } from 'react';

class InfoSection extends Component {
  convertRowToTR(row, index) {
    return (
      <div className="info-section-row" key={index}>
        <span className="info-section-label">{row.text}</span>
        <span className="info-section-value">{row.value}</span>
      </div>
    );
  }

  render() {
    return <div className="info-section">{this.props.rows.map(this.convertRowToTR)}</div>;
  }
}

export default InfoSection;
