import React, { useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { usdcToAtomic, usdcFromAtomic, minimumNumber } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';

function PaymentForm(props) {
  const { creditDesk, user } = useContext(AppContext);

  function submitPayment(value) {
    const amount = usdcToAtomic(value);
    return sendFromUser(creditDesk.methods.pay(props.creditLine.address, amount), props.borrower.address).then(
      _result => {
        props.closeForm();
        props.actionComplete();
      },
    );
  }

  const balance = displayDollars(usdcFromAtomic(props.creditLine.balance));
  const remainingDueRaw = props.creditLine.nextDueAmount - props.creditLine.collectedPaymentBalance;
  const remainingDue = displayDollars(usdcFromAtomic(remainingDueRaw));
  const valueOptions = [
    { label: `Pay minimum due: ${remainingDue}`, value: remainingDueRaw },
    { label: `Pay full balance plus interest: ${balance}`, value: remainingDueRaw },
    { label: 'Pay other amount' },
  ];

  return (
    <TransactionForm
      title="Pay"
      headerMessage={`Next payment: ${remainingDue} due ${props.creditLine.dueDate}`}
      formClass="dark"
      submitTransaction={submitPayment}
      closeForm={props.closeForm}
      valueOptions={valueOptions}
      needsApproval={true}
      // You cannot pay more than what you owe or have
      maxAmount={minimumNumber(usdcFromAtomic(props.creditLine.balance), user.usdcBalance)}
    />
  );
}

export default PaymentForm;
