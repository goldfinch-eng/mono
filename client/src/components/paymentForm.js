import React, { useState, useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { toAtomic, fromAtomic, minimumNumber } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';
import BigNumber from 'bignumber.js';

function PaymentForm(props) {
  const { creditDesk, user } = useContext(AppContext);
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

  const balance = displayDollars(fromAtomic(props.creditLine.balance));
  const principalPaymentMessage = `Directly pay down your current balance of ${balance}. Principal payments are not applied to your upcoming due payment.`;

  const remainingDueRaw = props.creditLine.nextDueAmount - props.creditLine.prepaymentBalance;
  const paymentDue = displayDollars(fromAtomic(remainingDueRaw));
  const prepaymentMessage = `Make a payment toward upcoming due payments. For your next payment, you have ${paymentDue} remaining due.`;

  const navOptions = [
    { label: 'Payment', value: 'prepayment', message: prepaymentMessage, submitTransaction: submitPrepayment },
    {
      label: 'Principal Payment',
      value: 'principalPayment',
      message: principalPaymentMessage,
      submitTransaction: submitPrincipalPayment,
    },
  ];

  return (
    <TransactionForm
      navOptions={navOptions}
      closeForm={props.closeForm}
      needsApproval={true}
      // You cannot pay more than what you owe or have
      maxAmount={minimumNumber(fromAtomic(props.creditLine.balance), user.usdcBalance)}
    />
  );
}

export default PaymentForm;
