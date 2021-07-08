import React, { useState, useContext, useEffect } from "react"
import { AppContext } from "../App"
import Persona from "persona"
import web3 from "../web3"
import { ethers } from "ethers"
import { iconCircleCheck, iconClock, iconAlert } from "./icons.js"
import TransactionForm from "./transactionForm"
import { ErrorMessage } from "@hookform/error-message"

const accreditationNotice = (
  <>
    <div>
      Get your free accredited investor verification from{" "}
      <a className="link" target="_blank" href="https://parallelmarkets.com/get-accredited/">
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

function VerificationNotice({ icon, notice }) {
  return (
    <div className="background-container verify-options">
      <div>{icon}</div>
      <div>{notice}</div>
    </div>
  )
}

function EntityForm({ onClose }) {
  return (
    <TransactionForm
      headerMessage="Entity"
      render={() => {
        return (
          <>
            <div>Goldfinch is open to entities that qualify as accredited Investors.</div>
            {accreditationNotice}
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}

function NonUSForm({ entityType, onClose, onEvent, network, address }) {
  return (
    <TransactionForm
      headerMessage="Non-U.S. Individual"
      render={({ formMethods }) => {
        return (
          <>
            <PersonaForm
              entityType={entityType}
              network={network}
              address={address}
              onEvent={onEvent}
              formMethods={formMethods}
            />
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}

function USForm({ kycStatus, entityType, onClose, onEvent, network, address }) {
  return (
    <TransactionForm
      headerMessage="U.S. Individual"
      render={({ formMethods }) => {
        let verifyIdSection
        if (kycStatus === "approved") {
          verifyIdSection = (
            <div className="placeholder">
              <span>Step 1: Verify ID {iconCircleCheck}</span>
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
            </>
          )
        }
        return (
          <>
            <div>Goldfinch is open to U.S. individuals who qualify as accredited Investors.</div>
            {verifyIdSection}
            <div>Step 2: Verify Accredited Status</div>
            {accreditationNotice}
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}

function PersonaForm({ entityType, onEvent, network, address, formMethods }) {
  const PERSONA_CONFIG = {
    mainnet: { templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "production" },
    localhost: { templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "sandbox" },
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
      onLoad: _error => client.open(),
      onComplete: () => {
        onEvent("complete")
      },
      onFail: id => {
        console.log(`KYC Failed (${id})`)
        onEvent("fail")
      },
      onExit: error => {
        console.log(`KYC aborted with error: ${error?.message}`)
        onEvent("exit")
      },
    })
  }

  return (
    <>
      <div className="form-input-label">Email</div>
      <div className="form-field">
        <div className="form-input-container">
          <input
            type="email"
            name="email"
            placeholder="email@example.com"
            className="form-input small-text"
            ref={formMethods.register({ required: true, pattern: /.{1,}@[^.]{1,}/ })}
          ></input>
          <div className="form-input-note">
            <ErrorMessage errors={formMethods.errors} name="email" message="That doesn't look like a valid email" />
          </div>
        </div>
      </div>
      <div className="form-input-label">(Optional) Discord username</div>
      <div className="form-inputs-footer">
        <div className="form-field">
          <div className="form-input-container">
            <input
              type="text"
              name="discord"
              placeholder="user#1234"
              className="form-input small-text"
              ref={formMethods.register({ pattern: /[a-zA-Z0-9]+#[0-9]{4}/ })}
            />
            <div className="form-input-note">
              <ErrorMessage
                errors={formMethods.errors}
                name="discord"
                message="That doesn't look like a valid discord username"
              />
            </div>
          </div>
        </div>
        <button className={"button verify"} onClick={formMethods.handleSubmit(verifyOnPersona)}>
          Verify ID
        </button>
      </div>
    </>
  )
}

function VerifyIdentity() {
  const { user, network } = useContext(AppContext)
  const [kycStatus, setKycStatus] = useState<string>("unknown")
  // Determines the form to show. Can be empty, "US" or "entity"
  const [countryCode, setCountryCode] = useState<string>("")
  const [entityType, setEntityType] = useState<string>("")
  const [userSignature, setUserSignature] = useState<string>("")

  const API_URLS = {
    mainnet: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
    localhost: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
  }

  function getKYCURL(address, signature) {
    const baseURL = process.env.REACT_APP_GCLOUD_FUNCTIONS_URL || API_URLS[network?.name!]
    signature = signature === "pending" ? "" : signature
    return baseURL + "/kycStatus?" + new URLSearchParams({ address, signature })
  }

  async function fetchKYCStatus() {
    if (userSignature === "") {
      return
    }
    const response = await fetch(getKYCURL(user.address, userSignature))
    const responseJson = await response.json()
    setKycStatus(responseJson.status)
    if (responseJson.countryCode === "US") {
      setEntityType("US")
      setCountryCode("US")
    }
  }

  async function getUserSignature() {
    const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
    const signer = provider.getSigner(user.address)
    setUserSignature("pending")
    const signature = await signer.signMessage("Sign in to Goldfinch")
    setUserSignature(signature)
  }

  function chooseEntity(chosenType) {
    if (userSignature === "" || userSignature === "pending") {
      getUserSignature().then(_ => {
        setEntityType(chosenType)
      })
    } else {
      setEntityType(chosenType)
    }
  }

  useEffect(() => {
    if (userSignature === "") {
      getUserSignature()
    } else if (userSignature !== "pending") {
      fetchKYCStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSignature, network, user])

  function renderForm() {
    if (kycStatus === "golisted") {
      return <VerificationNotice icon={iconCircleCheck} notice="Your address verification is complete." />
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
          onEvent={() => {
            fetchKYCStatus()
          }}
        />
      )
    } else if (entityType === "entity") {
      return <EntityForm onClose={() => setEntityType("")} />
    } else if (kycStatus === "approved" && countryCode !== "US") {
      return (
        <VerificationNotice
          icon={iconClock}
          notice="Your verification has been successfully submitted and is in progress. You can expect it to be complete within a few days, and usually much faster."
        />
      )
    } else if (entityType === "non-US") {
      return (
        <NonUSForm
          onClose={() => setEntityType("")}
          entityType={entityType}
          network={network?.name!}
          address={user.address}
          onEvent={() => {
            fetchKYCStatus()
          }}
        />
      )
    } else {
      const nonUSDisabled = countryCode === "US" ? "disabled" : ""
      const disabled = user.address ? "" : "disabled"
      return (
        <>
          <div className={"background-container"}>
            <div className="">Who is verifying this address?</div>
            <div className="verify-options">
              <div className="item">
                <button
                  className={`button ${nonUSDisabled} ${disabled}`}
                  disabled={nonUSDisabled === "disabled" || disabled === "disabled"}
                  onClick={() => chooseEntity("non-US")}
                >
                  Non-U.S. Individual
                </button>
              </div>
              <div className="item">
                <button
                  className={`button ${disabled}`}
                  disabled={disabled === "disabled"}
                  onClick={() => chooseEntity("US")}
                >
                  U.S. Individual
                </button>
              </div>
              <div className="item">
                <button
                  className={`button ${disabled}`}
                  disabled={disabled === "disabled"}
                  onClick={() => chooseEntity("entity")}
                >
                  Entity
                </button>
              </div>
            </div>
          </div>
        </>
      )
    }
  }

  return (
    <div className="content-section">
      <div className="page-header">Verify Address</div>
      {renderForm()}
    </div>
  )
}

export default VerifyIdentity
