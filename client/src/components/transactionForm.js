import BN from 'bn.js';
import React, { useState, useContext, useEffect } from 'react';
import LoadingButton from './loadingButton';
import iconX from '../images/x-small-purp.svg';
import iconInfo from '../images/info-purp.svg';
import { AppContext } from '../App.js';
import { sendFromUser, MAX_UINT } from '../ethereum/utils';
import { useForm, FormProvider } from 'react-hook-form';
import { ErrorMessage } from '@hookform/error-message';
import { displayDollars } from '../utils';

function TransactionForm(props) {
  const { erc20, pool, user, refreshUserData } = useContext(AppContext);
  const formMethods = useForm();
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
    formMethods.setValue('transactionAmount', e.target.value, { shouldValidate: true, shouldDirty: true });
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

  if (userNeedsToApprove()) {
    approvalNotice = (
      <div className="form-notice">
        <img className="icon" src={iconInfo} alt="info" />
        Just this one time, you’ll first need to unlock your account to send USDC to Goldfinch.
      </div>
    );
    buttonInfo = <div className="button-info">Step 1 of 2:</div>;
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
        <FormProvider {...formMethods}>
          <form>
            <div className="form-inputs">
              <div className="input-container">
                <input
                  value={value}
                  name="transactionAmount"
                  type="number"
                  onChange={e => {
                    handleChange(e, props);
                  }}
                  placeholder="0"
                  className="big-number-input"
                  ref={formMethods.register({
                    required: 'Amount is required',
                    min: { value: 0.01, message: 'Must be greater than 0' },
                    max: {
                      value: props.maxAmount,
                      message: `Amount is above the max allowed (${displayDollars(props.maxAmount)}). `,
                    },
                  })}
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
          </form>
        </FormProvider>
      </div>
      <div className="form-note">
        <div>
          <ErrorMessage errors={formMethods.errors} name="transactionAmount" />
        </div>
      </div>
    </div>
  );
}

export default TransactionForm;
