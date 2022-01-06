import React from "react"
import web3 from "../web3"
import {ErrorMessage} from "@hookform/error-message"
import {iconCheck} from "./icons"

function AddressInput(props) {
  const validValue = <div className="form-input-note verified-value">valid address {iconCheck}</div>
  const name = props.name || "sendToAddress"
  const watchName = props.formMethods.watch(name, false)
  const errors = props.formMethods.errors
  return (
    <div className="form-field">
      <div className="form-input-container">
        <input
          type="string"
          name={name}
          placeholder="0x0000"
          className="form-input small-text"
          ref={props.formMethods.register({
            validate: (value) => {
              return value === "" || web3.readOnly.utils.isAddress(value)
            },
          })}
          disabled={props.disabled}
        ></input>
        {watchName && !errors[name] && validValue}
        <div className="form-input-note">
          <ErrorMessage
            errors={props.formMethods.errors}
            name={name}
            message="That doesn't look like a valid Ethereum address"
          />
        </div>
      </div>
    </div>
  )
}

export default AddressInput
