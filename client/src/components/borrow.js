import React, { Component } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import PaymentStatus from './paymentStatus.js';
import CreditStatus from './creditStatus.js';

class Borrow extends Component {
  render() {
    return (
      <div>
        <div className="content-header">Your Credit Line</div>
        <CreditActionsContainer/>
        <PaymentStatus userId="5"/>
        <CreditStatus userId="5"/>
      </div>
    )
  }
}

export default Borrow;