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
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';

function TransactionForm(props) {
  const { erc20, pool, user, refreshUserData } = useContext(AppContext);
  const formMethods = useForm();
  const [value, setValue] = useState('0');
  const [selectedAction, setSelectedAction] = useState(() => {
    return getSelectedActionProps();
  });

  const [node] = useCloseOnClickOrEsc({ closeFormFn: props.closeForm, closeOnClick: false });

  useEffect(() => {
    setSelectedAction(getSelectedActionProps());
  }, [user]);

  function handleChange(e, props) {
    setValue(e.target.value);
    formMethods.setValue('transactionAmount', e.target.value, { shouldValidate: true, shouldDirty: true });
  }

  function userNeedsToApprove() {
    return props.needsApproval && user.allowance && user.allowance.lte(new BN(10000));
  }

  function getSelectedActionProps() {
    if (userNeedsToApprove()) {
      let approvalAction = async () => {
        return sendFromUser(erc20.methods.approve(pool._address, MAX_UINT), user.address).then(result => {
          refreshUserData();
        });
      };
      return { action: approvalAction, label: 'Unlock', txType: 'Approval' };
    } else {
      return { action: props.submitTransaction, label: 'Submit', txType: props.title };
    }
  }

  let approvalNotice = '';
  let buttonInfo = '';
  let register = formMethods.register;
  let submitText = 'Submit';

  if (userNeedsToApprove()) {
    buttonInfo = <div className="button-info">Step 1 of 2:</div>;
    submitText = 'Unlock USDC';
    register = () => {};
  }

  let valueOptions;
  if (props.valueOptions) {
    const valueOptionList = props.valueOptions.map((valueOption, index) => {
      return (
        <div className="value-option">
          <input name="value-type" type="radio" id={`value-type-${index}`} key={index} value={valueOption.value} />
          <div className="radio-check"></div>
          <label for={`value-type-${index}`}>{valueOption.label}</label>
        </div>
      );
    });
    valueOptions = <div className="value-options">{valueOptionList}</div>;
  }

  let sendToAddress = '';
  if (props.sendToAddress) {
    sendToAddress = (
      <div className="form-field">
        <div className="form-input-label">(Optional) Send to a specific address</div>
        <div className="form-input-container">
          <input name="sendToAddress" placeholder="0x0000" className="form-input"></input>
        </div>
      </div>
    );
  }

  return (
    <div ref={node} className="form-full background-container">
      <div className="form-header">
        <div class="form-header-message">{props.headerMessage}</div>
        <div onClick={props.closeForm} className="cancel">
          Cancel
          <img className="cancel-icon" src={iconX} alt="x" />
        </div>
      </div>
      <div>
        <h2>{props.title}</h2>
        <FormProvider {...formMethods}>
          <form>
            {valueOptions}
            <div className="form-inputs">
              {props.sendToAddress ? sendToAddress : ''}
              <div className="form-field">
                {props.sendToAddress ? <div className="form-input-label">Amount</div> : ''}
                <div className="form-input-container dollar">
                  <input
                    value={value}
                    name="transactionAmount"
                    type="number"
                    onChange={e => {
                      handleChange(e, props);
                    }}
                    placeholder="0"
                    className="form-input"
                    ref={register({
                      required: 'Amount is required',
                      min: { value: 0.01, message: 'Must be greater than 0' },
                      max: {
                        value: props.maxAmount,
                        message: `Amount is above the max allowed (${displayDollars(props.maxAmount)}). `,
                      },
                    })}
                  ></input>
                  <div className="form-input-note">
                    <ErrorMessage errors={formMethods.errors} name="transactionAmount" />
                  </div>
                </div>
                {buttonInfo}
              </div>
              <LoadingButton
                action={() => {
                  return props.submitTransaction(value);
                }}
                text={submitText}
                txData={{ type: selectedAction.txType, amount: value }}
              />
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

export default TransactionForm;
