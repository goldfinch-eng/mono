import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {UserLoaded} from "../../ethereum/user"
import DefaultGoldfinchClient, {KYC} from "../../hooks/useGoldfinchClient"
import {Session, useSignIn} from "../../hooks/useSignIn"
import {assertNonNullable} from "../../utils"
import {iconAlert, iconCircleCheck} from "../icons"
import EntityForm from "./EntityForm"
import VerificationNotice from "./VerificationNotice"
import NonUSForm from "./NonUSForm"
import USForm from "./USForm"
import VerifyCard from "./VerifyCard"
import {Action, CREATE_UID, US_COUNTRY_CODE} from "./constants"
import ErrorCard from "./ErrorCard"
import {isAccredited} from "@goldfinch-eng/autotasks/unique-identity-signer/isAccredited"

function isEligible(kyc: KYC | undefined, user: UserLoaded | undefined): boolean {
  return (kyc?.status === "approved" && kyc?.countryCode !== "") || (!!user && user.info.value.goListed)
}

function LoadingCard({title}: {title?: string}) {
  return (
    <VerifyCard disabled={true} title={title}>
      <p>Loading...</p>
    </VerifyCard>
  )
}

export default function VerifyAddress({disabled, dispatch}: {disabled: boolean; dispatch: React.Dispatch<Action>}) {
  const {user, userWalletWeb3Status, network, setSessionData} = useContext(AppContext)
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
      dispatch({type: CREATE_UID, kyc})
    }
  })

  async function fetchKYCStatus(session: Session) {
    if (session.status !== "authenticated") {
      return
    }
    // If the session status is "authenticated", we expect `userWalletWeb3Status?.address` to
    // be non-nullable, as that address should have been necessary in determining the
    // session status.
    const userAddress = userWalletWeb3Status?.address
    assertNonNullable(userAddress)
    assertNonNullable(network)
    assertNonNullable(setSessionData)
    setLoading(true)
    const client = new DefaultGoldfinchClient(network.name!, session, setSessionData)
    try {
      const response = await client.fetchKYCStatus(userAddress)
      if (response.ok) {
        setKYC(response.json)
        if (response.json.countryCode === US_COUNTRY_CODE) {
          setEntityType(US_COUNTRY_CODE)
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
  if (user) {
    console.log(user.address, isAccredited(user.address))
  }

  function renderForm() {
    if (user && user.info.value.goListed) {
      return <VerificationNotice icon={iconCircleCheck} notice={<>Your verification was approved.</>} />
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
    } else if (entityType === US_COUNTRY_CODE) {
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
    } else if (entityType === "entity" && user && !isAccredited(user.address)) {
      return <EntityForm onClose={() => setEntityType("")} />
    } else if (isEligible(kyc, user)) {
      return <VerificationNotice icon={iconCircleCheck} notice={<>Your verification was approved.</>} />
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
      return (
        <VerifyCard title="Verify your address" disabled={disabled}>
          <div className="form-message">Who is verifying this address?</div>
          <div className="verify-types">
            <button className={"button"} onClick={() => chooseEntity("non-US")}>
              Non-U.S. Individual
            </button>
            <button className={"button"} onClick={() => chooseEntity(US_COUNTRY_CODE)}>
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
