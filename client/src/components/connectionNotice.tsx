import React from "react"
import {withRouter} from "react-router-dom"
import {AppContext} from "../App"
import {UnlockedStatus} from "../ethereum/user"
import useNonNullContext from "../hooks/useNonNullContext"
import UnlockUSDCForm from "./unlockUSDCForm"
import VerifyAddressBanner from "./verifyAddressBanner"

function ConnectionNotice(props) {
  const {network, user} = useNonNullContext(AppContext)
  let notice: JSX.Element | null = null

  let {requireVerify} = props
  if (requireVerify === undefined) {
    requireVerify = false
  }

  if (!(window as any).ethereum) {
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
    let unlockStatus: UnlockedStatus | null = null
    if (props.location.pathname.startsWith("/earn")) {
      unlockStatus = user.getUnlockStatus("earn")
    } else if (props.location.pathname.startsWith("/borrow")) {
      unlockStatus = user.getUnlockStatus("borrow")
    }
    if (unlockStatus && !unlockStatus.isUnlocked) {
      notice = <UnlockUSDCForm unlockAddress={unlockStatus.unlockAddress} />
    }
    if (!user.goListed && requireVerify) {
      notice = <VerifyAddressBanner />
    }
  }

  return notice
}

export default withRouter(props => ConnectionNotice(props))
