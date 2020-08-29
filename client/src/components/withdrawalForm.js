import React, { useContext, useState } from 'react';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils.js';
import { AppContext } from '../App.js';

function WithdrawalForm(props) {
  const { pool } = useContext(AppContext);
  const [value, setValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    setShowSuccess(false);
  }

  async function action () {
    const withdrawalAmount = toAtomic(value);
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), props.capitalProvider.address).then((result) => {
      console.log("Result is...", result);
      setValue('')
      setShowSuccess(true);
      props.actionComplete();
    });
  }

  return (
    <div className="form-full">
      <nav className="form-nav">
        <div className='form-nav-option selected'>Withdrawal</div>
        <div onClick={props.cancelAction} className="form-nav-option cancel">Cancel</div>
      </nav>
      <p className="form-message">Withdrawal funds from the pool, up to your balance of {fromAtomic(props.capitalProvider.availableToWithdrawal)}.</p>
      <div className="form-inputs">
        <div className="input-container">
          <input value={value} placeholder='10.0' onChange={handleChange} className="big-number-input"></input>
        </div>
        <button onClick={() => {action()}} className="button-dk submit-payment">Make Withdrawal</button>
      </div>
      {showSuccess ? <div className="form-message">Withdrawal successfully completed!</div> : ""}
    </div>
  )
}

export default WithdrawalForm;
