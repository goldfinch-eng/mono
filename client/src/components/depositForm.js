import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App.js';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';

function DepositForm(props) {
  const { pool, user, goldfinchConfig } = useContext(AppContext);

  function action({ transactionAmount }) {
    const depositAmount = usdcToAtomic(transactionAmount);
    return pool.methods.deposit(depositAmount);
  }

  function actionComplete() {
    props.actionComplete();
    props.closeForm();
  }

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <TransactionInput
          formMethods={formMethods}
          maxAmount={minimumNumber(user.usdcBalance, usdcFromAtomic(goldfinchConfig.transactionLimit))}
        />
        <LoadingButton
          action={() => action(formMethods.getValues())}
          actionComplete={actionComplete}
          txData={{ type: 'Deposit', amount: formMethods.getValues('transactionAmount') }}
          sendFromUser={true}
        />
      </div>
    );
  }

  return (
    <TransactionForm
      title="Deposit"
      headerMessage={`Available to deposit: ${displayDollars(user.usdcBalance)}`}
      render={renderForm}
      closeForm={props.closeForm}
      needsApproval={true}
    />
  );
}

export default DepositForm;
