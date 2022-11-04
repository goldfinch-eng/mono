import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useState } from "react";

import { Button, Icon, InfoIconTooltip } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  SeniorPoolWithdrawalPanelPositionFieldsFragment,
  SupportedCrypto,
  EpochInfo,
  WithdrawalStatus,
} from "@/lib/graphql/generated";
import { sharesToUsdc } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import WithdrawCancelRequestModal from "./withdraw-cancel-request-modal";
import WithdrawRequestHistoryModal from "./withdraw-request-history-modal";
import WithdrawRequestModal from "./withdraw-request-modal";

export const SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS = gql`
  fragment SeniorPoolWithdrawalPanelPositionFields on SeniorPoolStakedPosition {
    id
    amount
  }
`;

interface SeniorPoolWithdrawalPanelProps {
  withdrawalStatus?: WithdrawalStatus | null;
  fiduBalance?: CryptoAmount;
  stakedPositions?: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  seniorPoolSharePrice: BigNumber;
  seniorPoolLiquidity: BigNumber;
  currentEpoch?: EpochInfo | null;
}

export function SeniorPoolWithDrawalPanel({
  fiduBalance = { token: SupportedCrypto.Fidu, amount: BigNumber.from(0) },
  seniorPoolSharePrice,
  stakedPositions = [],
  withdrawalStatus,
  currentEpoch,
}: SeniorPoolWithdrawalPanelProps) {
  const { provider } = useWallet();
  const [withdrawModalOpen, setWithrawModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const totalUserFidu = sumTotalShares(fiduBalance, stakedPositions);
  const totalUserStakedFidu = sumStakedShares(stakedPositions);
  const totalSharesUsdc = sharesToUsdc(
    totalUserFidu,
    seniorPoolSharePrice
  ).amount;
  const currentRequestUsdc = sharesToUsdc(
    withdrawalStatus?.fiduRequested?.amount ?? BigNumber.from("0"),
    seniorPoolSharePrice
  ).amount;

  const apolloClient = useApolloClient();

  const withdrawWithToken = async () => {
    if (withdrawalStatus?.withdrawalToken && provider) {
      setIsWithdrawing(true);

      const seniorPoolContract = await getContract({
        name: "SeniorPool",
        provider,
      });

      try {
        await seniorPoolContract.claimWithdrawalRequest(
          withdrawalStatus?.withdrawalToken
        );
        await apolloClient.refetchQueries({ include: "active" });

        setIsWithdrawing(false);
      } catch (e) {
        setIsWithdrawing(false);
      }
    }
  };

  return (
    <>
      <div className="bg-midnight-01 rounded-xl p-5 text-white">
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-1 text-sm">
            <div>Your current position value</div>
            <InfoIconTooltip content="The total value of your investment position in the Senior Pool, including funds available to withdraw and funds currently deployed in outstanding Borrower Pools across the protocol." />
          </div>
          <div className="mb-3 flex items-center gap-3 text-5xl font-medium">
            {formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: totalSharesUsdc,
            })}
          </div>
          <div>
            {formatCrypto(
              {
                token: SupportedCrypto.Fidu,
                amount: totalUserFidu,
              },
              { includeToken: true }
            )}
          </div>
        </div>
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <div>Available to withdraw</div>
            <InfoIconTooltip content="Your USDC funds that are currently available to be withdrawn from the Senior Pool. It is possible that when a Liquidity Provider wants to withdraw, the Senior Pool may not have sufficient USDC because it is currently deployed in outstanding Borrower Pools across the protocol. In this event, the amount available to withdraw will reflect what can currently be withdrawn, and you may return to withdraw more of your position when new capital enters the Senior Pool through Borrower repayments or new Liquidity Provider investments." />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-medium">
              {withdrawalStatus?.usdcWithdrawable
                ? formatCrypto(withdrawalStatus?.usdcWithdrawable)
                : null}
            </div>
            <Icon name="Usdc" size="sm" />
          </div>
        </div>
        <Button
          colorScheme="secondary"
          size="xl"
          className="mb-2 block w-full"
          type="submit"
          onClick={withdrawWithToken}
          isLoading={isWithdrawing}
          disabled={
            withdrawalStatus?.usdcWithdrawable?.amount.lte(
              BigNumber.from("0")
            ) || isWithdrawing
          }
        >
          Withdraw USDC
        </Button>

        {withdrawalStatus?.withdrawalToken ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <div>Withdrawal request</div>
              <InfoIconTooltip content="" />
            </div>
            <div className="mb-3 flex items-end justify-between gap-2">
              <div className="text-3xl font-medium">
                {withdrawalStatus?.fiduRequested
                  ? formatCrypto(withdrawalStatus?.fiduRequested, {
                      includeToken: true,
                    })
                  : null}
              </div>
              <div className="text-sm">
                {formatCrypto(
                  {
                    token: SupportedCrypto.Usdc,
                    amount: currentRequestUsdc,
                  },
                  { includeSymbol: true }
                )}
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <div>Next distribution</div>
              <InfoIconTooltip content="" />
            </div>
            <div className="mb-5 flex items-end justify-between gap-1">
              <div className="text-2xl">
                {currentEpoch
                  ? format(
                      currentEpoch.endTime.mul(1000).toNumber(),
                      "MMM d, y"
                    )
                  : null}
              </div>
              <div className="text-sm">
                <Button
                  onClick={() => {
                    setHistoryModalOpen(true);
                  }}
                  className="!bg-transparent !p-0 underline hover:!bg-transparent"
                >
                  View request history
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Button
                  colorScheme="twilight"
                  size="xl"
                  className="block w-full"
                  onClick={() => {
                    setWithrawModalOpen(true);
                  }}
                >
                  Increase
                </Button>
              </div>
              <div className="flex-1">
                <Button
                  onClick={() => {
                    setCancelModalOpen(true);
                  }}
                  colorScheme="twilight"
                  size="xl"
                  className="block w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Button
              onClick={() => {
                setWithrawModalOpen(true);
              }}
              className="mx-auto !bg-transparent pb-1 underline hover:!bg-transparent"
            >
              Request withdrawal
            </Button>
          </div>
        )}
      </div>

      <WithdrawRequestHistoryModal
        currentEpoch={currentEpoch}
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
        }}
      />

      <WithdrawCancelRequestModal
        withdrawalToken={withdrawalStatus?.withdrawalToken}
        currentRequest={withdrawalStatus?.fiduRequested?.amount}
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
        }}
        onComplete={async () => {
          setCancelModalOpen(false);

          await apolloClient.refetchQueries({ include: "active" });
        }}
      />

      <WithdrawRequestModal
        currentRequest={withdrawalStatus?.fiduRequested?.amount}
        currentEpoch={currentEpoch}
        sharePrice={seniorPoolSharePrice}
        withdrawalToken={withdrawalStatus?.withdrawalToken}
        balanceWallet={fiduBalance}
        balanceStaked={{
          amount: totalUserStakedFidu,
          token: SupportedCrypto.Fidu,
        }}
        balanceVaulted={{
          amount: BigNumber.from(0),
          token: SupportedCrypto.Fidu,
        }}
        isOpen={withdrawModalOpen}
        onClose={() => {
          setWithrawModalOpen(false);
        }}
        onComplete={async () => {
          setWithrawModalOpen(false);

          await apolloClient.refetchQueries({ include: "active" });
        }}
      />
    </>
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
  staked: SeniorPoolWithdrawalPanelPositionFieldsFragment[]
): BigNumber {
  if (unstaked.token !== SupportedCrypto.Fidu) {
    throw new Error("Unstaked is not a CryptoAmount in FIDU");
  }
  const totalStaked = staked.reduce(
    (previous, current) => previous.add(current.amount),
    BigNumber.from(0)
  );
  return unstaked.amount.add(totalStaked);
}
