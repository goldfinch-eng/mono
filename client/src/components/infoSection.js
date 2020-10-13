import React, { Component } from 'react';

class InfoSection extends Component {
  convertRowToItem(row, index) {
    return (
      <div className="small-info-item" key={index}>
        <div className="value">{row.value}</div>
        <div className="label">{row.label}</div>
      </div>
    );
  }

  render() {
    return (
      <div className={`info-section ${this.props.cssClass}`}>
        <h2>{this.props.title}</h2>
        <div className="info-container background-container small-items">
          {this.props.rows.map(this.convertRowToItem)}
        </div>
      </div>
    );
  }
}

export default InfoSection;
