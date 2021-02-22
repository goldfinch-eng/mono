import React, { useContext, useState } from 'react';
import { usdcToAtomic, minimumNumber, usdcFromAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';
import useSendFromUser from '../hooks/useSendFromUser';

function PaymentForm(props) {
  const { user, goldfinchConfig } = useContext(AppContext);
  const [inputClass, setInputClass] = useState('');
  const sendFromUser = useSendFromUser();

  function action({ transactionAmount }) {
    const amount = usdcToAtomic(transactionAmount);
    return sendFromUser(props.borrower.pay(props.creditLine.address, amount), {
      type: 'Payment',
      amount: transactionAmount,
      gasless: props.borrower.gasless,
    }).then(props.actionComplete);
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

  function getValueOptionsList(formMethods) {
    return valueOptions.map((valueOption, index) => {
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
  }

  function renderForm({ formMethods }) {
    const valueOptionList = getValueOptionsList(formMethods);
    let valueOptionsHTML = <div className="value-options">{valueOptionList}</div>;

    return (
      <div className="form-inputs">
        {valueOptionsHTML}
        <TransactionInput
          formMethods={formMethods}
          onChange={e => {
            formMethods.setValue('paymentOption', 'other', { shouldValidate: true, shouldDirty: true });
            setInputClass('');
          }}
          maxAmount={minimumNumber(
            props.creditLine.remainingTotalDueAmountInDollars,
            usdcFromAtomic(user.usdcBalance),
            usdcFromAtomic(goldfinchConfig.transactionLimit),
          )}
          inputClass={inputClass}
        />
        <LoadingButton action={action} />
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
    />
  );
}

export default PaymentForm;
