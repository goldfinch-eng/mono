import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App.js';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';

function DepositForm(props) {
  const { pool, user, goldfinchConfig } = useContext(AppContext);

  function action({ value }) {
    const depositAmount = usdcToAtomic(value);
    return pool.methods.deposit(depositAmount);
  }

  function actionComplete() {
    props.actionComplete();
    props.closeForm();
  }

  return (
    <TransactionForm
      title="Deposit"
      headerMessage={`Available to deposit: ${displayDollars(user.usdcBalance)}`}
      submitTransaction={action}
      actionComplete={actionComplete}
      closeForm={props.closeForm}
      needsApproval={true}
      maxAmount={minimumNumber(user.usdcBalance, usdcFromAtomic(goldfinchConfig.transactionLimit))}
    />
  );
}

export default DepositForm;
