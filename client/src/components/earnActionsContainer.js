import React, { useState } from 'react';
import DepositForm from './depositForm.js';
import WithdrawalForm from './withdrawalForm.js';
import iconDown from '../images/down-purp.svg';
import iconUp from '../images/up-purp.svg';

function EarnActionsContainer(props) {
  const [showAction, setShowAction] = useState(null);

  const closeForm = e => {
    setShowAction(null);
  };

  let formBody;
  if (!props.capitalProvider.address) {
    formBody = (
      <div className="form-start">
        <button className="button non-functioning">
          <img className="button-icon" src={iconUp} alt="up-arrow" />
          Deposit
        </button>
        <button className="button non-functioning">
          <img className="button-icon" src={iconDown} alt="down-arrow" />
          Withdraw
        </button>
      </div>
    );
  } else if (showAction === null) {
    formBody = (
      <div className="form-start">
        <button
          onClick={e => {
            setShowAction('deposit');
          }}
          className="button"
        >
          <img className="button-icon" src={iconUp} alt="up-arrow" />
          Deposit
        </button>
        <button
          onClick={e => {
            setShowAction('withdrawal');
          }}
          className="button"
        >
          <img className="button-icon" src={iconDown} alt="down-arrow" />
          Withdraw
        </button>
      </div>
    );
  } else if (showAction === 'deposit') {
    formBody = (
      <DepositForm
        closeForm={closeForm}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData}
        actionComplete={props.actionComplete}
      />
    );
  } else if (showAction === 'withdrawal') {
    formBody = (
      <WithdrawalForm
        closeForm={closeForm}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData}
        actionComplete={props.actionComplete}
      />
    );
  }
  return <div className="form-section">{formBody}</div>;
}

export default EarnActionsContainer;
