import React, { useState, useContext } from 'react';
import PaymentForm from './paymentForm.js';
import DrawdownForm from './drawdownForm.js';
import { usdcFromAtomic } from '../ethereum/erc20.js';
import { iconUpArrow, iconDownArrow } from './icons.js';
import { AppContext } from '../App.js';

import { displayDollars } from '../utils';

function CreditActionsContainer(props) {
  const { user } = useContext(AppContext);
  const [showAction, setShowAction] = useState(null);
  const availableCredit = props.creditLine.availableCredit;

  function openAction(e, action) {
    e.preventDefault();
    setShowAction(action);
  }

  function closeForm() {
    setShowAction(null);
  }

  let placeholderClass = '';
  if (!user.address || !user.usdcIsUnlocked || !props.creditLine.address) {
    placeholderClass = 'placeholder';
  }

  let drawdownAction;
  let drawdownClass = 'disabled';
  if (availableCredit.gt(0) && user.usdcIsUnlocked) {
    drawdownAction = e => {
      openAction(e, 'drawdown');
    };
    drawdownClass = '';
  }

  let payAction;
  let payClass = 'disabled';
  if (props.creditLine.balance.gt(0) && user.usdcIsUnlocked) {
    payAction = e => {
      openAction(e, 'payment');
    };
    payClass = '';
  }

  let nextDueDisplay = 'No payment due';
  if (props.creditLine.remainingPeriodDueAmount.gt(0)) {
    const remainingPeriodDueAmount = usdcFromAtomic(props.creditLine.remainingPeriodDueAmount);
    nextDueDisplay = `${displayDollars(remainingPeriodDueAmount)} due ${props.creditLine.dueDate}`;
  } else if (props.creditLine.periodDueAmount.gt(0)) {
    nextDueDisplay = `Paid through ${props.creditLine.dueDate}`;
  }

  if (showAction === 'payment') {
    return (
      <PaymentForm
        closeForm={closeForm}
        actionComplete={props.actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
      />
    );
  } else if (showAction === 'drawdown') {
    return (
      <DrawdownForm
        closeForm={closeForm}
        actionComplete={props.actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
      />
    );
  } else {
    return (
      <div className={`form-start split background-container ${placeholderClass}`}>
        <div className="form-start-section">
          <div className="form-start-label">Available to drawdown</div>
          <div className="form-start-value">{displayDollars(usdcFromAtomic(availableCredit))}</div>
          <button className={`button ${drawdownClass}`} onClick={drawdownAction}>
            {iconDownArrow} Drawdown
          </button>
        </div>
        <div className="form-start-section">
          <div className="form-start-label">Next payment</div>
          <div className="form-start-value">{nextDueDisplay}</div>
          <button className={`button dark ${payClass}`} onClick={payAction}>
            {iconUpArrow} Pay
          </button>
        </div>
      </div>
    );
  }
}

export default CreditActionsContainer;
