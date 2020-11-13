import React, { useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { usdcToAtomic, usdcFromAtomic, minimumNumber } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars, roundUpPenny } from '../utils';
import TransactionForm from './transactionForm';

function PaymentForm(props) {
  const { creditDesk, user } = useContext(AppContext);

  function submitPayment({ value }) {
    const amount = usdcToAtomic(value);
    return sendFromUser(creditDesk.methods.pay(props.creditLine.address, amount), props.borrower.address).then(
      _result => {
        props.closeForm();
        props.actionComplete();
      },
    );
  }

  const remainingTotalDueAmount = roundUpPenny(usdcFromAtomic(props.creditLine.remainingTotalDueAmount));
  const remainingDueAmount = roundUpPenny(usdcFromAtomic(props.creditLine.remainingPeriodDueAmount));
  const valueOptions = [
    {
      name: 'remainingDue',
      label: `Pay minimum due: ${displayDollars(remainingDueAmount)}`,
      value: remainingDueAmount,
    },
    {
      name: 'totalDue',
      label: `Pay full balance plus interest: ${displayDollars(remainingTotalDueAmount)}`,
      value: remainingTotalDueAmount,
    },
    { name: 'other', label: 'Pay other amount' },
  ];

  return (
    <TransactionForm
      title="Pay"
      headerMessage={`Next payment: ${remainingDueAmount} due ${props.creditLine.dueDate}`}
      formClass="dark"
      submitTransaction={submitPayment}
      closeForm={props.closeForm}
      valueOptions={valueOptions}
      needsApproval={true}
      // You cannot pay more than what you owe or have
      maxAmount={minimumNumber(remainingTotalDueAmount, user.usdcBalance)}
    />
  );
}

export default PaymentForm;
