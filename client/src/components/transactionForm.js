import BN from 'bn.js';
import React, { useState, useContext, useEffect } from 'react';
import LoadingButton from './loadingButton';
import iconX from '../images/x-small-purp.svg';
import iconInfo from '../images/info-purp.svg';
import { AppContext } from '../App.js';
import { sendFromUser, MAX_UINT } from '../ethereum/utils';

function TransactionForm(props) {
  const { erc20, pool, user, refreshUserData } = useContext(AppContext);
  const [value, setValue] = useState('0');
  const [selectedNavOption, setSelectedNavOption] = useState(props.navOptions[0]);
  const [selectedAction, setSelectedAction] = useState(() => {
    return getSelectedActionProps(props.navOptions[0]);
  });

  useEffect(() => {
    setSelectedAction(getSelectedActionProps(selectedNavOption));
  }, [user]);

  function handleChange(e, props) {
    setValue(e.target.value);
  }

  function userNeedsToApprove() {
    return props.needsApproval && user.allowance && user.allowance.lte(new BN(10000));
  }

  function getSelectedActionProps(navOption) {
    if (userNeedsToApprove()) {
      let approvalAction = async () => {
        return sendFromUser(erc20.methods.approve(pool._address, MAX_UINT), user.address).then(result => {
          refreshUserData();
        });
      };
      return { action: approvalAction, label: 'Unlock', txType: 'Approval' };
    } else {
      // Default to the first nav option
      return { action: navOption.submitTransaction, label: 'Submit', txType: navOption.label };
    }
  }

  function createNavItems(props) {
    return props.navOptions.map((navOption, index) => {
      const cssClass = selectedNavOption.value === navOption.value ? 'selected' : '';

      return (
        <div
          onClick={() => {
            setSelectedNavOption(navOption);
            setSelectedAction({ action: navOption.submitTransaction, label: 'Submit', txType: navOption.label });
          }}
          className={`form-nav-option ${cssClass}`}
          key={index}
        >
          {navOption.label}
        </div>
      );
    });
  }

  let approvalNotice = '';
  let buttonInfo = '';
  let formNote = '';

  if (userNeedsToApprove()) {
    approvalNotice = (
      <div className="form-notice">
        <img className="icon" src={iconInfo} alt="info" />
        Just this one time, you’ll first need to unlock your account to send USDC to Goldfinch.
      </div>
    );
    buttonInfo = <div className="button-info">Step 1 of 2:</div>;
  }

  if (props.formNote) {
    formNote = <div className="form-note">{props.formNote}</div>;
  }

  return (
    <div className="form-full">
      <nav className="form-nav">
        {createNavItems(props)}
        <div onClick={props.closeForm} className="form-nav-option cancel">
          Cancel
          <img className="cancel-icon" src={iconX} alt="x" />
        </div>
      </nav>
      <div>
        {selectedNavOption.message ? <p className="form-message">{selectedNavOption.message}</p> : ''}
        {approvalNotice}
        <div className="form-inputs">
          <div className="input-container">
            <input
              value={value}
              type="number"
              onChange={e => {
                handleChange(e, props);
              }}
              placeholder="0"
              className="big-number-input"
            ></input>
          </div>
          {buttonInfo}
          <LoadingButton
            action={() => {
              return selectedAction.action(value);
            }}
            text={selectedAction.label}
            txData={{ type: selectedAction.txType, amount: value }}
          />
        </div>
      </div>
      {formNote}
    </div>
  );
}

export default TransactionForm;
