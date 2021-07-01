import React, { useState, useContext, useEffect } from "react"
import { AppContext } from "../App"
import Persona from "persona"
import web3 from "../web3"
import { ethers } from "ethers"
import { iconCircleCheck, iconClock, iconAlert } from "./icons.js"
import TransactionForm from "./transactionForm"

function VerifyIdentity() {
  const { user, network } = useContext(AppContext)
  const [kycStatus, setKycStatus] = useState<string>("unknown")
  // Determines the form to show. Can be empty, "US" or "entity"
  const [entityType, setEntityType] = useState<string>("")
  const [userSignature, setUserSignature] = useState<string>("")

  const accreditationNotice = (
    <>
      <div>
        Get your free accredited investor verification from
        <a href="https://parallelmarkets.com">parallelmarkets.com</a>. When you receive your electronic
        certificate, email it to <a href="mailto:verify@goldfinch.finance">verify@goldfinch.finance</a>, along
        with your Metamask address.
      </div>
    </>
  )

  function getKYCURL(address, signature) {
    const API_URLS = {
      mainnet: "",
      localhost: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
    }
    const baseURL = process.env.REACT_APP_GCLOUD_FUNCTIONS_URL || API_URLS[network?.name!]
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
    }
  }

  async function getUserSignature() {
    const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
    const signer = provider.getSigner(user.address)
    setUserSignature(await signer.signMessage("Sign in to Goldfinch"))
  }

  function verifyOnPersona(e) {
    e.preventDefault()
    const client = new Persona.Client({
      templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H",
      environment: "sandbox",
      referenceId: user.address,
      onLoad: _error => client.open(),
      onComplete: () => {
        fetchKYCStatus()
      },
      onFail: _ => {
        fetchKYCStatus()
      },
      onExit: error => {
        console.log(`KYC Failed with error: ${error?.message}`)
        fetchKYCStatus()
      },
    })
  }

  useEffect(() => {
    if (userSignature === "") {
      getUserSignature()
    } else {
      fetchKYCStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSignature, network, user])

  function renderUSForm() {
    return (
      <TransactionForm
        headerMessage="U.S. Individual"
        render={() => {
          let verifyIdSection
          if (kycStatus === "approved") {
            verifyIdSection = <div className="placeholder">Step 1: Verify ID {iconCircleCheck}</div>
          } else {
            verifyIdSection = (
              <>
                <div> Step 1: Verify ID</div>
                <button className={"button"} onClick={verifyOnPersona}>
                  Verify ID
                </button>
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
        closeForm={() => setEntityType("")}
      />
    )
  }

  function renderEntityForm() {
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
        closeForm={() => setEntityType("")}
      />
    )
  }

  function renderNotice(icon, notice) {
    return (
      <div className={"form-start single-option background-container"}>
        <div className="form-start-label">
          {icon} {notice}
        </div>
      </div>
    )
  }

  function renderForm() {
    if (kycStatus === "golisted") {
      return renderNotice(iconCircleCheck, "Your address verification is complete.")
    } else if (entityType === "US") {
      return renderUSForm()
    } else if (entityType === "entity") {
      return renderEntityForm()
    } else if (kycStatus === "approved") {
      return renderNotice(
        iconClock,
        "Your verification has been successfully submitted and is in progress. You can expect it to be complete within a few days, and usually much faster.",
      )
    } else if (kycStatus === "failed") {
      return renderNotice(
        iconAlert,
        "There was an issue verifying your address. For help, please contact verify@goldfinch.finance and include your address.",
      )
    } else if (kycStatus === "unknown") {
      return (
        <>
          <div className={"form-start single-option background-container"}>
            <div className="form-start-label">Who is verifying this address?</div>
            <div className="form-start-section">
              <button className={"button"} onClick={verifyOnPersona}>
                Non-U.S. Individual
              </button>
            </div>
            <div className="form-start-section">
              <button className={"button"} onClick={() => setEntityType("US")}>
                U.S. Individual
              </button>
            </div>
            <div className="form-start-section">
              <button className={"button"} onClick={() => setEntityType("entity")}>
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
      {renderForm()}
    </div>
  )
}

export default VerifyIdentity
