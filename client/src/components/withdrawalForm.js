import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { fiduFromAtomic } from '../ethereum/fidu';
import { displayDollars } from '../utils';
import { AppContext } from '../App.js';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';

function WithdrawalForm(props) {
  const { pool } = useContext(AppContext);

  function action({ transactionAmount }) {
    const withdrawalAmount = usdcToAtomic(transactionAmount);
    return pool.methods.withdraw(withdrawalAmount);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const availableAmount = fiduFromAtomic(props.capitalProvider.availableToWithdrawal);
  const availableToWithdraw = minimumNumber(availableAmount, usdcFromAtomic(props.poolData.balance));

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <div className="form-field">
          <TransactionInput formMethods={formMethods} maxAmount={availableToWithdraw} />
        </div>
        <LoadingButton
          action={() => action(formMethods.getValues())}
          actionComplete={actionComplete}
          txData={{ type: 'Withdraw', amount: formMethods.getValues('transactionAmount') }}
          sendFromUser={true}
        />
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
