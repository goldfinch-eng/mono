import React, {useContext} from "react"
import {withRouter, useHistory} from "react-router-dom"
import {AppContext} from "../App"
import UnlockUSDCForm from "./unlockUSDCForm.js"
import {iconInfo} from "./icons"

function ConnectionNotice(props) {
  const {network, user} = useContext(AppContext)
  const history = useHistory()
  let notice = ""

  let {requireVerify} = props
  if (requireVerify == undefined) {
    requireVerify = false
  }

  if (!window.ethereum) {
    notice = (
      <div className="info-banner background-container">
        <div className="message">
          <p>
            In order to use Goldfinch, you'll first need to download and install the Metamask plug-in from{" "}
            <a href="https://metamask.io/">metamask.io</a>.
          </p>
        </div>
      </div>
    )
  } else if (network.name && !network.supported) {
    notice = (
      <div className="info-banner background-container">
        It looks like you aren't on the right Ethereum network. To use Goldfinch, you should connect to Ethereum Mainnet
        from Metamask.
      </div>
    )
  } else if (user.web3Connected && !user.address) {
    notice = (
      <div className="info-banner background-container">
        You are not currently connected to Metamask. To use Goldfinch, you first need to connect to Metamask.
      </div>
    )
  } else if (props.creditLine && props.creditLine.loaded && !props.creditLine.address) {
    notice = (
      <div className="info-banner background-container">
        You do not have any credit lines. To borrow funds from the pool, you need a Goldfinch credit line.
      </div>
    )
  } else if (user.loaded) {
    let unlockStatus
    if (props.location.pathname.startsWith("/earn")) {
      unlockStatus = user.getUnlockStatus("earn")
    } else if (props.location.pathname.startsWith("/borrow")) {
      unlockStatus = user.getUnlockStatus("borrow")
    }
    if (unlockStatus && !unlockStatus.isUnlocked) {
      notice = <UnlockUSDCForm unlockAddress={unlockStatus.unlockAddress} />
    }
    if (!user.goListed && requireVerify) {
      notice = (
        <div className="info-banner background-container">
          <div className="message">
            {iconInfo}
            <p>
              This offering is only available to non-U.S. persons. To participate, you must first verify your address.
            </p>
          </div>
          <button
            className="button"
            onClick={() => {
              history.push("/verify")
            }}
          >
            Verify Address
          </button>
        </div>
      )
    }
  }

  return notice
}

export default withRouter(props => ConnectionNotice(props))
