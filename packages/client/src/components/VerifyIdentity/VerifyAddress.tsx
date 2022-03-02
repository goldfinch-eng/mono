import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {UserLoaded} from "../../ethereum/user"
import DefaultGoldfinchClient, {KYC} from "../../hooks/useGoldfinchClient"
import {Session, useSignIn} from "../../hooks/useSignIn"
import {assertNonNullable} from "../../utils"
import {iconAlert, iconCircleCheck} from "../icons"
import EntityForm from "./EntityForm"
import NonUSForm from "./NonUSForm"
import USForm from "./USForm"
import VerifyCard from "./VerifyCard"
import {Action, CREATE_UID, US_COUNTRY_CODE} from "./constants"
import ErrorCard from "./ErrorCard"
import {
  isNonUSEntity,
  isUSAccreditedEntity,
  isUSAccreditedIndividual,
} from "@goldfinch-eng/autotasks/unique-identity-signer/utils"
import USAccreditedForm from "./USAccreditedForm"
import Banner from "../banner"

export const NON_US_INDIVIDUAL_ENTITY_TYPE = "Non-US-Individual"
export const US_ACCREDITED_INDIVIDUAL_ENTITY_TYPE = "US-Accredited-Individual"
export const US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE = "US-Non-Accredited-Individual"
export const ENTITY_ENTITY_TYPE = "Entity"

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
    } else if (
      (isEligible(kyc, user) ||
        isNonUSEntity(user?.address) ||
        isUSAccreditedEntity(user?.address) ||
        isUSAccreditedIndividual(user?.address)) &&
      !disabled
    ) {
      dispatch({type: CREATE_UID})
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
          setEntityType(US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE)
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

  if (!user) {
    return <></>
  }

  if (user.info.value.goListed) {
    return <Banner icon={iconCircleCheck}>Your verification was approved.</Banner>
  } else if (loading) {
    return <LoadingCard title="Verify your address" />
  } else if (errored) {
    return <ErrorCard title="Verify your address" />
  } else if (kyc?.status === "failed") {
    return (
      <Banner icon={iconAlert}>
        There was an issue verifying your address. For help, please contact verify@goldfinch.finance and include your
        address.
      </Banner>
    )
  } else if (entityType === US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE) {
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
  } else if (entityType === US_ACCREDITED_INDIVIDUAL_ENTITY_TYPE && !isUSAccreditedIndividual(user.address)) {
    return <USAccreditedForm onClose={() => setEntityType("")} />
  } else if (entityType === ENTITY_ENTITY_TYPE && !isUSAccreditedEntity(user.address) && !isNonUSEntity(user.address)) {
    return <EntityForm onClose={() => setEntityType("")} />
  } else if (
    isEligible(kyc, user) ||
    isUSAccreditedEntity(user.address) ||
    isUSAccreditedIndividual(user.address) ||
    isNonUSEntity(user.address)
  ) {
    return <Banner icon={iconCircleCheck}>Your verification was approved.</Banner>
  } else if (entityType === NON_US_INDIVIDUAL_ENTITY_TYPE) {
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
          <button className={"button"} onClick={() => chooseEntity(NON_US_INDIVIDUAL_ENTITY_TYPE)}>
            Non-U.S. Individual
          </button>
          <button className={"button"} onClick={() => chooseEntity(ENTITY_ENTITY_TYPE)}>
            Entity
          </button>
          <button className={"button"} onClick={() => chooseEntity(US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE)}>
            U.S. Non-Accredited Individual
          </button>
          <button className={"button"} onClick={() => chooseEntity(US_ACCREDITED_INDIVIDUAL_ENTITY_TYPE)}>
            U.S. Accredited Individual
          </button>
        </div>
      </VerifyCard>
    )
  }
}
