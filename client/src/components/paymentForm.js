import React, { useContext, useState } from 'react';
import { usdcToAtomic, minimumNumber } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';

function PaymentForm(props) {
  const { creditDesk, user } = useContext(AppContext);
  const [inputClass, setInputClass] = useState('');

  function action({ transactionAmount }) {
    const amount = usdcToAtomic(transactionAmount);
    return creditDesk.methods.pay(props.creditLine.address, amount);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const remainingPeriodDueDisplay = displayDollars(props.creditLine.remainingPeriodDueAmountInDollars);

  let valueOptions = [
    {
      name: 'totalDue',
      label: `Pay full balance plus interest: ${displayDollars(props.creditLine.remainingTotalDueAmountInDollars)}`,
      value: props.creditLine.remainingTotalDueAmountInDollars,
    },
    { name: 'other', label: 'Pay other amount', value: 'other' },
  ];

  if (props.creditLine.remainingPeriodDueAmount.gt(0)) {
    valueOptions.unshift({
      name: 'remainingDue',
      label: `Pay minimum due: ${remainingPeriodDueDisplay}`,
      value: props.creditLine.remainingPeriodDueAmountInDollars,
    });
  }

  function renderForm({ formMethods }) {
    const valueOptionList = valueOptions.map((valueOption, index) => {
      return (
        <div className="value-option" key={index}>
          <input
            name="paymentOption"
            type="radio"
            defaultChecked={valueOption.value === formMethods.getValues('paymentOption')}
            id={`value-type-${index}`}
            ref={formMethods.register}
            value={valueOption.value}
            onChange={() => {
              if (!isNaN(valueOption.value)) {
                formMethods.setValue('transactionAmount', valueOption.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                setInputClass('pre-filled');
              }
            }}
          />
          <div className="radio-check"></div>
          <label htmlFor={`value-type-${index}`}>{valueOption.label}</label>
        </div>
      );
    });
    let valueOptionsHTML = <div className="value-options">{valueOptionList}</div>;

    return (
      <div className="form-inputs">
        <div className="form-field">
          {valueOptionsHTML}
          <TransactionInput
            formMethods={formMethods}
            onChange={e => {
              formMethods.setValue('paymentOption', 'other', { shouldValidate: true, shouldDirty: true });
              setInputClass('');
            }}
            maxAmount={minimumNumber(props.creditLine.remainingTotalDueAmountInDollars, user.usdcBalance)}
            inputClass={inputClass}
          />
        </div>
        <LoadingButton
          action={() => action(formMethods.getValues())}
          actionComplete={actionComplete}
          txData={{ type: 'Deposit', amount: formMethods.getValues('transactionAmount') }}
          sendFromUser={true}
        />
      </div>
    );
  }

  return (
    <TransactionForm
      title="Pay"
      headerMessage={`Next payment: ${remainingPeriodDueDisplay} due ${props.creditLine.dueDate}`}
      formClass="dark"
      render={renderForm}
      closeForm={props.closeForm}
      needsApproval={true}
    />
  );
}

export default PaymentForm;
