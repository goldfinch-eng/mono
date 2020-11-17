import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { fiduFromAtomic } from '../ethereum/fidu';
import { displayDollars } from '../utils';
import { AppContext } from '../App.js';
import TransactionForm from './transactionForm';

function WithdrawalForm(props) {
  const { pool } = useContext(AppContext);

  function action({ value }) {
    const withdrawalAmount = usdcToAtomic(value);
    return pool.methods.withdraw(withdrawalAmount);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const availableAmount = fiduFromAtomic(props.capitalProvider.availableToWithdrawal);
  const availableToWithdraw = minimumNumber(availableAmount, usdcFromAtomic(props.poolData.balance));

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(availableAmount)}`}
      submitTransaction={action}
      actionComplete={actionComplete}
      closeForm={props.closeForm}
      maxAmount={availableToWithdraw}
    />
  );
}

export default WithdrawalForm;
