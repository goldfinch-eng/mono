import React, { useState, useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { toAtomic, fromAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';

function PaymentForm(props) {
  const { creditDesk } = useContext(AppContext);
  const [show, setShow] = useState('prepayment');

  function submitPrepayment(value) {
    const amount = toAtomic(value);
    return sendFromUser(creditDesk.methods.prepay(props.creditLine.address, amount), props.borrower.address).then(
      _result => {
        props.closeForm();
        props.actionComplete();
      },
    );
  }

  function submitPrincipalPayment(value) {
    const amount = toAtomic(value);
    return sendFromUser(creditDesk.methods.pay(props.creditLine.address, amount), props.borrower.address).then(
      _result => {
        props.closeForm();
        props.actionComplete();
      },
    );
  }

  const navOptions = [
    { label: 'Payment', value: 'prepayment' },
    { label: 'Principal Payment', value: 'principalPayment' },
  ];

  let message;
  let submitTransaction;

  if (show === 'principalPayment') {
    const balance = displayDollars(fromAtomic(props.creditLine.balance));
    message = `Directly pay down your current balance of ${balance}. Principal payments are not applied to your upcoming due payment.`;
    submitTransaction = submitPrincipalPayment;
  } else {
    const remainingDueRaw = props.creditLine.nextDueAmount - props.creditLine.prepaymentBalance;
    const paymentDue = displayDollars(fromAtomic(remainingDueRaw));
    message = `Make a payment toward upcoming due payments. For your next payment, you have ${paymentDue} remaining due.`;
    submitTransaction = submitPrepayment;
  }

  return (
    <TransactionForm
      navOptions={navOptions}
      selectedState={show}
      setSelectedState={setShow}
      closeForm={props.closeForm}
      message={message}
      submitTransaction={submitTransaction}
      needsApproval={true}
    />
  );
}

export default PaymentForm;
