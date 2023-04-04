import { gql, useApolloClient } from "@apollo/client";
import { format as formatDate } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";
import { useForm } from "react-hook-form";

import {
  AssetBox,
  AssetInputBox,
  FormStep,
  InfoIconTooltip,
  Link,
  ModalStepper,
  useStepperContext,
} from "@/components/design-system";
import { getContract2 } from "@/lib/contracts";
import {
  formatCrypto,
  formatPercent,
  stringToCryptoAmount,
} from "@/lib/format";
import { WithdrawalRequestModalWithdrawalFieldsFragment } from "@/lib/graphql/generated";
import { approveErc20IfRequired, sharesToUsdc } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet2 } from "@/lib/wallet";

export const WITHDRAWAL_REQUEST_MODAL_WITHDRAWAL_FIELDS = gql`
  fragment WithdrawalRequestModalWithdrawalFields on SeniorPoolWithdrawalRequest {
    id
    tokenId
    previewFiduRequested @client
    requestedAt
    increasedAt
  }
`;

type WithdrawalRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  existingWithdrawalRequest?: WithdrawalRequestModalWithdrawalFieldsFragment;
} & InputFiduStepProps &
  ConfirmStepProps;

export function WithdrawalRequestModal({
  isOpen,
  onClose,
  sharePrice,
  existingWithdrawalRequest,
  walletFidu,
  vaultedFidu,
  stakedFidu,
  cancellationFee,
  nextDistributionTimestamp,
}: WithdrawalRequestModalProps) {
  return (
    <ModalStepper
      className="bg-sand-100"
      isOpen={isOpen}
      onClose={onClose}
      title={
        existingWithdrawalRequest
          ? "Increase withdrawal request"
          : "Withdrawal request"
      }
    >
      <InputFiduStep
        sharePrice={sharePrice}
        existingWithdrawalRequest={existingWithdrawalRequest}
        walletFidu={walletFidu}
        vaultedFidu={vaultedFidu}
        stakedFidu={stakedFidu}
      />
      <ConfirmStep
        sharePrice={sharePrice}
        existingWithdrawalRequest={existingWithdrawalRequest}
        cancellationFee={cancellationFee}
        nextDistributionTimestamp={nextDistributionTimestamp}
      />
    </ModalStepper>
  );
}

interface InputFiduStepProps {
  sharePrice: BigNumber;
  existingWithdrawalRequest?: WithdrawalRequestModalWithdrawalFieldsFragment;
  walletFidu: CryptoAmount;
  vaultedFidu: CryptoAmount;
  stakedFidu: CryptoAmount;
}

interface FormData {
  fidu: string;
}

