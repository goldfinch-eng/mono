import {useContext, useEffect, useState} from "react"
import {useParams} from "react-router-dom"
import {AppContext} from "../../App"
import {useEarn} from "../../contexts/EarnContext"
import {BackerRewardsLoaded} from "../../ethereum/backerRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {SeniorPoolLoaded} from "../../ethereum/pool"
import {TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {KnownGoldfinchClient} from "../../hooks/useGoldfinchClient"
import {useFetchNDA} from "../../hooks/useNDA"
import {useBacker, useTranchedPool} from "../../hooks/useTranchedPool"
import {Loadable, Loaded} from "../../types/loadable"
import {assertNonNullable, croppedAddress, sameBlock} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import {TranchedPoolsEstimatedApyFromGfi} from "../Earn/types"
import InvestorNotice from "../KYCNotice/InvestorNotice"
import NdaPrompt from "../ndaPrompt"
import {ActionsContainer} from "./ActionsContainer"
import {CreditStatus} from "./CreditStatus"
import {Overview} from "./Overview"
import {PoolOverview} from "./PoolOverview"
import {SupplyStatus} from "./SupplyStatus"
import {V1DealSupplyStatus} from "./V1DealSupplyStatus"
import {BorrowerOverview} from "./BorrowerOverview"
import {KnownSession, useSignIn} from "../../hooks/useSignIn"

interface TranchedPoolViewURLParams {
  poolAddress: string
}

function TranchedPoolView() {
  const {poolAddress} = useParams<TranchedPoolViewURLParams>()
  const [session] = useSignIn()
  const {goldfinchProtocol, backerRewards, pool, gfi, user, network, setSessionData, currentBlock} =
    useContext(AppContext)
  const {
    earnStore: {backers},
  } = useEarn()
  const [tranchedPool, refreshTranchedPool] = useTranchedPool({address: poolAddress, goldfinchProtocol, currentBlock})
  const [showModal, setShowModal] = useState(false)
  const backer = useBacker({user, tranchedPool})
  const [nda, refreshNDA] = useFetchNDA({user, tranchedPool})
  const hasSignedNDA = nda && nda?.status === "success"
  const [tranchedPoolsEstimatedApyFromGfi, setTranchedPoolsEstimatedApyFromGfi] = useState<
    Loadable<TranchedPoolsEstimatedApyFromGfi>
  >({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    if (backers.loaded && pool && gfi && backerRewards) {
      refreshTranchedPoolsEstimatedApyFromGfi(backers, pool, gfi, backerRewards)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backers, pool, gfi, backerRewards])

  async function refreshTranchedPoolsEstimatedApyFromGfi(
    backers: Loaded<TranchedPoolBacker[]>,
    pool: SeniorPoolLoaded,
    gfi: GFILoaded,
    backerRewards: BackerRewardsLoaded
  ) {
    if (
      sameBlock(pool.info.value.currentBlock, gfi.info.value.currentBlock) &&
      sameBlock(gfi.info.value.currentBlock, backerRewards.info.value.currentBlock)
    ) {
      const estimatedApyFromGfi = await backerRewards.estimateApyFromGfiByTranchedPool(
        backers.value.map((backer) => backer.tranchedPool),
        pool,
        gfi
      )
      setTranchedPoolsEstimatedApyFromGfi({
        loaded: true,
        value: {
          currentBlock: gfi.info.value.currentBlock,
          estimatedApyFromGfi,
        },
      })
    }
  }

  function openDetailsUrl() {
    window.open(tranchedPool?.metadata?.detailsUrl, "_blank")
  }

  const handleDetails = () => {
    if (!tranchedPool?.metadata?.NDAUrl || hasSignedNDA) {
      openDetailsUrl()
    } else {
      setShowModal(true)
    }
  }

  async function handleSignNDA() {
    assertNonNullable(user)
    assertNonNullable(network)
    assertNonNullable(setSessionData)

    if (session.status !== "known" && session.status !== "authenticated") {
      throw new Error("Not signed in. Please refresh the page and try again")
    }
    const client = new KnownGoldfinchClient(network.name!, session as KnownSession, setSessionData)
    return client
      .signNDA(user.address, tranchedPool!.address)
      .then((r) => {
        openDetailsUrl()
        setShowModal(false)
        refreshNDA()
      })
      .catch((error) => {
        setShowModal(false)
        console.error(error)
      })
  }

  const earnMessage = tranchedPool
    ? `Pools / ${tranchedPool.metadata?.name ?? croppedAddress(tranchedPool.address)}`
    : "Loading..."

  const isAtMaxCapacity = tranchedPool?.remainingCapacity().isZero()
  const maxCapacityNotice = isAtMaxCapacity ? (
    <div className="info-banner background-container">
      <div className="message">
        <span>
          This borrower pool has reached its capital limit and is closed to additional capital.{" "}
          <a href="http://eepurl.com/hJmQsP" target="_blank" rel="noreferrer">
            Sign up here
          </a>{" "}
          to be notified of future pools.
        </span>
      </div>
    </div>
  ) : (
    <></>
  )

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice requireUnlock={false} requireGolist={true} isPaused={!!tranchedPool?.isPaused} />
      {maxCapacityNotice}
      <InvestorNotice user={user} allowedUIDTypes={tranchedPool?.allowedUIDTypes || []} />
      <ActionsContainer
        tranchedPool={tranchedPool}
        backer={backer}
        onComplete={async () => refreshTranchedPool()}
        tranchedPoolsEstimatedApyFromGfi={tranchedPoolsEstimatedApyFromGfi}
      />
      <CreditStatus tranchedPool={tranchedPool} />
      {tranchedPool?.isV1StyleDeal ? (
        <V1DealSupplyStatus tranchedPool={tranchedPool} />
      ) : (
        <SupplyStatus tranchedPool={tranchedPool} />
      )}
      {tranchedPool?.metadata?.description && tranchedPool?.metadata?.description !== "" && (
        <Overview tranchedPool={tranchedPool} handleDetails={handleDetails} />
      )}
      {tranchedPool?.metadata?.poolDescription && (
        <PoolOverview tranchedPool={tranchedPool} handleDetails={handleDetails} />
      )}
      {tranchedPool?.metadata?.borrowerDescription && <BorrowerOverview tranchedPool={tranchedPool} />}
      <NdaPrompt
        show={showModal}
        onClose={() => setShowModal(false)}
        onSign={handleSignNDA}
        NDAUrl={tranchedPool?.metadata?.NDAUrl}
      />
    </div>
  )
}
export default TranchedPoolView
