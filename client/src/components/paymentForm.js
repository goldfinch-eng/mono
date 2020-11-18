import React, { useContext } from 'react';
import { usdcToAtomic, minimumNumber } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';

function PaymentForm(props) {
  const { creditDesk, user } = useContext(AppContext);

  function submitPayment({ value }) {
    const amount = usdcToAtomic(value);
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
    { name: 'other', label: 'Pay other amount' },
  ];

  if (props.creditLine.remainingPeriodDueAmount.gt(0)) {
    valueOptions.unshift({
      name: 'remainingDue',
      label: `Pay minimum due: ${remainingPeriodDueDisplay}`,
      value: props.creditLine.remainingPeriodDueAmountInDollars,
    });
  }

  return (
    <TransactionForm
      title="Pay"
      headerMessage={`Next payment: ${remainingPeriodDueDisplay} due ${props.creditLine.dueDate}`}
      formClass="dark"
      submitTransaction={submitPayment}
      closeForm={props.closeForm}
      valueOptions={valueOptions}
      needsApproval={true}
      actionComplete={actionComplete}
      // You cannot pay more than what you owe or have
      maxAmount={minimumNumber(props.creditLine.remainingTotalDueAmountInDollars, user.usdcBalance)}
    />
  );
}

export default PaymentForm;