function InputFiduStep({
  sharePrice,
  existingWithdrawalRequest,
  walletFidu,
  vaultedFidu,
  stakedFidu,
}: InputFiduStepProps) {
  const rhfMethods = useForm<FormData>();
  const validateAmount = (value: string) => {
    if (!value) {
      return "Required";
    }
    const parsed = stringToCryptoAmount(value, "FIDU");
    if (parsed.amount.isZero()) {
      return "Must be more than 0";
    }
  };
  return (
    <FormStep rhfMethods={rhfMethods}>
      {existingWithdrawalRequest ? (
        <div className="mb-8">
          <div className="mb-2 text-sm">Original request amount</div>
          <AssetBox
            nativeAmountIsPrimary
            asset={{
              name: "FIDU",
              description: `Requested for withdrawal on ${formatDate(
                existingWithdrawalRequest.requestedAt * 1000,
                "MMM dd, yyyy"
              )}`,
              nativeAmount: {
                token: "FIDU",
                amount: existingWithdrawalRequest.previewFiduRequested,
              },
              usdcAmount: sharesToUsdc(
                existingWithdrawalRequest.previewFiduRequested,
                sharePrice
              ),
            }}
          />
        </div>
      ) : null}
      <div className="mb-8 space-y-2">
        <div>
          <div className="mb-2 text-sm">
            {existingWithdrawalRequest
              ? "Additional amount to request for withdrawal"
              : "Specify an amount to request for withdrawal"}
          </div>
          <AssetInputBox
            asset={{
              name: "Withdrawable FIDU",
              description: "Available to request for withdrawal",
              nativeAmount: walletFidu,
              usdcAmount: sharesToUsdc(walletFidu.amount, sharePrice),
            }}
            name="fidu"
            label="FIDU to withdraw"
            textSize="xl"
            control={rhfMethods.control}
            rules={{ validate: { validateAmount } }}
          />
        </div>
        {!vaultedFidu.amount.isZero() ? (
          <AssetBox
            nativeAmountIsPrimary
            asset={{
              name: "Vaulted FIDU",
              description: "FIDU deposited in the Member Vault",
              nativeAmount: vaultedFidu,
              usdcAmount: sharesToUsdc(vaultedFidu.amount, sharePrice),
            }}
            notice={
              <div className="flex items-center justify-between gap-2">
                <div>
                  FIDU must be removed from the Vault before withdrawing
                </div>
                <Link
                  className="text-mustard-700"
                  href="/membership"
                  iconRight="ArrowSmRight"
                >
                  Go to Vault page
                </Link>
              </div>
            }
          />
        ) : null}
        {!stakedFidu.amount.isZero() ? (
          <AssetBox
            nativeAmountIsPrimary
            asset={{
              name: "Staked FIDU",
              description: "FIDU currently staked",
              nativeAmount: stakedFidu,
              usdcAmount: sharesToUsdc(stakedFidu.amount, sharePrice),
            }}
            notice={
              <div className="flex items-center justify-between gap-2">
                <div>FIDU must be unstaked before withdrawing</div>
                <Link
                  className="text-mustard-700"
                  href="/stake"
                  iconRight="ArrowSmRight"
                >
                  Go to Stake page
                </Link>
              </div>
            }
          />
        ) : null}
      </div>
    </FormStep>
  );
}

interface ConfirmStepProps {
  sharePrice: BigNumber;
  existingWithdrawalRequest?: WithdrawalRequestModalWithdrawalFieldsFragment;
  cancellationFee: FixedNumber;
  nextDistributionTimestamp: number;
}

