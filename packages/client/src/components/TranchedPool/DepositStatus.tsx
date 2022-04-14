import {BigNumber} from "bignumber.js"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {useSession} from "../../hooks/useSignIn"
import {Loadable} from "../../types/loadable"
import {InfoIcon} from "../../ui/icons"
import {displayDollars, displayPercent} from "../../utils"
import {TranchedPoolsEstimatedApyFromGfi} from "../Earn/types"
import {TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import APYTooltip from "../APYTooltip"

export function DepositStatus({
  tranchedPool,
  backer,
  tranchedPoolsEstimatedApyFromGfi,
}: {
  tranchedPool: TranchedPool | undefined
  backer: TranchedPoolBacker | undefined
  tranchedPoolsEstimatedApyFromGfi: Loadable<TranchedPoolsEstimatedApyFromGfi>
}) {
  const session = useSession()
  if (!tranchedPool || !tranchedPoolsEstimatedApyFromGfi.loaded) {
    return <></>
  }

  const leverageRatio = tranchedPool.estimatedLeverageRatio
  let estimatedUSDCApy = tranchedPool.estimateJuniorAPY(leverageRatio)
  const apysFromGfi = tranchedPoolsEstimatedApyFromGfi.value.estimatedApyFromGfi[tranchedPool.address]
  const estimatedBackersOnlyApy = apysFromGfi?.backersOnly
  const estimatedLpSeniorPoolMatchingApy = apysFromGfi?.seniorPoolMatching

  const estimatedApy =
    estimatedUSDCApy || estimatedBackersOnlyApy || estimatedLpSeniorPoolMatchingApy
      ? (estimatedUSDCApy || new BigNumber(0))
          .plus(estimatedBackersOnlyApy || new BigNumber(0))
          .plus(estimatedLpSeniorPoolMatchingApy || new BigNumber(0))
      : undefined

  const backerAvailableToWithdrawPercent = backer?.availableToWithdrawInDollars.dividedBy(backer.balanceInDollars)
  let rightStatusItem: React.ReactNode
  if (!backer || tranchedPool.creditLine.balance.isZero()) {
    // Not yet drawdown
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. APY</div>
        <div className="value">{displayPercent(estimatedUSDCApy)} USDC</div>
        <div className="deposit-status-sub-item-flex">
          <div className="sub-value">{`${displayPercent(estimatedApy)} with GFI`}</div>
          <span data-tip="" data-for="apy-tooltip" data-offset="{'top': 0, 'left': 80}" data-place="bottom">
            <InfoIcon className="icon" color={session.status === "authenticated" ? "#75c1eb" : "#b4ada7"} />
          </span>
        </div>
      </div>
    )
  } else {
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. Monthly Interest</div>
        {backer.balance.isZero() ? (
          <div className="value">{displayPercent(estimatedUSDCApy)}</div>
        ) : (
          <>
            <div className="value">
              {displayDollars(
                usdcFromAtomic(tranchedPool.estimateMonthlyInterest(estimatedUSDCApy, backer.principalAtRisk))
              )}
            </div>
            <div className="sub-value">{displayPercent(estimatedUSDCApy)} APY</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="deposit-status background-container-inner">
      <div className="deposit-status-item">
        <div className="label">Your balance</div>
        <div className="value">{displayDollars(backer?.balanceInDollars)}</div>
        <div className="sub-value">
          {displayDollars(backer?.availableToWithdrawInDollars)} ({displayPercent(backerAvailableToWithdrawPercent)})
          available
        </div>
      </div>
      {rightStatusItem}
      <APYTooltip
        classNames="apy-detail-tooltip clickable"
        longDescription="Includes the base USDC interest yield plus GFI from both liquidity mining and staking."
        rows={[
          {
            text: "Base interest USDC APY",
            value: displayPercent(estimatedUSDCApy),
          },
          {
            text: "Backer liquidity mining GFI APY*",
            value: estimatedBackersOnlyApy
              ? `~${displayPercent(estimatedBackersOnlyApy)}`
              : displayPercent(estimatedBackersOnlyApy),
          },
          {
            text: "LP rewards match GFI APY*",
            subtext: "(expected to launch in March)",
            value: estimatedLpSeniorPoolMatchingApy
              ? `~${displayPercent(estimatedLpSeniorPoolMatchingApy)}`
              : displayPercent(estimatedLpSeniorPoolMatchingApy),
          },
        ]}
        total={{
          text: "Total Est. APY",
          value:
            estimatedApy && (estimatedBackersOnlyApy || estimatedLpSeniorPoolMatchingApy)
              ? `~${displayPercent(estimatedApy)}`
              : displayPercent(estimatedApy),
        }}
        footer={
          <>
            <p>
              *Learn more in the proposals for{" "}
              <a
                href="https://snapshot.org/#/goldfinch.eth/proposal/0xb716c18c38eb1828044aca84a1466ac08221a37a96ce73b04e9caa847e13e0da"
                target="_blank"
                rel="noreferrer"
              >
                Backer liquidity mining
              </a>{" "}
              and{" "}
              <a
                href="https://snapshot.org/#/goldfinch.eth/proposal/0x10a390307e3834af5153dc58af0e20cbb0e08d38543be884b622b55bfcd5818d"
                target="_blank"
                rel="noreferrer"
              >
                staking distributions
              </a>
              .
            </p>
          </>
        }
      />
    </div>
  )
}
