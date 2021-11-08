import {ErrorMessage} from "@hookform/error-message"
import Persona from "persona"
import {useContext, useEffect, useReducer, useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {Link} from "react-router-dom"
import {AppContext, NetworkConfig, SetSessionFn} from "../App"
import {User, UserLoaded} from "../ethereum/user"
import {LOCAL, MAINNET} from "../ethereum/utils"
import DefaultGoldfinchClient, {KYC} from "../hooks/useGoldfinchClient"
import useNonNullContext from "../hooks/useNonNullContext"
import useSendFromUser from "../hooks/useSendFromUser"
import {Session, useSignIn} from "../hooks/useSignIn"
import {assertNonNullable} from "../utils"
import ConnectionNotice from "./connectionNotice"
import {iconAlert, iconCircleCheck} from "./icons"
import LoadingButton from "./loadingButton"
import TransactionForm from "./transactionForm"
import {UniqueIdentity as UniqueIdentityContract} from "@goldfinch-eng/protocol/typechain/web3/UniqueIdentity"
import web3 from "web3"

function VerificationNotice({icon, notice}) {
  return (
    <div className="verify-card info-banner background-container subtle">
      <div className="message">
        {icon}
        <p>{notice}</p>
      </div>
    </div>
  )
}

function EntityForm({onClose}) {
  return (
    <TransactionForm
      headerMessage="Entity"
      render={() => {
        return (
          <>
            <div className="form-message paragraph">
              Goldfinch is open to non-U.S. entities, and there may be opportunities soon for U.S. entities that qualify
              as accredited investors.
            </div>
            <div className="form-message paragraph">
              To verify or pre-verify, please fill out{" "}
              <a
                className="link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.google.com/forms/d/1qr5-dw3E3OplNjgUk5JidiT6zLS3ZVbVZ6bWl3QwTq4/viewform"
              >
                this form
              </a>
              . Then we will reach out with next steps.
            </div>
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}

function NonUSForm({entityType, onClose, onEvent, network, address}) {
  return (
    <TransactionForm
      headerMessage="Non-U.S. Individual"
      render={({formMethods}) => {
        return (
          <PersonaForm
            entityType={entityType}
            network={network}
            address={address}
            onEvent={onEvent}
            formMethods={formMethods}
          />
        )
      }}
      closeForm={onClose}
    />
  )
}

function USForm({kycStatus, entityType, onClose, onEvent, network, address}) {
  return (
    <TransactionForm
      headerMessage="U.S. Individual"
      render={({formMethods}) => {
        let verifyIdSection
        if (kycStatus === "approved") {
          verifyIdSection = (
            <div className="placeholder">
              <span className="verify-step-label">Step 1: Verify ID {iconCircleCheck}</span>
            </div>
          )
        } else {
          verifyIdSection = (
            <>
              <div> Step 1: Verify ID</div>
              <PersonaForm
                entityType={entityType}
                network={network}
                address={address}
                onEvent={onEvent}
                formMethods={formMethods}
              />
              <div className="form-separator background-container-inner"></div>
            </>
          )
        }
        return (
          <>
            <div className="form-message paragraph">
              Goldfinch may soon have opportunities for U.S. individuals who qualify as accredited investors. You can
              pre-verify your address.
            </div>
            {verifyIdSection}
            <h2>Step 2: Verify Accredited Status</h2>
            <div className="form-message paragraph">
              To verify your accredited status, start by filling out{" "}
              <a className="link" target="_blank" rel="noopener noreferrer" href="https://forms.gle/DmhWgpJUbMphtqC19">
                this form
              </a>
              . Then we will reach out with next steps.
            </div>
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}

function PersonaForm({entityType, onEvent, network, address, formMethods}) {
  const PERSONA_CONFIG = {
    mainnet: {templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "production"},
    localhost: {templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "sandbox"},
  }

  function verifyOnPersona(data, e) {
    e.preventDefault()
    const config = PERSONA_CONFIG[network]
    const client = new Persona.Client({
      templateId: config.templateId,
      environment: config.environment,
      referenceId: address,
      prefill: {
        emailAddress: data.email,
        discord_name: data.discord,
        country_us: entityType === "US",
      } as any,
      onLoad: (_error) => client.open(),
      onComplete: () => {
        onEvent("complete")
      },
      onFail: (id) => {
        onEvent("fail")
      },
      onExit: (error) => {
        onEvent("exit")
      },
    })
  }

  return (
    <>
      <div>
        <div className="form-input-label">Email</div>
        <div className="form-field">
          <div className="form-input-container">
            <input
              type="email"
              name="email"
              placeholder="email@example.com"
              className="form-input small-text"
              ref={formMethods.register({required: true, pattern: /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/})}
            ></input>
            <div className="form-input-note">
              <ErrorMessage errors={formMethods.errors} name="email" message="That doesn't look like a valid email" />
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="form-input-label">(Optional) Discord username</div>
        <div className="form-inputs-footer">
          <div className="form-field">
            <div className="form-input-container">
              <input
                type="text"
                name="discord"
                placeholder="user#1234"
                className="form-input small-text"
                ref={formMethods.register({pattern: /[a-zA-Z0-9]+#[0-9]{4}/})}
              />
              <div className="form-input-note">
                <ErrorMessage
                  errors={formMethods.errors}
                  name="discord"
                  message="That doesn't look like a valid discord username (make sure to include the # and the 4 digit number)"
                />
              </div>
            </div>
          </div>
          <button className={"button submit-form verify"} onClick={formMethods.handleSubmit(verifyOnPersona)}>
            Verify ID
          </button>
        </div>
      </div>
      <div className="form-footer-message">
        Please note: we use{" "}
        <a className="link" target="_blank" rel="noopener noreferrer" href="https://withpersona.com/security/">
          Persona
        </a>{" "}
        to verify your identity, and they handle all personal information. The only information we store is your ETH
        address, country, and approval status. We take privacy seriously.
      </div>
    </>
  )
}

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

function VerifyCard({
  children,
  title,
  disabled = false,
}: React.PropsWithChildren<{title?: string; disabled?: boolean}>) {
  return (
    <div className={`background-container ${disabled && "placeholder"} verify-card`}>
      {title && <h1 className="title">{title}</h1>}
      {children}
    </div>
  )
}

function ErrorCard({title}: {title: string}) {
  return (
    <VerifyCard title={title} disabled={false}>
      <p className="font-small">Oops, there was an error. Try refreshing the page.</p>
    </VerifyCard>
  )
}

function isEligible(kyc: KYC | undefined, user: UserLoaded | undefined): boolean {
  return (
    (!!kyc && kyc.status === "approved" && kyc.countryCode !== "US" && kyc.countryCode !== "") ||
    (!!user && user.info.value.goListed)
  )
}

function VerifyAddress({disabled, dispatch}: {disabled: boolean; dispatch: React.Dispatch<Action>}) {
  const {user, network, setSessionData} = useContext(AppContext)
  const [kyc, setKYC] = useState<KYC>()
  // Determines the form to show. Can be empty, "US" or "entity"
  const [entityType, setEntityType] = useState<string>("")
  const [session] = useSignIn()
  const [loading, setLoading] = useState<boolean>(false)
  const [errored, setErrored] = useState<boolean>(false)

  useEffect(() => {
    if (errored || loading) {
      return
    }

    if (!kyc && session.status === "authenticated") {
      fetchKYCStatus(session)
    } else if (isEligible(kyc, user) && !disabled) {
      dispatch({type: CREATE_UID})
    }
  })

  async function fetchKYCStatus(session: Session) {
    if (session.status !== "authenticated") {
      return
    }
    assertNonNullable(user)
    assertNonNullable(network)
    assertNonNullable(setSessionData)
    setLoading(true)
    const client = new DefaultGoldfinchClient(network.name!, session, setSessionData)
    try {
      const response = await client.fetchKYCStatus(user.address)
      if (response.ok) {
        setKYC(response.json)
        if (response.json.countryCode === "US") {
          setEntityType("US")
        }
      }
    } catch (err: unknown) {
      setErrored(true)
    } finally {
      setLoading(false)
    }
  }

  function chooseEntity(chosenType) {
    setEntityType(chosenType)
  }

  function renderForm() {
    if (user && user.info.value.goListed) {
      return (
        <VerificationNotice
          icon={iconCircleCheck}
          notice={
            <>
              Your verification was approved to participate in the{" "}
              <Link className="form-link" to="/pools/senior">
                Senior Pool
              </Link>
              .
            </>
          }
        />
      )
    } else if (loading) {
      return <LoadingCard title="Verify your address" />
    } else if (errored) {
      return <ErrorCard title="Verify your address" />
    } else if (kyc?.status === "failed") {
      return (
        <VerificationNotice
          icon={iconAlert}
          notice="There was an issue verifying your address. For help, please contact verify@goldfinch.finance and include your address."
        />
      )
    } else if (entityType === "US") {
      return (
        <USForm
          kycStatus={kyc?.status}
          entityType={entityType}
          onClose={() => setEntityType("")}
          network={network?.name}
          address={user?.address}
          onEvent={() => fetchKYCStatus(session)}
        />
      )
    } else if (entityType === "entity") {
      return <EntityForm onClose={() => setEntityType("")} />
    } else if (isEligible(kyc, user)) {
      return (
        <VerificationNotice
          icon={iconCircleCheck}
          notice={
            <>
              Your verification was approved to participate in the{" "}
              <Link className="form-link" to="/pools/senior">
                Senior Pool
              </Link>
              .
            </>
          }
        />
      )
    } else if (entityType === "non-US") {
      return (
        <NonUSForm
          onClose={() => setEntityType("")}
          entityType={entityType}
          network={network?.name}
          address={user?.address}
          onEvent={() => fetchKYCStatus(session)}
        />
      )
    } else {
      const nonUSDisabled = kyc?.countryCode === "US" ? "disabled" : ""
      return (
        <VerifyCard title="Verify your address" disabled={disabled}>
          <div className="form-message">Who is verifying this address?</div>
          <div className="verify-types">
            <button
              className={`button ${nonUSDisabled}`}
              disabled={nonUSDisabled === "disabled"}
              onClick={() => chooseEntity("non-US")}
            >
              Non-U.S. Individual
            </button>
            <button className={"button"} onClick={() => chooseEntity("US")}>
              U.S. Individual
            </button>
            <button className={"button"} onClick={() => chooseEntity("entity")}>
              Entity
            </button>
          </div>
        </VerifyCard>
      )
    }
  }

  return renderForm()
}

function LoadingCard({title}: {title?: string}) {
  return (
    <VerifyCard disabled={true} title={title}>
      <p>Loading...</p>
    </VerifyCard>
  )
}

const UNIQUE_IDENTITY_SIGNER_URLS = {
  [LOCAL]: "/uniqueIdentitySigner", // Proxied by webpack to packages/server/index.ts
  [MAINNET]:
    "https://api.defender.openzeppelin.com/autotasks/bc31d6f7-0ab4-4170-9ba0-4978a6ed6034/runs/webhook/6a51e904-1439-4c68-981b-5f22f1c0b560/3fwK6xbVKfeBHZjSdsYQWe",
}

const UNIQUE_IDENTITY_MINT_PRICE = web3.utils.toWei("0.00083", "ether")

const START = "start"
const SIGN_IN = "sign_in"
const VERIFY_ADDRESS = "verify_address"
const CREATE_UID = "create_uid"
const END = "end"
type Step = typeof START | typeof SIGN_IN | typeof VERIFY_ADDRESS | typeof CREATE_UID | typeof END

const initialState: {step: Step} = {
  step: START,
}

type Action = {type: Step}
const reducer = (state: typeof initialState, action: Action): typeof initialState => {
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
    }
  } else if (action.type === END) {
    return {
      ...state,
      step: END,
    }
  }
  return state
}

type SignatureResponse = {signature: string; expiresAt: number}
function asSignatureResponse(obj: any): SignatureResponse {
  if (typeof obj.result !== "string") {
    throw new Error(`${obj} is not a signature response`)
  }
  const result = JSON.parse(obj.result)
  if (typeof result.signature !== "string") {
    throw new Error(`${obj} is not a signature response`)
  }
  if (typeof result.expiresAt !== "number") {
    throw new Error(`${obj} is not a signature response`)
  }
  return result
}

async function fetchTrustedSignature({
  network,
  session,
  setSessionData,
  user,
}: {
  network: NetworkConfig
  session: Session
  setSessionData: SetSessionFn
  user: User
}): Promise<SignatureResponse> {
  assertNonNullable(network.name)
  if (session.status !== "authenticated") {
    throw new Error("not authenticated")
  }
  const client = new DefaultGoldfinchClient(network.name, session, setSessionData)
  const auth = client._getAuthHeaders(user.address)

  const response = await fetch(UNIQUE_IDENTITY_SIGNER_URLS[network.name], {
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({auth}),
    method: "POST",
  })
  const body = await response.json()
  return asSignatureResponse(body)
}

function CreateUID({disabled, dispatch}: {disabled: boolean; dispatch: React.Dispatch<Action>}) {
  const formMethods = useForm()
  const {user, network, setSessionData, goldfinchProtocol, currentBlock, refreshCurrentBlock} =
    useNonNullContext(AppContext)
  const [session] = useSignIn()
  const sendFromUser = useSendFromUser()
  const [errored, setErrored] = useState<boolean>(false)

  useEffect(() => {
    if (disabled) {
      return
    }

    if (user && user.info.value.hasUID) {
      dispatch({type: END})
    }
  })

  const action = async () => {
    assertNonNullable(currentBlock)
    try {
      const trustedSignature = await fetchTrustedSignature({
        network,
        session,
        setSessionData,
        user,
      })
      const uniqueIdentity = goldfinchProtocol.getContract<UniqueIdentityContract>("UniqueIdentity")
      const version = await uniqueIdentity.methods.ID_VERSION_0().call(undefined, currentBlock.number)
      await sendFromUser(
        uniqueIdentity.methods.mint(version, trustedSignature.expiresAt, trustedSignature.signature),
        {
          type: "Mint UID",
        },
        {value: UNIQUE_IDENTITY_MINT_PRICE}
      )
      refreshCurrentBlock()
    } catch (err: unknown) {
      setErrored(true)
      console.error(err)
    }
  }

  if (user && user.info.value.hasUID) {
    return (
      <VerificationNotice
        icon={iconCircleCheck}
        notice={
          <>
            Your UID has been created. You can now participate in{" "}
            <Link className="form-link" to="/">
              Borrower Pools
            </Link>
            .<br></br>
            View your UID on{" "}
            <a
              className="form-link"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://opensea.io/${user.address}/uid?search[sortBy]=LISTING_DATE`}
            >
              OpenSea
            </a>
          </>
        }
      />
    )
  } else if (user && user.info.value.legacyGolisted) {
    return (
      <FormProvider {...formMethods}>
        <div className={`verify-card background-container subtle ${disabled && "placeholder"}`}>
          <h1 className="title">Create your UID</h1>
          <div className="info-banner subtle">
            <div className="message">
              <div>
                <p className="font-small mb-2">
                  Your verification was approved to participate in{" "}
                  <Link className="form-link" to="/">
                    Borrower Pools
                  </Link>
                  . However, there may be future opportunities that require you to mint a UID.
                </p>
              </div>
            </div>
            <LoadingButton disabled={disabled} action={action} text="Create UID" />
          </div>
        </div>
      </FormProvider>
    )
  } else if (errored) {
    return <ErrorCard title="Create your UID" />
  } else {
    return (
      <FormProvider {...formMethods}>
        <div className={`verify-card background-container subtle ${disabled && "placeholder"}`}>
          <h1 className="title">Create your UID</h1>
          <div className="info-banner subtle">
            <div className="message">
              <p className="font-small">
                Your UID, or "Unique Identity", is an NFT that represents your unique identity and grants you access to
                participate in Borrower Pools. You do not need your UID to participate in the Senior Pool.
              </p>
            </div>
            <LoadingButton disabled={disabled} action={action} text="Create UID" />
          </div>
        </div>
      </FormProvider>
    )
  }
}

function VerifyIdentity() {
  const {user} = useContext(AppContext)
  const [session, signIn] = useSignIn()
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (state.step === START && session.status !== "authenticated") {
      dispatch({type: SIGN_IN})
    } else if ((state.step === START || state.step === SIGN_IN) && session.status === "authenticated") {
      dispatch({type: VERIFY_ADDRESS})
    }
  })

  let children: JSX.Element
  if (state.step === START) {
    children = <></>
  } else if (state.step === SIGN_IN) {
    children = (
      <SignInForm
        disabled={!user?.address}
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