function ConfirmStep({
  sharePrice,
  existingWithdrawalRequest,
  cancellationFee,
  nextDistributionTimestamp,
}: ConfirmStepProps) {
  const rhfMethods = useForm<FormData>();
  const { data } = useStepperContext();
  const fiduInputted = stringToCryptoAmount(data.fidu, "FIDU");
  const newRequestTotalFidu = {
    token: "FIDU",
    amount: existingWithdrawalRequest
      ? existingWithdrawalRequest.previewFiduRequested.add(fiduInputted.amount)
      : fiduInputted.amount,
  } as const;
  const { account, signer } = useWallet2();
  const apolloClient = useApolloClient();
  const onSubmit = async (data: FormData) => {
    if (!account || !signer) {
      throw new Error("Wallet is not connected");
    }

    const fiduInputted = stringToCryptoAmount(data.fidu, "FIDU");

    const seniorPoolContract = await getContract2({
      name: "SeniorPool",
      signer,
    });
    const fiduContract = await getContract2({
      name: "Fidu",
      signer,
    });

    await approveErc20IfRequired({
      account,
      spender: seniorPoolContract.address,
      amount: fiduInputted.amount,
      erc20Contract: fiduContract,
    });

    if (existingWithdrawalRequest) {
      await toastTransaction({
        transaction: seniorPoolContract.addToWithdrawalRequest(
          fiduInputted.amount,
          existingWithdrawalRequest.tokenId
        ),
        pendingPrompt: "Submitting increase to withdrawal request",
      });
    } else {
      await toastTransaction({
        transaction: seniorPoolContract.requestWithdrawal(fiduInputted.amount),
        pendingPrompt: "Submitting withdrawal request.",
      });
    }
    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "seniorPoolWithdrawalRequests" });
      },
    });
  };
  return (
    <FormStep rhfMethods={rhfMethods} onSubmit={onSubmit} requireScrolled>
      {existingWithdrawalRequest ? (
        <div className="mb-8">
          <div className="mb-8">
            <div className="mb-2 text-sm">Original request amount</div>
            <AssetBox
              nativeAmountIsPrimary
              asset={{
                name: "FIDU",
                description: `Requested for withdrawal on ${formatDate(
                  existingWithdrawalRequest.requestedAt * 1000,
                  "MMM dd, yyyy"
                )}`,
                nativeAmount: {
                  token: "FIDU",
                  amount: existingWithdrawalRequest.previewFiduRequested,
                },
                usdcAmount: sharesToUsdc(
                  existingWithdrawalRequest.previewFiduRequested,
                  sharePrice
                ),
              }}
            />
          </div>
          <div>
            <div className="mb-2 text-sm">
              Additional amount to request for withdrawal
            </div>
            <AssetBox
              nativeAmountIsPrimary
              asset={{
                name: "FIDU",
                description: "Additional amount to request for withdrawal",
                nativeAmount: fiduInputted,
                usdcAmount: sharesToUsdc(fiduInputted.amount, sharePrice),
              }}
            />
          </div>
        </div>
      ) : null}
      <div className="mb-6">
        <div className="mb-2 text-sm">
          {existingWithdrawalRequest
            ? "Confirm new request amount"
            : "Confirm withdrawal request"}
        </div>
        <div className="divide-y divide-sand-200 rounded-lg border border-sand-200 bg-white">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-2 text-sm text-sand-600">
              {existingWithdrawalRequest
                ? "New request total"
                : "Total FIDU request for withdrawal"}
              <InfoIconTooltip content="The amount of FIDU you are requesting to withdraw." />
            </div>
            <div>
              <div className="text-lg font-medium">
                {formatCrypto(newRequestTotalFidu)}
              </div>
              <div className="text-right text-xs font-medium text-sand-400">
                {formatCrypto(
                  sharesToUsdc(newRequestTotalFidu.amount, sharePrice)
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between p-5">
            <div className="flex items-center gap-2 text-sm text-sand-600">
              {existingWithdrawalRequest
                ? "Next distribution date"
                : "First distribution date"}
              <InfoIconTooltip content="The next date that the FIDU submitted in withdrawal requests will be distributed to requestors. Distributions happen every two weeks, and requests automatically roll-over to the next period until they are fully fulfilled." />
            </div>
            <div className="text-lg">
              {formatDate(nextDistributionTimestamp * 1000, "MMMM dd, yyyy")}
            </div>
          </div>
        </div>
      </div>
      <div className="mb-8 border-tidepool-200 bg-tidepool-100 p-3 text-sm text-tidepool-600">
        <p className="mb-2">
          By clicking &rdquo;Submit&ldquo; below, I hereby acknowledge and agree
          to the{" "}
          <Link
            className="text-tidepool-800"
            href="/senior-pool-agreement-interstitial"
            openInNewTab
          >
            Senior Pool Agreement
          </Link>{" "}
          and{" "}
          <Link className="text-tidepool-800" href="/terms" openInNewTab>
            Terms of Service
          </Link>
          , including:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            No Staking or Membership rewards are earned on FIDU that is
            requested for withdraw
          </li>
          <li>
            A cancellation fee of {formatPercent(cancellationFee)} is assessed
            on withdraws that are cancelled before they are completely filled
          </li>
          <li>
            Once a request has been submitted, it can only be increased or
            cancelled, not reduced
          </li>
          <li>
            Withdrawal requests are processed every two weeks, and it may take
            multiple distribution periods to fulfill the request.
          </li>
          <li>
            <Link
              className="text-tidepool-800"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/liquidity"
              openInNewTab
            >
              Read more about Senior Pool Withdraws
            </Link>
          </li>
        </ul>
      </div>
    </FormStep>
  );
}
