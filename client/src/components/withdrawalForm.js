import React, { useContext, useState } from 'react';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils.js';
import { AppContext } from '../App.js';
import LoadingButton from './loadingButton';
import iconX from '../images/x-small-purp.svg';

function WithdrawalForm(props) {
  const { pool } = useContext(AppContext);
  const [value, setValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    setShowSuccess(false);
  }

  async function action() {
    const withdrawalAmount = toAtomic(value);
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), props.capitalProvider.address).then(result => {
      setValue('');
      setShowSuccess(true);
      props.actionComplete();
    });
  }

  return (
    <div className="form-full">
      <nav className="form-nav">
        <div className="form-nav-option selected">Withdrawal</div>
        <div onClick={props.cancelAction} className="form-nav-option cancel">
          Cancel
          <img className="cancel-icon" src={iconX} alt="x" />
        </div>
      </nav>
      <p className="form-message">
        Withdrawal funds from the pool, up to your balance of {fromAtomic(props.capitalProvider.availableToWithdrawal)}.
      </p>
      <div className="form-inputs">
        <div className="input-container">
          <input value={value} onChange={handleChange} placeholder="0.0" className="big-number-input"></input>
        </div>
        <LoadingButton action={action} text="Submit" />
      </div>
      {showSuccess ? <div className="success-message">Withdrawal successfully completed!</div> : ''}
    </div>
  );
}

export default WithdrawalForm;
