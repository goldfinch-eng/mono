import React, { useState, useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { toAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import LoadingButton from './loadingButton';
import iconX from '../images/x-small-purp.svg';

function DrawdownForm(props) {
  const { creditDesk } = useContext(AppContext);
  const [value, setValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    setShowSuccess(false);
  }

  function makeDrawdown() {
    const drawdownAmount = toAtomic(value);
    return sendFromUser(creditDesk.methods.drawdown(drawdownAmount, props.creditLine.address), props.borrower).then(
      result => {
        setValue('');
        setShowSuccess(true);
        props.actionComplete();
      },
    );
  }

  return (
    <div className="form-full">
      <nav className="form-nav">
        <div className="form-nav-option selected">Drawdown</div>
        <div onClick={props.cancelAction} className="form-nav-option cancel">
          Cancel
          <img className="cancel-icon" src={iconX} alt="x" />
        </div>
      </nav>
      <div className="form-inputs">
        <div className="input-container">
          <input value={value} placeholder="0.0" onChange={handleChange} className="big-number-input"></input>
        </div>
        <LoadingButton action={makeDrawdown} txData={{ amount: value, type: 'Drawdown' }} text="Submit" />
      </div>
      {showSuccess ? <div className="success-message">Drawdown successfully completed!</div> : ''}
    </div>
  );
}

export default DrawdownForm;
