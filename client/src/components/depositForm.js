import BN from 'bn.js';
import React, { useState, useContext } from 'react';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils';
import { AppContext } from '../App.js';
import LoadingButton from './loadingButton';
import iconX from '../images/x-small-purp.svg';

function DepositForm(props) {
  const { pool, erc20 } = useContext(AppContext);
  const [value, setValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    setShowSuccess(false);
  }

  function action() {
    const depositAmount = toAtomic(value);
    const userAddress = props.capitalProvider.address;
    if (props.capitalProvider.allowance.lte(new BN(depositAmount))) {
      return sendFromUser(erc20.methods.approve(pool._address, toAtomic(100000)), userAddress).then(result => {
        props.actionComplete();
      });
    } else {
      return sendFromUser(pool.methods.deposit(depositAmount), userAddress).then(result => {
        setValue('');
        setShowSuccess(true);
        props.actionComplete();
      });
    }
  }

  return (
    <div className="form-full">
      <nav className="form-nav">
        <div className="form-nav-option selected">Deposit</div>
        <div onClick={props.cancelAction} className="form-nav-option cancel">
          Cancel
          <img className="cancel-icon" src={iconX} alt="x" />
        </div>
      </nav>
      <p className="form-message">
        Deposit funds into the pool, and receive a portion of future interest. The current pool size is{' '}
        {fromAtomic(props.poolData.balance)}.
      </p>
      <div className="form-inputs">
        <div className="input-container">
          <input value={value} onChange={handleChange} className="big-number-input"></input>
        </div>
        <LoadingButton action={action} text="Submit" />
      </div>
      {showSuccess ? <div className="success-message">Deposit successfully completed!</div> : ''}
    </div>
  );
}

export default DepositForm;
