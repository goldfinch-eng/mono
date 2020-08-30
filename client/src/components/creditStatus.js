import React, { useState, useEffect } from 'react';
import InfoSection from './infoSection.js';
import _ from 'lodash';
import { fromAtomic } from '../ethereum/erc20.js';

function CreditStatus(props) {
  let rows;
  if (!props.creditLine.balance) {
    rows = [
      {text: `Available To Draw Down`, value: '0'},
      {text: 'Current Drawdown Balance', value: '0'},
      {text: 'Total Credit Limit', value: '0'},
    ];
  } else {
    const drawdownBalance = fromAtomic(props.creditLine.balance);
    const totalCreditLimit = fromAtomic(props.creditLine.limit);
    const availableToDrawdown = totalCreditLimit - drawdownBalance;
    rows = [
      {text: `Available To Draw Down`, value: availableToDrawdown},
      {text: 'Current Drawdown Balance', value: drawdownBalance},
      {text: 'Total Credit Limit', value: totalCreditLimit},
    ];
  }

  return (
    <InfoSection
      title="Credit Status"
      rows={rows}
    />
  )
}

export default CreditStatus;