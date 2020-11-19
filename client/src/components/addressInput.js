import React from 'react';
import web3 from '../web3';
import { ErrorMessage } from '@hookform/error-message';

function AddressInput(props) {
  const validValue = <div className="form-input-note verified-value">&#10004; valid address</div>;
  const name = props.name || 'sendToAddress';
  return (
    <div className="form-field">
      <div className="form-input-label">(Optional) Send to a specific address</div>
      <div className="form-input-container">
        <input
          type="string"
          name={name}
          placeholder="0x0000"
          className="form-input small-text"
          ref={props.formMethods.register({
            validate: value => {
              return value === '' || web3.utils.isAddress(value);
            },
          })}
        ></input>
        {!props.formMethods.errors[name] && props.formMethods.getValues(name) && validValue}
        <div className="form-input-note">
          <ErrorMessage
            errors={props.formMethods.errors}
            name={name}
            message="That doesn't look like a valid Ethereum address"
          />
        </div>
      </div>
    </div>
  );
}

export default AddressInput;
