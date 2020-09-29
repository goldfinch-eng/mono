import BN from 'bn.js';
import React, { useState, useContext } from 'react';
import LoadingButton from './loadingButton';
import iconX from '../images/x-small-purp.svg';
import iconInfo from '../images/info-purp.svg';
import { AppContext } from '../App.js';
import { sendFromUser, MAX_UINT } from '../ethereum/utils';

function TransactionForm(props) {
  const { erc20, pool, user, refreshUserData } = useContext(AppContext);
  const [value, setValue] = useState('');

  function handleChange(e, props) {
    setValue(e.target.value);
  }

  function createNavItems(props) {
    return props.navOptions.map((navOption, index) => {
      const cssClass = props.selectedState === navOption.value ? 'selected' : '';

      return (
        <div
          onClick={() => {
            props.setSelectedState(navOption.value);
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
  let submissionButtonText = 'Submit';
  let buttonInfo = '';
  let buttonAction = props.submitTransaction;
  let approvalAction = async () => {
    return sendFromUser(erc20.methods.approve(pool._address, MAX_UINT), user.address).then(result => {
      refreshUserData();
    });
  };

  if (props.needsApproval && user.allowance && user.allowance.lte(new BN(10000))) {
    approvalNotice = (
      <div className="form-notice">
        <img className="icon" src={iconInfo} alt="info" />
        Just this one time, you’ll first need to unlock your account to send USDC to Goldfinch.
      </div>
    );
    buttonInfo = <div className="button-info">Step 1 of 2:</div>;
    submissionButtonText = 'Unlock';
    buttonAction = approvalAction;
  }

  let formNote = '';
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
        {props.message ? <p className="form-message">{props.message}</p> : ''}
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
              return buttonAction(value);
            }}
            text={submissionButtonText}
          />
        </div>
      </div>
      {formNote}
    </div>
  );
}

export default TransactionForm;
