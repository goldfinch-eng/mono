import React, { useContext } from "react"
import { withRouter } from "react-router-dom"
import { AppContext } from "../App"
import UnlockUSDCForm from "./unlockUSDCForm.js"

function ConnectionNotice(props) {
  const { network, user } = useContext(AppContext)
  let notice = ""

  if (!window.ethereum) {
    notice = (
      <div className="content-empty-message background-container">
        In order to use Goldfinch, you'll first need to download and install the Metamask plug-in from{" "}
        <a href="https://metamask.io/">metamask.io</a>.
      </div>
    )
  } else if (network.name && !network.supported) {
    notice = (
      <div className="content-empty-message background-container">
        It looks like you aren't on the right Ethereum network. To use Goldfinch, you should connect to Ethereum Mainnet
        from Metamask.
      </div>
    )
  } else if (user.web3Connected && !user.address) {
    notice = (
      <div className="content-empty-message background-container">
        You are not currently connected to Metamask. To use Goldfinch, you first need to connect to Metamask.
      </div>
    )
  } else if (props.creditLine && props.creditLine.loaded && !props.creditLine.address) {
    notice = (
      <div className="content-empty-message background-container">
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
    if (!user.goListed && !props.location.pathname.startsWith("/verify")) {
      notice = (
        <div className="content-empty-message background-container">
          Your address not been authorized to use Goldfinch.
        </div>
      )
    }
  }

  return notice
}

export default withRouter(props => ConnectionNotice(props))
