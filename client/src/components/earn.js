import React, { Component } from 'react';
import EarnActionsContainer from './earnActionsContainer.js';
import PaymentStatus from './paymentStatus.js';
import CreditStatus from './creditStatus.js';

class Earn extends Component {
  render() {
    return (
      <div>
        <div className="content-header">Your Account</div>
        <EarnActionsContainer/>
        {/* These need to be updated to be the correct fields for earning! */}
        <PaymentStatus userId="5"/>
        <CreditStatus userId="5"/>
      </div>
    )
  }
}

export default Earn;