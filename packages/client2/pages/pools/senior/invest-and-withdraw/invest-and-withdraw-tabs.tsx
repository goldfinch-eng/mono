import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState } from "react";

import { Button, Icon, InfoIconTooltip } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  InvestAndWithdrawSeniorPoolFieldsFragment,
  SeniorPoolWithdrawalPanelPositionFieldsFragment,
  SeniorPoolWithdrawalPanelWithdrawalRequestFieldsFragment,
  UserEligibilityFieldsFragment,
} from "@/lib/graphql/generated";
import { canUserParticipateInSeniorPool, sharesToUsdc } from "@/lib/pools";
import { openVerificationModal, openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import {
  SeniorPoolSupplyPanel,
  SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS,
} from "./senior-pool-supply-panel";
import {
  SeniorPoolWithdrawalPanel,
  SENIOR_POOL_WITHDRAWAL_PANEL_FIELDS,
} from "./senior-pool-withdrawal-panel";

export {
  SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS,
  SENIOR_POOL_WITHDRAWAL_PANEL_WITHDRAWAL_REQUEST_FIELDS,
} from "./senior-pool-withdrawal-panel";

export const INVEST_AND_WITHDRAW_SENIOR_POOL_FIELDS = gql`
  ${SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS}
  ${SENIOR_POOL_WITHDRAWAL_PANEL_FIELDS}
  fragment InvestAndWithdrawSeniorPoolFields on SeniorPool {
    sharePrice
    ...SeniorPoolSupplyPanelPoolFields
    ...SeniorPoolWithdrawalPanelFields
  }
`;

interface InvestAndWithdrawTabsProps {
  seniorPool: InvestAndWithdrawSeniorPoolFieldsFragment;
  fiatPerGfi: number;
  user?: UserEligibilityFieldsFragment | null;
  fiduBalance: CryptoAmount<"FIDU">;
  stakedPositions: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  vaultedStakedPositions: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  existingWithdrawalRequest?: SeniorPoolWithdrawalPanelWithdrawalRequestFieldsFragment;
}

export function InvestAndWithdrawTabs({
  seniorPool,
  fiatPerGfi,
  user,
  fiduBalance,
  stakedPositions,
  vaultedStakedPositions,
  existingWithdrawalRequest,
}: InvestAndWithdrawTabsProps) {
  const [shownPanel, setShownPanel] = useState<"invest" | "withdraw" | null>(
    null
  );
  const { account } = useWallet();
  const isUserVerified =
    user?.isGoListed ||
    user?.isUsEntity ||
    user?.isNonUsEntity ||
    user?.isUsAccreditedIndividual ||
    user?.isUsNonAccreditedIndividual ||
    user?.isNonUsIndividual;
  const canUserParticipate = !user
    ? false
    : canUserParticipateInSeniorPool(user);

  const totalUserFidu = sumTotalShares(
    fiduBalance,
    {
      amount:
        existingWithdrawalRequest?.previewFiduRequested ?? BigNumber.from(0),
      token: "FIDU",
    },
    stakedPositions.concat(vaultedStakedPositions)
  );
  const totalSharesUsdc = sharesToUsdc(
    totalUserFidu,
    seniorPool.sharePrice
  ).amount;

  return (
    <div>
      {!totalSharesUsdc.isZero() ? (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-1 text-sm">
            <div>Your current position</div>
            <InfoIconTooltip content="The USD value of your current position in the Senior Pool." />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="font-serif text-3xl font-semibold text-sand-800">
              {formatCrypto({
                token: "USDC",
                amount: totalSharesUsdc,
              })}
            </div>
            <div className="mb-1.5 text-sm">
              {formatCrypto(
                {
                  token: "FIDU",
                  amount: totalUserFidu,
                },
                { includeToken: true }
              )}
            </div>
          </div>
        </div>
      ) : null}
      {shownPanel === null ? (
        <div className="flex flex-col items-stretch gap-3">
          {!account ? (
            <Button size="xl" colorScheme="mustard" onClick={openWalletModal}>
              Connect wallet
            </Button>
          ) : !isUserVerified ? (
            <Button
              size="xl"
              colorScheme="mustard"
              onClick={openVerificationModal}
            >
              Verify my identity
            </Button>
          ) : (
            <>
              <Button
                size="xl"
                colorScheme="mustard"
                disabled={!canUserParticipate}
                onClick={() => setShownPanel("invest")}
              >
                Invest
              </Button>
              <Button
                size="xl"
                colorScheme="transparent-mustard"
                disabled={!canUserParticipate}
                onClick={() => setShownPanel("withdraw")}
              >
                Withdraw
              </Button>
              {!canUserParticipate ? (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Icon size="md" name="Exclamation" />
                  <div>
                    Sorry, you are not eligible to participate in the senior
                    pool because you do not have a suitable UID.
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div>
          <button
            className="mb-6 flex items-center gap-2 text-2xl"
            onClick={() => setShownPanel(null)}
          >
            <Icon name="ArrowLeft" />
            {shownPanel === "invest" ? "Invest" : "Withdraw"}
          </button>
          {shownPanel === "invest" ? (
            <SeniorPoolSupplyPanel
              seniorPool={seniorPool}
              fiatPerGfi={fiatPerGfi}
            />
          ) : (
            <SeniorPoolWithdrawalPanel
              seniorPool={seniorPool}
              fiduBalance={fiduBalance}
              stakedPositions={stakedPositions}
              vaultedStakedPositions={vaultedStakedPositions}
              existingWithdrawalRequest={existingWithdrawalRequest}
            />
          )}
        </div>
      )}
    </div>
  );
}

function sumStakedShares(
  staked: SeniorPoolWithdrawalPanelPositionFieldsFragment[]
): BigNumber {
  const totalStaked = staked.reduce(
    (previous, current) => previous.add(current.amount),
    BigNumber.from(0)
  );

  return totalStaked;
}

function sumTotalShares(
  unstaked: CryptoAmount,
  requested: CryptoAmount,
  staked: SeniorPoolWithdrawalPanelPositionFieldsFragment[]
): BigNumber {
  if (unstaked.token !== "FIDU") {
    throw new Error("Unstaked is not a CryptoAmount in FIDU");
  }
  const totalStaked = sumStakedShares(staked);

  return unstaked.amount.add(totalStaked).add(requested.amount);
}
