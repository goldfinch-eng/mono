import React from 'react';
import { ErrorMessage } from '@hookform/error-message';
import { displayDollars } from '../utils';
import BigNumber from 'bignumber.js';

function TransactionInput(props) {
  let name = props.name || 'transactionAmount';
  let inputClass = props.inputClass || '';
  if (props.disabled) {
    inputClass = 'disabled';
  }
  let onChange = props.onChange || (() => {});
  return (
    <div className="form-field">
      <div className={`form-input-container dollar ${inputClass}`}>
        <input
          name={name}
          type="number"
          disabled={props.disabled}
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
            validate: {
              decimals: value => new BigNumber(value).decimalPlaces() <= 6,
            },
          })}
        ></input>
        <div className="form-input-note">
          <ErrorMessage
            message={(function(errors, name) {
              if (errors[name] && errors[name].type === 'decimals') {
                return 'Maximum allowed decimal places is 6';
              }
            })(props.formMethods.errors, name)}
            name={name}
          />
        </div>
      </div>
    </div>
  );
}

export default TransactionInput;
