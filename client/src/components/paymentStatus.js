import moment from 'moment';
import _ from 'lodash';
import React, { useState, useEffect } from 'react';
import InfoSection from './infoSection.js';
import web3 from '../web3.js';
import { fromAtomic } from '../ethereum/erc20.js';

function PaymentStatus(props){
  let rows;
  if (props.creditLine.nextDueBlock > 0) {
    rows = [
      {text: `Next Payment Due ${props.creditLine.dueDate}`, value: fromAtomic(props.creditLine.nextDueAmount)},
      {text: 'Prepaid Toward Payment Due', value: fromAtomic(props.creditLine.prepaymentBalance)},
      {text: 'Final Payment Due', value: props.creditLine.termEndDate}
    ];
  } else {
    rows = [
      {text: "No upcoming payments due", value: ""}
    ];
  }

  console.log("Rendering the payment status...");

  return (
    <InfoSection
      title="Payment Status"
      rows={rows}
    />
  )
}

export default PaymentStatus;
