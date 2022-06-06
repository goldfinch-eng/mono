import {getIDType} from "@goldfinch-eng/autotasks/unique-identity-signer/utils"
import {UniqueIdentity as UniqueIdentityContract} from "@goldfinch-eng/protocol/typechain/web3/UniqueIdentity"
import React, {useContext, useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import Web3Library from "web3"
import {AppContext, SetSessionFn} from "../../App"
import {US_ACCREDITED_INDIVIDUAL_ID_TYPE_1, US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2} from "../../ethereum/user"
import {LOCAL, MAINNET} from "../../ethereum/utils"
import AuthenticatedGoldfinchClient from "../../hooks/useGoldfinchClient"
import useSendFromUser from "../../hooks/useSendFromUser"
import {Session, useSignIn} from "../../hooks/useSignIn"
import {NetworkConfig} from "../../types/network"
import {MINT_UID_TX_TYPE} from "../../types/transactions"
import {UserWalletWeb3Status} from "../../types/web3"
import {assertNonNullable} from "../../utils"
import Banner from "../banner"
import {iconCircleCheck} from "../icons"
import LoadingButton from "../loadingButton"
import {Action} from "./constants"
import ErrorCard from "./ErrorCard"

const UNIQUE_IDENTITY_SIGNER_URLS = {
  [LOCAL]: "/uniqueIdentitySigner", // Proxied by webpack to packages/server/index.ts
  [MAINNET]:
    "https://api.defender.openzeppelin.com/autotasks/bc31d6f7-0ab4-4170-9ba0-4978a6ed6034/runs/webhook/6a51e904-1439-4c68-981b-5f22f1c0b560/3fwK6xbVKfeBHZjSdsYQWe",
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

const UNIQUE_IDENTITY_MINT_PRICE = Web3Library.utils.toWei("0.00083", "ether")

async function fetchTrustedSignature({
  network,
  session,
  setSessionData,
  userWalletWeb3Status,
}: {
  network: NetworkConfig
  session: Session
  setSessionData: SetSessionFn
  userWalletWeb3Status: UserWalletWeb3Status
}): Promise<SignatureResponse> {
  assertNonNullable(network.name)
  if (session.status !== "authenticated") {
    throw new Error("not authenticated")
  }
  const userAddress = userWalletWeb3Status.address
  assertNonNullable(userAddress)
  const client = new AuthenticatedGoldfinchClient(network.name, session, setSessionData)
  const auth = client._getAuthHeaders(userAddress)

  const response = await fetch(UNIQUE_IDENTITY_SIGNER_URLS[network.name], {
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({auth}),
    method: "POST",
  })
  const body = await response.json()
  return asSignatureResponse(body)
}

export default function CreateUID({disabled, dispatch}: {disabled: boolean; dispatch: React.Dispatch<Action>}) {
  const formMethods = useForm()
  const {user, userWalletWeb3Status, network, setSessionData, goldfinchProtocol, currentBlock, refreshCurrentBlock} =
    useContext(AppContext)
  const [session] = useSignIn()
  const sendFromUser = useSendFromUser()
  const [errored, setErrored] = useState<boolean>(false)

  const action = async () => {
    assertNonNullable(currentBlock)
    assertNonNullable(refreshCurrentBlock)
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(network)
    assertNonNullable(setSessionData)
    assertNonNullable(userWalletWeb3Status)
    try {
      const trustedSignature = await fetchTrustedSignature({
        network,
        session,
        setSessionData,
        userWalletWeb3Status,
      })

      const uniqueIdentity = goldfinchProtocol.getContract<UniqueIdentityContract>("UniqueIdentity")

      if (session.status !== "authenticated") {
        throw new Error("Not signed in. Please refresh the page and try again")
      }

      const client = new AuthenticatedGoldfinchClient(network.name!, session, setSessionData)
      const userAddress = userWalletWeb3Status.address
      assertNonNullable(userAddress)
      let version
      try {
        const response = await client.fetchKYCStatus(userAddress)
        if (response.ok) {
          version = getIDType({
            address: userAddress,
            kycStatus: response.json,
          })
        }
      } catch (err: unknown) {
        setErrored(true)
        console.error(err)
      }

      await sendFromUser(
        uniqueIdentity.userWallet.methods.mint(version, trustedSignature.expiresAt, trustedSignature.signature),
        {
          type: MINT_UID_TX_TYPE,
          data: {},
        },
        {value: UNIQUE_IDENTITY_MINT_PRICE}
      )
    } catch (err: unknown) {
      setErrored(true)
      console.error(err)
    }
  }

  const usNonAccreditedAdvisory = (
    <>
      <br />
      <br />
      Note: U.S individuals who have not verified as accredited investors are only eligible to participate in governance
      activities. They may not participate in the Senior or Borrower Pools.
    </>
  )

  if (user) {
    const uidTypeToBalance = user.info.value.uidTypeToBalance
    const hasAnyUID = Object.keys(uidTypeToBalance).some((uidType) => !!uidTypeToBalance[uidType])
    if (hasAnyUID) {
      return (
        <Banner icon={iconCircleCheck} className="verify-card subtle">
          <>
            Your UID has been created. View your UID on{" "}
            <a
              className="form-link"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://opensea.io/${user.address}/uid?search[sortBy]=LISTING_DATE`}
            >
              OpenSea
            </a>
            .
            {uidTypeToBalance[US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2] &&
            !uidTypeToBalance[US_ACCREDITED_INDIVIDUAL_ID_TYPE_1]
              ? usNonAccreditedAdvisory
              : undefined}
          </>
        </Banner>
      )
    }
  }

  if (errored) {
    return <ErrorCard title="Create your UID" />
  } else {
    return (
      <FormProvider {...formMethods}>
        <div className={`verify-card background-container subtle ${disabled && "placeholder"}`}>
          <h1 className="title">Create your UID</h1>
          <div className="info-banner subtle">
            <div className="message">
              <p className="font-small">
                Your UID is an NFT that represents your unique identity, and grants you access to important Goldfinch
                community privileges, including supplying capital and voting.
                {usNonAccreditedAdvisory}
              </p>
            </div>
            <LoadingButton disabled={disabled} action={action} text="Create UID" />
          </div>
        </div>
      </FormProvider>
    )
  }
}
