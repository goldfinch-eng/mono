import React, { Component } from 'react';
import InfoSection from './infoSection.js';

class PaymentStatus extends Component {
  deriveRows(userId) {
    // Do stuff to load data...
    const amountDue = "$543.60";
    const prepaidAmount = 0;
    const dueDate = 'Oct 6';

    return [
      {text: `Payment Due On ${dueDate}`, value: amountDue},
      {text: 'Prepaid Toward Payment Due', value: prepaidAmount}
    ];
  }

  render() {
    return (
      <InfoSection
        title="Payment Status"
        rows={this.deriveRows(this.props.userID)}
      />
    )
  }
}

export default PaymentStatus;