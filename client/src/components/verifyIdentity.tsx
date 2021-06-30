import React, { useState, useContext, useEffect } from "react"
import { AppContext } from "../App"
import Persona from "persona"
import web3 from "../web3"
import { ethers } from "ethers"

function VerifyIdentity(props) {
  const { user, network } = useContext(AppContext)
  const [kycStatus, setKycStatus] = useState<string>("unknown")
  const [userSignature, setUserSignature] = useState<string>("")

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
    setKycStatus((await response.json()).status)
  }

  async function getUserSignature() {
    const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
    const signer = provider.getSigner(user.address)
    setUserSignature(await signer.signMessage("Sign in to Goldfinch"))
  }

  function verifyOnPersona() {
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
    if (!kycStatus) {
      fetchKYCStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (userSignature === "") {
      getUserSignature()
    } else {
      fetchKYCStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSignature, network])

  return (
    <div className="content-section">
      <div className="page-header">Verify Identity</div>
      <div className="form-start single-option background-container">
        <div className="description">
          <div className="form-start-section">
            <div>Non-USD Individual</div>
            <div className="form-start-label"> Current KYC Status: {kycStatus}</div>
            <div className="form-start-label">
              Verify your identity. This will be associated with your metamask account
            </div>
          </div>
        </div>
        <div>
          <button className={"button dark"} onClick={verifyOnPersona}>
            Verify Identity
          </button>
        </div>
      </div>
    </div>
  )
}

export default VerifyIdentity
