import React, { Component } from 'react';
import InfoSection from './infoSection.js';

class CreditStatus extends Component {
  deriveRows(userId) {
    // Do stuff to load data...
    const availableToDrawdown = "$107,654.92";
    const drawdownBalance = "$92,345.08";
    const totalCreditLimit = '$200,000.00';

    return [
      {text: `Available To Draw Down`, value: availableToDrawdown},
      {text: 'Current Drawdown Balance', value: drawdownBalance},
      {text: 'Total Credit Limit', value: totalCreditLimit},
    ];
  }

  render() {
    return (
      <InfoSection
        title="Credit Status"
        rows={this.deriveRows(this.props.userID)}
      />
    )
  }
}

export default CreditStatus;