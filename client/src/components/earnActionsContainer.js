import React, { useState, useContext } from 'react';
import DepositForm from './depositForm.js';
import DepositStatus from './depositStatus.js';
import { AppContext } from '../App.js';
import WithdrawalForm from './withdrawalForm.js';
import { iconUpArrow, iconDownArrow } from './icons.js';

function EarnActionsContainer(props) {
  const { user } = useContext(AppContext);
  const [showAction, setShowAction] = useState(null);

  const closeForm = e => {
    setShowAction(null);
  };

  let placeholderClass = '';
  if (!user.address || !user.usdcIsUnlocked) {
    placeholderClass = 'placeholder';
  }

  let depositAction;
  let depositClass = 'non-functioning';
  if (user.usdcIsUnlocked && props.capitalProvider) {
    depositAction = e => {
      setShowAction('deposit');
    };
    depositClass = '';
  }

  let withdrawAction;
  let withdrawClass = 'non-functioning';
  if (user.usdcIsUnlocked && props.capitalProvider.availableToWithdrawal > 0) {
    withdrawAction = e => {
      setShowAction('withdrawal');
    };
    withdrawClass = '';
  }

  let formBody;
  if (showAction === 'deposit') {
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
  } else {
    formBody = (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus capitalProvider={props.capitalProvider} />
        <div className="form-start">
          <button className={`button ${depositClass}`} onClick={depositAction}>
            {iconUpArrow} Deposit
          </button>
          <button className={`button ${withdrawClass}`} onClick={withdrawAction}>
            {iconDownArrow} Withdraw
          </button>
        </div>
      </div>
    );
  }
  return formBody;
}

export default EarnActionsContainer;
