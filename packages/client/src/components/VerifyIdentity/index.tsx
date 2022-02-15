import {useContext, useEffect, useReducer} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {AppContext} from "../../App"
import {useCurrentRoute} from "../../hooks/useCurrentRoute"
import {useSignIn} from "../../hooks/useSignIn"
import {assertNonNullable} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import LoadingButton from "../loadingButton"
import {Action, CREATE_UID, END, SIGN_IN, START, State, VERIFY_ADDRESS} from "./constants"
import CreateUID from "./CreateUID"
import VerifyAddress from "./VerifyAddress"

function SignInForm({action, disabled}) {
  const formMethods = useForm({mode: "onChange", shouldUnregister: false})
  return (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container subtle">
        <div className="message small">
          <p>First, please sign in to confirm your address.</p>
        </div>
        <LoadingButton text="Sign in" action={action} disabled={disabled} />
      </div>
    </FormProvider>
  )
}

const initialState: State = {
  step: START,
}

const reducer = (state: State, action: Action): State => {
  if (action.type === SIGN_IN) {
    return {
      ...state,
      step: SIGN_IN,
    }
  } else if (action.type === VERIFY_ADDRESS) {
    return {
      ...state,
      step: VERIFY_ADDRESS,
    }
  } else if (action.type === CREATE_UID) {
    return {
      ...state,
      step: CREATE_UID,
      kyc: action.kyc,
    }
  } else if (action.type === END) {
    return {
      ...state,
      step: END,
    }
  }
  return state
}

function VerifyIdentity() {
  const {userWalletWeb3Status, currentBlock, setLeafCurrentBlock} = useContext(AppContext)
  const [session, signIn] = useSignIn()
  const [state, dispatch] = useReducer(reducer, initialState)
  const currentRoute = useCurrentRoute()

  useEffect(() => {
    if (state.step === START && session.status !== "authenticated") {
      dispatch({type: SIGN_IN})
    } else if ((state.step === START || state.step === SIGN_IN) && session.status === "authenticated") {
      dispatch({type: VERIFY_ADDRESS})
    }
  })

  useEffect(
    () => {
      if (currentBlock) {
        assertNonNullable(setLeafCurrentBlock)
        assertNonNullable(currentRoute)
        setLeafCurrentBlock(currentRoute, currentBlock)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentBlock?.number]
  )

  let children: JSX.Element
  if (state.step === START) {
    children = <></>
  } else if (state.step === SIGN_IN) {
    const userAddress = userWalletWeb3Status?.address
    children = (
      <SignInForm
        disabled={!userAddress}
        action={async () => {
          const session = await signIn()
          if (session.status !== "authenticated") {
            throw new Error("not authenticated")
          }
          dispatch({type: VERIFY_ADDRESS})
        }}
      />
    )
  } else {
    children = (
      <>
        <VerifyAddress disabled={state.step !== VERIFY_ADDRESS} dispatch={dispatch} />
        <CreateUID disabled={state.step !== CREATE_UID} dispatch={dispatch} />
      </>
    )
  }

  return (
    <div className="content-section verify-identity">
      <div className="page-header">Verify your identity</div>
      <ConnectionNotice requireUnlock={false} />
      {children}
    </div>
  )
}

export default VerifyIdentity
