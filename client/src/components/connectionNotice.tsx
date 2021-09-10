import {useLocation} from "react-router-dom"
import {AppContext} from "../App"
import {CreditLine} from "../ethereum/creditLine"
import {UnlockedStatus} from "../ethereum/user"
import useNonNullContext from "../hooks/useNonNullContext"
import {useSession, useSignIn} from "../hooks/useSignIn"
import UnlockUSDCForm from "./unlockUSDCForm"
import VerifyAddressBanner from "./verifyAddressBanner"
import {useForm, FormProvider} from "react-hook-form"
import LoadingButton from "./loadingButton"

interface ConnectionNoticeProps {
  creditLine?: CreditLine
  requireVerify?: boolean
  requireUnlock?: boolean
  requireSignIn?: boolean
}

function SignInBanner() {
  const [, signIn] = useSignIn()
  const formMethods = useForm()

  return (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
        <div className="message">Please sign in to continue.</div>
        <LoadingButton action={signIn} text="Sign in" />
      </div>
    </FormProvider>
  )
}

function ConnectionNotice({
  requireUnlock = true,
  requireVerify = false,
  requireSignIn = false,
  creditLine,
}: ConnectionNoticeProps) {
  const {network, user} = useNonNullContext(AppContext)
  const session = useSession()
  let location = useLocation()
  let notice: JSX.Element | null = null

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
        <div className="message">
          It looks like you aren't on the right Ethereum network. To use Goldfinch, you should connect to Ethereum
          Mainnet from Metamask.
        </div>
      </div>
    )
  } else if (user.web3Connected && session.status === "unknown") {
    notice = (
      <div className="info-banner background-container">
        <div className="message">
          You are not currently connected to Metamask. To use Goldfinch, you first need to connect to Metamask.
        </div>
      </div>
    )
  } else if (session.status !== "authenticated" && requireSignIn) {
    notice = <SignInBanner />
  } else if (creditLine && user.loaded && !creditLine.address) {
    notice = (
      <div className="info-banner background-container">
        <div className="message">
          You do not have any credit lines. To borrow funds from the pool, you need a Goldfinch credit line.
        </div>
      </div>
    )
  } else if (user.loaded) {
    if (requireUnlock) {
      let unlockStatus: UnlockedStatus | null = null
      if (location.pathname.startsWith("/pools/senior")) {
        unlockStatus = user.getUnlockStatus("earn")
      } else if (location.pathname.startsWith("/borrow")) {
        unlockStatus = user.getUnlockStatus("borrow")
      }
      if (unlockStatus && !unlockStatus.isUnlocked) {
        notice = <UnlockUSDCForm unlockAddress={unlockStatus.unlockAddress} />
      }
    }
    if (!user.goListed && requireVerify) {
      notice = <VerifyAddressBanner />
    }
  }

  return notice
}

export default ConnectionNotice
