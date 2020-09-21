import React, { useState } from 'react';
import DepositForm from './depositForm.js';
import WithdrawalForm from './withdrawalForm.js';
import iconDown from '../images/down-purp.svg';
import iconUp from '../images/up-purp.svg';

function EarnActionsContainer(props) {
  const [showAction, setShowAction] = useState(null);

  const cancelAction = e => {
    setShowAction(null);
  };

  let formBody;
  if (showAction === null) {
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
          Withdrawal
        </button>
      </div>
    );
  } else if (showAction === 'deposit') {
    formBody = (
      <DepositForm
        cancelAction={cancelAction}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData}
        actionComplete={props.actionComplete}
      />
    );
  } else if (showAction === 'withdrawal') {
    formBody = (
      <WithdrawalForm
        cancelAction={cancelAction}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData}
        actionComplete={props.actionComplete}
      />
    );
  }
  return <div className="form-section">{formBody}</div>;
}

export default EarnActionsContainer;
