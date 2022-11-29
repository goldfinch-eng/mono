import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Form,
  Icon,
  InfoIconTooltip,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  SeniorPoolWithdrawalPanelPositionFieldsFragment,
  SeniorPoolWithdrawalPanelWithdrawalRequestFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { sharesToUsdc, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

import {
  WithdrawalCancelModal as WithdrawalCancelModal2,
  WITHDRAWAL_CANCEL_MODAL_WITHDRAWAL_FIELDS,
} from "./withdrawal-cancel-modal2";
import { WithdrawalHistoryModal as WithdrawalHistoryModal2 } from "./withdrawal-history-modal2";
import {
  WithdrawalRequestModal as WithdrawalRequestModal2,
  WITHDRAWAL_REQUEST_MODAL_WITHDRAWAL_FIELDS,
} from "./withdrawal-request-modal2";

export const SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS = gql`
  fragment SeniorPoolWithdrawalPanelPositionFields on SeniorPoolStakedPosition {
    id
    amount
  }
`;

export const SENIOR_POOL_WITHDRAWAL_PANEL_WITHDRAWAL_REQUEST_FIELDS = gql`
  ${WITHDRAWAL_CANCEL_MODAL_WITHDRAWAL_FIELDS}
  ${WITHDRAWAL_REQUEST_MODAL_WITHDRAWAL_FIELDS}
  fragment SeniorPoolWithdrawalPanelWithdrawalRequestFields on SeniorPoolWithdrawalRequest {
    id
    usdcWithdrawable @client
    ...WithdrawalCancelModalWithdrawalFields
    ...WithdrawalRequestModalWithdrawalFields
  }
`;

interface SeniorPoolWithdrawalPanelProps {
  fiduBalance?: CryptoAmount;
  stakedPositions?: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  vaultedStakedPositions?: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  seniorPoolSharePrice: BigNumber;
  seniorPoolLiquidity: BigNumber;
  epochEndsAt: number;
  cancellationFee: FixedNumber;
  existingWithdrawalRequest?: SeniorPoolWithdrawalPanelWithdrawalRequestFieldsFragment;
}

export function SeniorPoolWithdrawalPanel({
  fiduBalance = { token: SupportedCrypto.Fidu, amount: BigNumber.from(0) },
  seniorPoolSharePrice,
  stakedPositions = [],
  epochEndsAt,
  cancellationFee,
  vaultedStakedPositions = [],
  existingWithdrawalRequest,
}: SeniorPoolWithdrawalPanelProps) {
  const { provider } = useWallet();

  const [isWithdrawalModal2Open, setIsWithdrawalModal2Open] = useState(false);
  const [isCancelModal2Open, setIsCancelModal2Open] = useState(false);
  const [isHistoryModal2Open, setIsHistoryModal2Open] = useState(false);

  const rhfMethodsForWithdrawingUsdc = useForm();
  const totalUserFidu = sumTotalShares(
    fiduBalance,
    {
      amount: existingWithdrawalRequest?.fiduRequested ?? BigNumber.from(0),
      token: SupportedCrypto.Fidu,
    },
    stakedPositions.concat(vaultedStakedPositions)
  );
  const totalSharesUsdc = sharesToUsdc(
    totalUserFidu,
    seniorPoolSharePrice
  ).amount;
  const currentRequestUsdc = sharesToUsdc(
    existingWithdrawalRequest?.fiduRequested ?? BigNumber.from(0),
    seniorPoolSharePrice
  ).amount;

  const apolloClient = useApolloClient();

  const withdrawUsdcWithToken = async () => {
    if (!provider) {
      throw new Error("Bad wallet connection");
    } else if (!existingWithdrawalRequest) {
      throw new Error("No withdrawal request");
    }
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });
    await toastTransaction({
      transaction: seniorPoolContract.claimWithdrawalRequest(
        existingWithdrawalRequest.tokenId
      ),
    });
    await apolloClient.refetchQueries({ include: "active" });
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
              {formatCrypto({
                amount:
                  existingWithdrawalRequest?.usdcWithdrawable ??
                  BigNumber.from(0),
                token: SupportedCrypto.Usdc,
              })}
            </div>
            <Icon name="Usdc" size="sm" />
          </div>
        </div>

        {existingWithdrawalRequest ? (
          <Form
            rhfMethods={rhfMethodsForWithdrawingUsdc}
            onSubmit={withdrawUsdcWithToken}
          >
            <Button
              type="submit"
              colorScheme="secondary"
              size="xl"
              disabled={existingWithdrawalRequest.usdcWithdrawable.isZero()}
              className="mb-2 block w-full"
            >
              Withdraw USDC
            </Button>
          </Form>
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

        {existingWithdrawalRequest ? (
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
                {formatCrypto({
                  token: SupportedCrypto.Fidu,
                  amount: existingWithdrawalRequest.fiduRequested,
                })}
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
                {format(epochEndsAt * 1000, "MMM d, y")}
              </div>
              <button
                onClick={() => setIsHistoryModal2Open(true)}
                className="text-xs text-white underline"
              >
                View request history
              </button>
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
        nextDistributionTimestamp={epochEndsAt}
      />
      {existingWithdrawalRequest ? (
        <WithdrawalCancelModal2
          isOpen={isCancelModal2Open}
          onClose={() => setIsCancelModal2Open(false)}
          cancellationFee={cancellationFee}
          existingWithdrawalRequest={existingWithdrawalRequest}
        />
      ) : null}
      <WithdrawalHistoryModal2
        isOpen={isHistoryModal2Open}
        onClose={() => setIsHistoryModal2Open(false)}
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
  requested: CryptoAmount,
  staked: SeniorPoolWithdrawalPanelPositionFieldsFragment[]
): BigNumber {
  if (unstaked.token !== SupportedCrypto.Fidu) {
    throw new Error("Unstaked is not a CryptoAmount in FIDU");
  }
  const totalStaked = sumStakedShares(staked);

  return unstaked.amount.add(totalStaked).add(requested.amount);
}
