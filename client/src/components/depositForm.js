import React, { useState } from 'react';
import { pool } from '../ethereum/pool';
import { erc20 } from '../ethereum/erc20';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils';

function DepositForm(props) {
  const [value, setValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    setShowSuccess(false);
  }

  function action() {
    const depositAmount = toAtomic(value);
    const userAddress = props.capitalProvider.address;
    return sendFromUser(erc20.methods.approve(pool._address, toAtomic(10000)), userAddress).then((result) => {
      return sendFromUser(pool.methods.deposit(depositAmount), userAddress).then((result) => {
        setValue('');
        setShowSuccess(true);
        props.actionComplete();
      });
    });
  }

  return (
    <div className="form-full">
      <nav className="form-nav">
        <div className='form-nav-option selected'>Deposit</div>
        <div onClick={props.cancelAction} className="form-nav-option cancel">Cancel</div>
      </nav>
      <p className="form-message">Deposit funds into the pool, and receive a portion of future interest. The current pool size is {fromAtomic(props.poolData.balance)}.</p>
      <div className="form-inputs">
        <div className="input-container">
          <input value={value} placeholder='10.0' onChange={handleChange} className="big-number-input"></input>
        </div>
        <button onClick={() => {action()}} className="button-dk submit-payment">Make Deposit</button>
      </div>
      {showSuccess ? <div className="form-message">Deposit successfully completed!</div> : ""}
    </div>
  )
}

export default DepositForm;
