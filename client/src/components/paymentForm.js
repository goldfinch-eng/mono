import React, { useState, useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { toAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import LoadingButton from './loadingButton';

function PaymentForm(props) {
  const { creditDesk } = useContext(AppContext);
  const [show, setShow] = useState('principalPayment');
  const [showSuccess, setShowSuccess] = useState(false);
  const [prepaymentValue, setPrepaymentValue] = useState('');
  const [principalValue, setPrincipalValue] = useState('');

  function isSelected(navItem) {
    if (show === navItem) {
      return 'selected';
    };
  }

  function handleChange(e, propSetter) {
    propSetter(e.target.value);
    setShowSuccess(false);
  }

  function submitPrepayment() {
    const amount = toAtomic(prepaymentValue);
    return sendFromUser(creditDesk.methods.prepay(props.creditLine.address,  amount), props.borrower).then((_result) => {
      setPrepaymentValue(0)
      setShowSuccess(true);
      props.actionComplete();
    });
  }

  function submitPrincipalPayment() {
    const amount = toAtomic(principalValue);
    return sendFromUser(creditDesk.methods.pay(props.creditLine.address, amount), props.borrower).then((_result) => {
      setPrincipalValue(0)
      setShowSuccess(true);
      props.actionComplete();
    });
  };

  let specificPaymentForm;
  if (show === 'principalPayment') {
    specificPaymentForm = (
      <div>
        <p className="form-message">Directly pay down your current balance.</p>
        <div className="form-inputs">
          <div className="input-container">
            <input value={principalValue} placeholder="10.0" onChange={(e) => {handleChange(e, setPrincipalValue)}} className="big-number-input"></input>
          </div>
          <LoadingButton action={submitPrincipalPayment} text="Submit Payment"/>
        </div>
        {/* Will need to add a new route or something to be able to display this text */}
        {/* <div className="form-note">Note: After a principal payment of $15,000.00, your next payment due will be $496.30 on Oct 6, 2020.</div> */}
      </div>
    );
  } else {
    specificPaymentForm = (
      <div>
        <p className="form-message">Pre-pay your upcoming balance now. This will be debited on your due date, and will not affect your current balance.</p>
        <div className="form-inputs">
          <div className="input-container">
            <input value={prepaymentValue} placeholder="10.0" onChange={(e) => {handleChange(e, setPrepaymentValue)}} className="big-number-input"></input>
          </div>
          <LoadingButton action={submitPrepayment} text="Submit Pre-payment"/>
        </div>
      </div>
    );
  }
  return (
    <div className="form-full">
      <nav className="form-nav">
        <div onClick={() => { setShow('principalPayment'); }} className={`form-nav-option ${isSelected('principalPayment')}`}>Principal Payment</div>
        <div onClick={() => { setShow('prepayment') }} className={`form-nav-option ${isSelected('prepayment')}`}>Prepayment</div>
        <div onClick={props.cancelAction} className="form-nav-option cancel">Cancel</div>
      </nav>
      {specificPaymentForm}
      {showSuccess ? <div className="form-message">Payment successfully completed!</div> : ""}
    </div>
  )
}

export default PaymentForm;
