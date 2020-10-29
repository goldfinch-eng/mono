import React, { useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { usdcToAtomic, usdcFromAtomic, minimumNumber } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';

function PaymentForm(props) {
  const { creditDesk, user } = useContext(AppContext);

  function submitPrepayment(value) {
    const amount = usdcToAtomic(value);
    return sendFromUser(creditDesk.methods.pay(props.creditLine.address, amount), props.borrower.address).then(
      _result => {
        props.closeForm();
        props.actionComplete();
      },
    );
  }

  function submitPrincipalPayment(value) {
    const amount = usdcToAtomic(value);
    return sendFromUser(creditDesk.methods.pay(props.creditLine.address, amount), props.borrower.address).then(
      _result => {
        props.closeForm();
        props.actionComplete();
      },
    );
  }

  const balance = displayDollars(usdcFromAtomic(props.creditLine.balance));
  const principalPaymentMessage = `Directly pay down your current balance of ${balance}. Principal payments are not applied to your upcoming due payment.`;

  const remainingDueRaw = props.creditLine.nextDueAmount - props.creditLine.collectedPaymentBalance;
  const paymentDue = displayDollars(usdcFromAtomic(remainingDueRaw));
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
      maxAmount={minimumNumber(usdcFromAtomic(props.creditLine.balance), user.usdcBalance)}
    />
  );
}

export default PaymentForm;
