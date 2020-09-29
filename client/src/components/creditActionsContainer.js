import React, { useState } from 'react';
import PaymentForm from './paymentForm.js';
import DrawdownForm from './drawdownForm.js';
import iconDown from '../images/down-purp.svg';
import iconUp from '../images/up-purp.svg';

function CreditActionsContainer(props) {
  const [showAction, setShowAction] = useState(null);

  function openAction(e, action) {
    e.preventDefault();
    setShowAction(action);
  }

  function closeForm() {
    setShowAction(null);
  }

  let formBody;
  if (!props.creditLine.balance) {
    formBody = (
      <div className="form-start">
        <button className="button non-functioning">
          <img className="button-icon" src={iconDown} alt="down-arrow" />
          Drawdown
        </button>
        <button className="button non-functioning">
          <img className="button-icon" src={iconUp} alt="up-arrow" />
          Payment
        </button>
      </div>
    );
  } else if (showAction === null) {
    formBody = (
      <div className="form-start">
        <button
          onClick={e => {
            openAction(e, 'drawdown');
          }}
          className="button"
        >
          <img className="button-icon" src={iconDown} alt="down-arrow" />
          Drawdown
        </button>
        <button
          onClick={e => {
            openAction(e, 'payment');
          }}
          className="button"
        >
          <img className="button-icon" src={iconUp} alt="up-arrow" />
          Payment
        </button>
      </div>
    );
  } else if (showAction === 'payment') {
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
  }
  return <div className="form-section">{formBody}</div>;
}

export default CreditActionsContainer;
