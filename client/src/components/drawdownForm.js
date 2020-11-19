import React, { useContext, useState, useEffect } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import TransactionForm from './transactionForm';
import { fetchPoolData } from '../ethereum/pool';
import { displayDollars } from '../utils';
import AddressInput from './addressInput';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';

function DrawdownForm(props) {
  const { creditDesk, pool, erc20 } = useContext(AppContext);
  const [poolData, setPoolData] = useState({});

  useEffect(() => {
    (async () => {
      setPoolData(await fetchPoolData(pool, erc20));
    })();
  }, []);

  function action({ transactionAmount, sendToAddress }) {
    const drawdownAmount = usdcToAtomic(transactionAmount);
    sendToAddress = sendToAddress || props.borrower.address;
    return creditDesk.methods.drawdown(drawdownAmount, props.creditLine.address, sendToAddress);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const creditLineBalance = usdcFromAtomic(props.creditLine.availableCredit);
  const maxAmount = minimumNumber(creditLineBalance, usdcFromAtomic(poolData.balance));

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <div className="form-field">
          <AddressInput formMethods={formMethods} />
          <TransactionInput formMethods={formMethods} maxAmount={maxAmount} />
        </div>
        <LoadingButton
          action={() => action(formMethods.getValues())}
          actionComplete={actionComplete}
          txData={{ type: 'Drawdown', amount: formMethods.getValues('transactionAmount') }}
          sendFromUser={true}
        />
      </div>
    );
  }

  return (
    <TransactionForm
      title="Drawdown"
      headerMessage={`Available to drawdown: ${displayDollars(creditLineBalance)}`}
      render={renderForm}
      closeForm={props.closeForm}
    />
  );
}

export default DrawdownForm;
