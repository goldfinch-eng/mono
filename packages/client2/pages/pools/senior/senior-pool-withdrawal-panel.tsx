import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";
import { useState } from "react";

import { Button, Icon, InfoIconTooltip } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  SeniorPoolWithdrawalPanelPositionFieldsFragment,
  SupportedCrypto,
  WithdrawalEpochInfo,
  WithdrawalRequestModalWithdrawalFieldsFragment,
  WithdrawalStatus,
} from "@/lib/graphql/generated";
import { sharesToUsdc, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

import WithdrawalCancelRequestModal from "./withdraw-cancel-request-modal";
import WithdrawalRequestHistoryModal from "./withdraw-request-history-modal";
import WithdrawalRequestModal from "./withdraw-request-modal";
import { WithdrawalCancelModal as WithdrawalCancelModal2 } from "./withdrawal-cancel-modal2";
import { WithdrawalRequestModal as WithdrawalRequestModal2 } from "./withdrawal-request-modal2";

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
  vaultedStakedPositions?: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  seniorPoolSharePrice: BigNumber;
  seniorPoolLiquidity: BigNumber;
  currentEpoch: WithdrawalEpochInfo;
  cancellationFee: FixedNumber;
  existingWithdrawalRequest?: WithdrawalRequestModalWithdrawalFieldsFragment;
}

export function SeniorPoolWithdrawalPanel({
  fiduBalance = { token: SupportedCrypto.Fidu, amount: BigNumber.from(0) },
  seniorPoolSharePrice,
  stakedPositions = [],
  withdrawalStatus,
  currentEpoch,
  cancellationFee,
  vaultedStakedPositions = [],
  existingWithdrawalRequest,
}: SeniorPoolWithdrawalPanelProps) {
  const { provider } = useWallet();

  const [isWithdrawalModal2Open, setIsWithdrawalModal2Open] = useState(false);
  const [isCancelModal2Open, setIsCancelModal2Open] = useState(false);

  const [withdrawalModalOpen, setWithrawalModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const totalUserFidu = sumTotalShares(
    fiduBalance,
    withdrawalStatus?.fiduRequested ?? {
      amount: BigNumber.from("0"),
      token: SupportedCrypto.Fidu,
    },
    stakedPositions.concat(vaultedStakedPositions)
  );
  const totalUserStakedFidu = sumStakedShares(stakedPositions);
  const totalUserVaultedFidu = sumStakedShares(vaultedStakedPositions);
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
    if (!withdrawalStatus?.withdrawalToken || !provider) return;

    setIsWithdrawing(true);

    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });

    try {
      const transaction = seniorPoolContract.claimWithdrawalRequest(
        withdrawalStatus?.withdrawalToken
      );

      await toastTransaction({ transaction });

      await apolloClient.refetchQueries({ include: "active" });

      setIsWithdrawing(false);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <>
      <div className="rounded-xl bg-midnight-01 p-5 text-white">
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-1 text-sm">
            <div>Your current position</div>
            <InfoIconTooltip
              className="!text-white/60"
              content="The USD value of your current position in the Senior Pool."
            />
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
            <div>Ready to withdraw</div>
            <InfoIconTooltip
              className="!text-white/60"
              content="FIDU that has been distributed from a Withdrawal Request, and is now ready to withdraw to your wallet."
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-medium">
              {formatCrypto(
                withdrawalStatus?.usdcWithdrawable ?? {
                  amount: BigNumber.from(0),
                  token: SupportedCrypto.Usdc,
                }
              )}
            </div>
            <Icon name="Usdc" size="sm" />
          </div>
        </div>

        {withdrawalStatus?.withdrawalToken ? (
          <Button
            colorScheme="secondary"
            size="xl"
            className="mb-2 block w-full"
            type="submit"
            onClick={withdrawWithToken}
            isLoading={isWithdrawing}
            disabled={
              !withdrawalStatus ||
              withdrawalStatus?.usdcWithdrawable?.amount.lte(
                BigNumber.from("0")
              ) ||
              isWithdrawing
            }
          >
            Withdraw USDC
          </Button>
        ) : (
          <Button
            colorScheme="secondary"
            size="xl"
            onClick={() => setIsWithdrawalModal2Open(true)}
            className="mb-2 block w-full"
          >
            Request withdrawal
          </Button>
        )}

        {withdrawalStatus?.withdrawalToken ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <div>Withdrawal request</div>
              <InfoIconTooltip
                className="!text-white/60"
                content="FIDU you have submitted a request to withdraw that is pending distribution. You can cancel your request to withdraw FIDU, or withdraw more FIDU by increasing your request."
              />
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
              <InfoIconTooltip
                className="!text-white/60"
                content="The next date that the FIDU submitted in withdrawal requests will be distributed to requestors. Distributions happen every two weeks, and requests automatically roll-over to the next period until they are fully fulfilled."
              />
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
                  onClick={() => setIsWithdrawalModal2Open(true)}
                >
                  Increase
                </Button>
              </div>
              <div className="flex-1">
                <Button
                  onClick={() => setIsCancelModal2Open(true)}
                  colorScheme="twilight"
                  size="xl"
                  className="block w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <WithdrawalRequestHistoryModal
        currentEpoch={currentEpoch}
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
        }}
      />

      <WithdrawalCancelRequestModal
        cancellationFee={cancellationFee ?? FixedNumber.from("0.1")}
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

      <WithdrawalRequestModal
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
          amount: totalUserVaultedFidu,
          token: SupportedCrypto.Fidu,
        }}
        cancellationFee={cancellationFee}
        isOpen={withdrawalModalOpen}
        onClose={() => {
          setWithrawalModalOpen(false);
        }}
        onComplete={async () => {
          setWithrawalModalOpen(false);

          await apolloClient.refetchQueries({ include: "active" });
        }}
      />

      <WithdrawalRequestModal2
        isOpen={isWithdrawalModal2Open}
        onClose={() => setIsWithdrawalModal2Open(false)}
        sharePrice={seniorPoolSharePrice}
        existingWithdrawalRequest={existingWithdrawalRequest}
        walletFidu={fiduBalance}
        stakedFidu={{
          token: SupportedCrypto.Fidu,
          amount: sum("amount", stakedPositions),
        }}
        vaultedFidu={{
          token: SupportedCrypto.Fidu,
          amount: sum("amount", vaultedStakedPositions),
        }}
        cancellationFee={cancellationFee}
        nextDistributionTimestamp={currentEpoch.endTime.toNumber()}
      />
      {existingWithdrawalRequest ? (
        <WithdrawalCancelModal2
          isOpen={isCancelModal2Open}
          onClose={() => setIsCancelModal2Open(false)}
          cancellationFee={cancellationFee}
          existingWithdrawalRequest={existingWithdrawalRequest}
        />
      ) : null}
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
  requested: CryptoAmount,
  staked: SeniorPoolWithdrawalPanelPositionFieldsFragment[]
): BigNumber {
  if (unstaked.token !== SupportedCrypto.Fidu) {
    throw new Error("Unstaked is not a CryptoAmount in FIDU");
  }
  const totalStaked = sumStakedShares(staked);

  return unstaked.amount.add(totalStaked).add(requested.amount);
}
