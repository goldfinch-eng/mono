import {ErrorMessage} from "@hookform/error-message"
import Persona from "persona"
import {useContext, useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {Link} from "react-router-dom"
import {AppContext} from "../App"
import DefaultGoldfinchClient from "../hooks/useGoldfinchClient"
import {Session, useSignIn} from "../hooks/useSignIn"
import {assertNonNullable} from "../utils"
import ConnectionNotice from "./connectionNotice"
import {iconAlert, iconCircleCheck, iconClock} from "./icons.js"
import LoadingButton from "./loadingButton"
import TransactionForm from "./transactionForm"

function VerificationNotice({icon, notice}) {
  return (
    <div className="info-banner background-container subtle">
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
              . Then, get your free accredited investor verification from{" "}
              <a
                className="link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://parallelmarkets.com/get-accredited/"
              >
                parallelmarkets.com
              </a>{" "}
              and email your electronic certificate to{" "}
              <a className="link" href="mailto:verify@goldfinch.finance">
                verify@goldfinch.finance
              </a>
              .
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
              Get your free accredited investor verification from{" "}
              <a
                className="link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://parallelmarkets.com/get-accredited/"
              >
                parallelmarkets.com
              </a>
              . When you receive your electronic certificate, email it to{" "}
              <a className="link" href="mailto:verify@goldfinch.finance">
                verify@goldfinch.finance
              </a>
              , along with your Metamask address.
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

function VerifyIdentity() {
  const {user, network, setSessionData} = useContext(AppContext)
  const [kycStatus, setKycStatus] = useState<string>("")
  // Determines the form to show. Can be empty, "US" or "entity"
  const [countryCode, setCountryCode] = useState<string>("")
  const [entityType, setEntityType] = useState<string>("")
  const [session, signIn] = useSignIn()

  async function fetchKYCStatus(session: Session) {
    if (session.status !== "authenticated") {
      return
    }
    assertNonNullable(network)
    assertNonNullable(setSessionData)
    const client = new DefaultGoldfinchClient(network.name!, session, setSessionData)
    const response = await client.fetchKYCStatus(user.address)
    if (response.ok) {
      setKycStatus(response.json.status)
      if (response.json.countryCode === "US") {
        setEntityType("US")
        setCountryCode("US")
      }
    }
  }

  async function getSignatureAndKycStatus() {
    const session = await signIn()
    await fetchKYCStatus(session)
  }

  function chooseEntity(chosenType) {
    setEntityType(chosenType)
  }

  function renderForm() {
    if (user.goListed) {
      return <VerificationNotice icon={iconCircleCheck} notice="Your address verification is complete." />
    } else if (kycStatus === "") {
      return <SignInForm disabled={!user.address} action={() => getSignatureAndKycStatus()} />
    } else if (kycStatus === "failed") {
      return (
        <VerificationNotice
          icon={iconAlert}
          notice="There was an issue verifying your address. For help, please contact verify@goldfinch.finance and include your address."
        />
      )
    } else if (entityType === "US") {
      return (
        <USForm
          kycStatus={kycStatus}
          entityType={entityType}
          onClose={() => setEntityType("")}
          network={network?.name!}
          address={user.address}
          onEvent={() => fetchKYCStatus(session)}
        />
      )
    } else if (entityType === "entity") {
      return <EntityForm onClose={() => setEntityType("")} />
    } else if (kycStatus === "approved" && countryCode !== "US") {
      return (
        <VerificationNotice
          icon={iconClock}
          notice={
            <>
              Your verification was approved to immediately access the <Link to="/pools/senior">Senior Pool</Link>.
              Later, we'll email you when you are on the Backer list and can supply to Borrower Pools.
            </>
          }
        />
      )
    } else if (entityType === "non-US") {
      return (
        <NonUSForm
          onClose={() => setEntityType("")}
          entityType={entityType}
          network={network?.name!}
          address={user.address}
          onEvent={() => fetchKYCStatus(session)}
        />
      )
    } else {
      const nonUSDisabled = countryCode === "US" ? "disabled" : ""
      return (
        <>
          <div className={"background-container"}>
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
          </div>
        </>
      )
    }
  }

  return (
    <div className="content-section">
      <div className="page-header">Verify Address</div>
      <ConnectionNotice />
      {renderForm()}
    </div>
  )
}

export default VerifyIdentity
