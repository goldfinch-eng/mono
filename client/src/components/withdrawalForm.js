import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { fiduFromAtomic } from '../ethereum/fidu';
import { displayDollars } from '../utils';
import { AppContext } from '../App.js';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';
import useSendFromUser from '../hooks/useSendFromUser';

function WithdrawalForm(props) {
  const sendFromUser = useSendFromUser();
  const { pool, goldfinchConfig } = useContext(AppContext);

  function action({ transactionAmount }) {
    const withdrawalAmount = usdcToAtomic(transactionAmount);
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), {
      type: 'Withdrawal',
      amount: transactionAmount,
    }).then(actionComplete);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const availableAmount = fiduFromAtomic(props.capitalProvider.availableToWithdrawal);
  const availableToWithdraw = minimumNumber(
    availableAmount,
    usdcFromAtomic(props.poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit),
  );

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <TransactionInput formMethods={formMethods} maxAmount={availableToWithdraw} />
        <LoadingButton action={action} />
      </div>
    );
  }

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(availableAmount)}`}
      render={renderForm}
      closeForm={props.closeForm}
      maxAmount={availableToWithdraw}
    />
  );
}

export default WithdrawalForm;
