import {useContext, useEffect, useState} from "react"
import {useForm} from "react-hook-form"
import {AppContext} from "../../App"
import AuthenticatedGoldfinchClient, {KYC} from "../../hooks/useGoldfinchClient"
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
import {UIDTypeToBalance, User} from "../../ethereum/user"

export const NON_US_INDIVIDUAL_ENTITY_TYPE = "Non-US-Individual"
export const US_ACCREDITED_INDIVIDUAL_ENTITY_TYPE = "US-Accredited-Individual"
export const US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE = "US-Non-Accredited-Individual"
export const ENTITY_ENTITY_TYPE = "Entity"

// Checks if kys status is approved, or on a eligible entity/accredited list
function isEligible(kyc: KYC | undefined, user: User): boolean {
  return (
    (kyc?.status === "approved" && kyc?.countryCode !== "") ||
    isNonUSEntity(user?.address) ||
    isUSAccreditedEntity(user?.address) ||
    isUSAccreditedIndividual(user?.address)
  )
}

function LoadingCard({title}: {title?: string}) {
  return (
    <VerifyCard disabled={true} title={title}>
      <p>Loading...</p>
    </VerifyCard>
  )
}

type STATE_ENTITY_TYPE =
  | ""
  | typeof US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE
  | typeof NON_US_INDIVIDUAL_ENTITY_TYPE
  | typeof US_ACCREDITED_INDIVIDUAL_ENTITY_TYPE
  | typeof ENTITY_ENTITY_TYPE

export default function VerifyAddress({disabled, dispatch}: {disabled: boolean; dispatch: React.Dispatch<Action>}) {
  const {user, userWalletWeb3Status, network, setSessionData} = useContext(AppContext)
  const [kyc, setKYC] = useState<KYC>()
  const [entityType, setEntityType] = useState<STATE_ENTITY_TYPE>("")
  const [session] = useSignIn()
  const [loading, setLoading] = useState<boolean>(false)
  const [errored, setErrored] = useState<boolean>(false)
  const {
    watch,
    register,
    formState: {isValid},
    handleSubmit,
  } = useForm({mode: "onChange"})
  const countrySelection = watch("countrySelection")
  const individualOrEntity = watch("individualOrEntity")
  const accreditedIndividual = watch("accreditedIndividual")
  const requiresAccreditedInput = countrySelection === "value-type-us" && individualOrEntity === "value-type-individual"

  const onSubmit = () => {
    if (countrySelection === "value-type-not-us" && individualOrEntity === "value-type-individual") {
      chooseEntity(NON_US_INDIVIDUAL_ENTITY_TYPE)
    } else if (
      countrySelection === "value-type-us" &&
      individualOrEntity === "value-type-individual" &&
      accreditedIndividual === "value-type-accredited"
    ) {
      chooseEntity(US_ACCREDITED_INDIVIDUAL_ENTITY_TYPE)
    } else if (
      countrySelection === "value-type-us" &&
      individualOrEntity === "value-type-individual" &&
      accreditedIndividual === "value-type-not-accredited"
    ) {
      chooseEntity(US_NON_ACCREDITED_INDIVIDUAL_ENTITY_TYPE)
    } else if (individualOrEntity === "value-type-entity") {
      chooseEntity(ENTITY_ENTITY_TYPE)
    }
  }

  useEffect(() => {
    if (errored || loading) {
      return
    }

    if (!kyc && session.status === "authenticated") {
      fetchKYCStatus(session)
    } else if (user && isEligible(kyc, user) && !disabled) {
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
    const client = new AuthenticatedGoldfinchClient(network.name!, session, setSessionData)
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
    return <LoadingCard />
  }

  const uidTypeToBalance: UIDTypeToBalance = user.info.value.uidTypeToBalance
  const hasAnyUID = Object.keys(uidTypeToBalance).some((uidType) => !!uidTypeToBalance[uidType])

  if (hasAnyUID) {
    return <Banner icon={iconCircleCheck}>Your verification was approved.</Banner>
  } else if (loading) {
    return <LoadingCard title="Verify your address" />
  } else if (errored) {
    return <ErrorCard title="Verify your address" />
  } else if (kyc?.status === "failed") {
    return (
      <Banner icon={iconAlert}>
        There was an issue verifying your address. For help, please contact{" "}
        <a className="link" target="_blank" rel="noopener noreferrer" href="mailto:verify@goldfinch.finance">
          verify@goldfinch.finance
        </a>{" "}
        and include your address.
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
  } else if (isEligible(kyc, user)) {
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <VerifyCard title="Tell us about yourself" disabled={disabled}>
          <label htmlFor="countrySelection" className="group-label">
            Where are you located?
          </label>
          <div className="value-option">
            <input
              {...register("countrySelection", {required: true})}
              name="countrySelection"
              type="radio"
              id="value-type-us"
              ref={(ref) => register(ref)}
              value="value-type-us"
            />
            <div className="radio-check"></div>
            <label htmlFor={"value-type-us"}>in the U.S.</label>
          </div>
          <div className="value-option">
            <input
              {...register("countrySelection", {required: true})}
              name="countrySelection"
              type="radio"
              id="value-type-not-us"
              value="value-type-not-us"
              ref={(ref) => register(ref)}
            />
            <div className="radio-check"></div>
            <label htmlFor={"value-type-not-us"}>outside of the U.S.</label>
          </div>
          <label htmlFor="individualOrEntity" className="group-label">
            Who are you participating on behalf of?
          </label>
          <div className="value-option">
            <input
              {...register("individualOrEntity", {required: true})}
              name="individualOrEntity"
              type="radio"
              id="value-type-individual"
              value="value-type-individual"
              ref={(ref) => register(ref)}
            />
            <div className="radio-check"></div>
            <label htmlFor={"value-type-individual"}>an individual (myself)</label>
          </div>
          <div className="value-option">
            <input
              {...register("individualOrEntity", {required: true})}
              name="individualOrEntity"
              type="radio"
              id="value-type-entity"
              value="value-type-entity"
              ref={(ref) => register(ref)}
            />
            <div className="radio-check"></div>
            <label htmlFor="value-type-entity">an entitiy</label>
          </div>
          {requiresAccreditedInput && (
            <>
              <label htmlFor="accreditedIndividual" className="group-label">
                Are you an accredited investor?
              </label>
              <div className="value-option">
                <input
                  name="accreditedIndividual"
                  type="radio"
                  id="value-type-accredited"
                  value="value-type-accredited"
                  {...register("accreditedIndividual", {required: true})}
                  ref={(ref) => register(ref)}
                />
                <div className="radio-check"></div>
                <label htmlFor={"value-type-accredited"}>Yes</label>
              </div>
              <div className="value-option">
                <input
                  name="accreditedIndividual"
                  type="radio"
                  id="value-type-not-accredited"
                  value="value-type-not-accredited"
                  {...register("accreditedIndividual", {required: true})}
                  ref={(ref) => register(ref)}
                />
                <div className="radio-check"></div>
                <label htmlFor={"value-type-not-accredited"}>No</label>
              </div>
            </>
          )}

          <button type="submit" className="button" disabled={!isValid}>
            Next step
          </button>
        </VerifyCard>
      </form>
    )
  }
}
