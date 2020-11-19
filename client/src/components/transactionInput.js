import React from 'react';
import { ErrorMessage } from '@hookform/error-message';
import { displayDollars } from '../utils';

function TransactionInput(props) {
  let name = props.name || 'transactionAmount';
  let inputClass = props.inputClass || '';
  let onChange = props.onChange || (() => {});
  return (
    <div className="form-field">
      <div className={`form-input-container dollar ${inputClass}`}>
        <input
          name={name}
          type="number"
          onChange={onChange}
          placeholder="0"
          className="form-input"
          ref={props.formMethods.register({
            required: 'Amount is required',
            min: { value: 0.0000001, message: 'Must be greater than 0' },
            max: {
              value: props.maxAmount,
              message: `Amount is above the max allowed (${displayDollars(props.maxAmount)}). `,
            },
          })}
        ></input>
        <div className="form-input-note">
          <ErrorMessage errors={props.formMethods.errors} name={name} />
        </div>
      </div>
    </div>
  );
}

export default TransactionInput;
