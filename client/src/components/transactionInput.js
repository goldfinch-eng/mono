import React from 'react';
import { ErrorMessage } from '@hookform/error-message';
import { displayDollars } from '../utils';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import { Tickers } from '../ethereum/erc20';

function TransactionInput(props) {
  let name = props.name || 'transactionAmount';
  let inputClass = props.inputClass || '';
  if (props.disabled) {
    inputClass = 'disabled';
  }
  let onChange = props.onChange || (() => {});
  let validations = props.validations || {};
  let notes = _.compact(props.notes || []);
  let ticker = props.ticker || Tickers.USDC;

  let noteEls = notes.map(({ key, content }) => (
    <div key={key} className="form-input-note">
      {content}
    </div>
  ));
  let errors = Object.keys(props.formMethods.errors);
  if (errors.length > 0) {
    errors.map(name => {
      noteEls.push(
        <div key="error" className="form-input-note">
          <ErrorMessage
            message={(function(errors, name) {
              return errors[name] && errors[name].message;
            })(props.formMethods.errors, name)}
            name={name}
          />
        </div>,
      );
    });
  }

  return (
    <div className="form-field">
      <div className={`form-input-container ${inputClass}`}>
        <div className="transaction-input">
          {ticker === Tickers.USDC && <div className="ticker before">$</div>}
          <input
            name={name}
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
                decimals: value => new BigNumber(value).decimalPlaces() <= 6 || 'Maximum allowed decimal places is 6',
                ...validations,
              },
            })}
          ></input>
          {ticker !== Tickers.USDC && <div className="ticker after">{ticker}</div>}
          {props.rightDecoration}
        </div>
        {noteEls}
      </div>
    </div>
  );
}

export default TransactionInput;
