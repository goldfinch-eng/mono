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
  const { creditDesk, pool, erc20, goldfinchConfig } = useContext(AppContext);
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
  const maxAmount = minimumNumber(
    creditLineBalance,
    usdcFromAtomic(poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit),
  );

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <div className="form-input-label">(Optional) Send to a specific address</div>
        <AddressInput formMethods={formMethods} />
        <div className="form-input-label">Amount</div>
        <TransactionInput formMethods={formMethods} maxAmount={maxAmount} />
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
