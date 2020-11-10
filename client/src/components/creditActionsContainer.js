import React, { useState, useContext } from 'react';
import PaymentForm from './paymentForm.js';
import DrawdownForm from './drawdownForm.js';
import { usdcFromAtomic } from '../ethereum/erc20.js';
import { iconUpArrow, iconDownArrow } from '../images/icons.js';
import { AppContext } from '../App.js';

import { displayDollars } from '../utils';

function CreditActionsContainer(props) {
  const { user } = useContext(AppContext);
  const [showAction, setShowAction] = useState(null);
  const drawdownBalance = usdcFromAtomic(props.creditLine.balance);
  const availableBalance = usdcFromAtomic(props.creditLine.availableBalance);
  const nextDueAmount = usdcFromAtomic(props.creditLine.nextDueAmount);
  const remainingDueAmount = nextDueAmount - usdcFromAtomic(props.creditLine.collectedPaymentBalance);

  function openAction(e, action) {
    e.preventDefault();
    setShowAction(action);
  }

  function closeForm() {
    setShowAction(null);
  }

  let placeholderClass = '';
  if (!user.address || !user.usdcIsUnlocked) {
    placeholderClass = 'placeholder';
  }

  let drawdownAction;
  let drawdownClass = 'non-functioning';
  if (availableBalance > 0 && user.usdcIsUnlocked) {
    drawdownAction = e => {
      openAction(e, 'drawdown');
    };
    drawdownClass = '';
  }

  let payAction;
  let payClass = 'non-functioning';
  if (drawdownBalance > 0 && user.usdcIsUnlocked) {
    payAction = e => {
      openAction(e, 'payment');
    };
    payClass = '';
  }

  let nextDueDisplay = 'No payment due';
  if (remainingDueAmount > 0) {
    nextDueDisplay = `${displayDollars(remainingDueAmount)} due ${props.creditLine.dueDate}`;
  } else if (nextDueAmount > 0) {
    nextDueDisplay = `Paid through ${props.creditLine.dueDate}`;
  }

  let formBody;
  if (showAction === 'payment') {
    formBody = (
      <PaymentForm
        closeForm={closeForm}
        actionComplete={props.actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
      />
    );
  } else if (showAction === 'drawdown') {
    formBody = (
      <DrawdownForm
        closeForm={closeForm}
        actionComplete={props.actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
      />
    );
  } else {
    formBody = (
      <div className={`form-start split background-container ${placeholderClass}`}>
        <div className="form-start-section">
          <div class="form-start-label">Available to drawdown</div>
          <div class="form-start-value">{displayDollars(availableBalance)}</div>
          <button className={`button ${drawdownClass}`} onClick={drawdownAction}>
            {iconDownArrow} Drawdown
          </button>
        </div>
        <div className="form-start-section">
          <div class="form-start-label">Next payment</div>
          <div class="form-start-value">{nextDueDisplay}</div>
          <button className={`button can ${payClass}`} onClick={payAction}>
            {iconUpArrow} Pay
          </button>
        </div>
      </div>
    );
  }
  return formBody;
}

export default CreditActionsContainer;
