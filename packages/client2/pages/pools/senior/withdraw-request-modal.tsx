import { format } from "date-fns";
import { utils, BigNumber, FixedNumber } from "ethers";
import { useForm } from "react-hook-form";

import {
  Form,
  Modal,
  Button,
  DollarInput,
  Link,
  Alert,
  InfoIconTooltip,
} from "@/components/design-system";
import { FIDU_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SupportedCrypto,
  CryptoAmount,
  WithdrawalEpochInfo,
} from "@/lib/graphql/generated";
import { sharesToUsdc, approveErc20IfRequired } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface WithdrawalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  withdrawalToken?: BigNumber | null;
  balanceWallet: CryptoAmount;
  balanceStaked: CryptoAmount;
  balanceVaulted: CryptoAmount;
  sharePrice?: BigNumber | null;
  currentEpoch?: WithdrawalEpochInfo | null;
  currentRequest?: BigNumber | null;
  cancellationFee?: FixedNumber | null;
}

interface FormFields {
  amount: string;
}

export default function WithdrawalRequestModal({
  isOpen,
  onClose,
  sharePrice,
  withdrawalToken,
  balanceWallet,
  balanceStaked,
  balanceVaulted,
  currentRequest,
  currentEpoch,
  onComplete,
  cancellationFee,
}: WithdrawalRequestModalProps) {
  const { account, provider } = useWallet();
  const rhfMethods = useForm<FormFields>();
  const { control, watch, reset } = rhfMethods;

  const handleSubmit = async (data: FormFields) => {
    if (!provider || !account) {
      return;
    }

    const value = utils.parseUnits(data.amount, FIDU_DECIMALS);

    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });

    const FiduContract = await getContract({
      name: "Fidu",
      provider,
    });

    await approveErc20IfRequired({
      account,
      spender: seniorPoolContract.address,
      amount: value,
      erc20Contract: FiduContract,
    });

    let transaction;

    if (withdrawalToken) {
      transaction = seniorPoolContract.addToWithdrawalRequest(
        value,
        withdrawalToken
      );
    } else {
      transaction = seniorPoolContract.requestWithdrawal(value);
    }

    await toastTransaction({ transaction });

    reset();
    onComplete();
  };

  // Validate entered amounts
  const validateAmount = async (value: string) => {
    const valueAsFidu = utils.parseUnits(value, FIDU_DECIMALS);
    if (valueAsFidu.lte(BigNumber.from(0))) {
      return "Amount must be greater than 0";
    }
    if (valueAsFidu.gt(balanceWallet.amount)) {
      return "Amount exceeds what is available to withdraw";
    }
  };

  // Watch for amount input change
  const watchFields = watch(["amount"]);

  return (
    <Modal
      size="sm"
      title={
        withdrawalToken
          ? "Increase withdrawal request"
          : "New withdrawal request"
      }
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      className=" !bg-sand-100"
    >
      <Form rhfMethods={rhfMethods} onSubmit={handleSubmit}>
        {!withdrawalToken && (
          <Alert className="mb-7" type="info" hasIcon={false}>
            Withdrawal requests are processed every two weeks, and it may take
            multiple distribution periods to fulfill the request.{" "}
            <Link
              className="text-tidepool-600 underline"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/liquidity"
              target="_blank"
              rel="noreferrer"
            >
              Read more
            </Link>
          </Alert>
        )}
        <div className="mb-7">
          <DollarInput
            control={control}
            name="amount"
            label="Withdrawable FIDU"
            maxValue={async () => {
              reset();
              return balanceWallet.amount;
            }}
            maxButtonStyle="filled"
            unit={SupportedCrypto.Fidu}
            rules={{ required: "Required", validate: validateAmount }}
            textSize="xl"
            labelClassName="!text-base font-medium"
            labelDecoration={
              <span className="text-xs font-normal">
                Balance: {formatCrypto(balanceWallet, { includeToken: true })}
              </span>
            }
          />

          <div className="mt-2 text-xs">
            <div className="flex items-center gap-2">
              <div>
                {watchFields[0] && sharePrice
                  ? formatCrypto(
                      sharesToUsdc(
                        utils.parseUnits(watchFields[0], FIDU_DECIMALS),
                        sharePrice
                      )
                    )
                  : "$0.00"}{" "}
                current USD value *
              </div>
              <InfoIconTooltip
                size="sm"
                content="Withdrawal requests are denominated in FIDU, and the USD value of your request may change while the request is active."
              />
            </div>
          </div>

          {balanceWallet.amount.lte(BigNumber.from("0")) ? (
            <Alert className="mt-2" type="warning">
              You don&apos;t have any Withdrawable FIDU available to request for
              withdrawal
            </Alert>
          ) : null}
        </div>

        <div className="mb-7">
          <div className="mb-2 flex items-center gap-2">
            <h5 className="text-base font-medium">Non-withdrawable FIDU</h5>
            <div className="flex text-sand-400">
              <InfoIconTooltip
                size="sm"
                content="Only Withdrawable FIDU can be requested for withdrawal. In order to withdraw FIDU that is currently Vaulted or Staked, you must first unstake the FIDU and/or withdraw it from the vault."
              />
            </div>
          </div>
          <div className="flex rounded border border-sand-200 bg-white">
            <div className="flex-1 border-r border-sand-200 p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="text-sm">Vaulted</div>
                <InfoIconTooltip
                  size="sm"
                  content="FIDU that is currently deposited in a Member Vault. In order to submit a withdrawal request for this FIDU, you must first go to the Vault page and remove the FIDU from the Member Vault."
                />
              </div>
              <div className="mb-3 text-xl">
                {formatCrypto(balanceVaulted, { includeToken: true })}
              </div>
              <Button
                as="a"
                className="block w-full"
                iconRight="ArrowSmRight"
                href="/membership"
              >
                Go to Vault page
              </Button>
            </div>
            <div className="flex-1 p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="text-sm">Staked</div>
                <InfoIconTooltip
                  size="sm"
                  content="FIDU that is currently staked. In order to submit a withdrawal request for this FIDU, you must first go to the Stake page and unstake the FIDU."
                />
              </div>

              <div className="mb-3 text-xl">
                {formatCrypto(balanceStaked, { includeToken: true })}
              </div>
              <Button
                as="a"
                className="block w-full"
                iconRight="ArrowSmRight"
                href="/stake"
              >
                Go to Stake page
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-7">
          <h5 className="mb-2 text-base font-medium">
            {withdrawalToken ? "Confirm changes" : "Confirm withdrawal request"}
          </h5>
          <div className="mb-2 rounded border border-sand-200 bg-white">
            {withdrawalToken ? (
              <>
                <div className="flex items-center justify-between border-b border-sand-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm">Current request amount</div>
                    <InfoIconTooltip
                      size="sm"
                      content="FIDU you previously submitted a withdrawal request for."
                    />
                  </div>
                  <div className="text-lg text-sand-400">
                    {currentRequest
                      ? formatCrypto(
                          {
                            amount: currentRequest,
                            token: SupportedCrypto.Fidu,
                          },
                          { includeToken: true }
                        )
                      : null}
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-sand-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm">New request total</div>
                    <InfoIconTooltip
                      size="sm"
                      content="Your total FIDU withdrawal request outstanding, with the request increase reflected."
                    />
                  </div>
                  <div className="text-lg">
                    {watchFields[0] && currentRequest
                      ? formatCrypto(
                          {
                            amount: utils
                              .parseUnits(watchFields[0], FIDU_DECIMALS)
                              .add(currentRequest),
                            token: SupportedCrypto.Fidu,
                          },
                          { includeToken: true }
                        )
                      : "---"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-sand-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm">
                      Total FIDU request for withdrawal
                    </div>
                    <InfoIconTooltip
                      size="sm"
                      content="The amount of FIDU you are requesting to withdraw."
                    />
                  </div>
                  <div className="text-lg">
                    {formatCrypto(
                      {
                        amount: watchFields[0]
                          ? utils.parseUnits(watchFields[0], FIDU_DECIMALS)
                          : BigNumber.from("0"),
                        token: SupportedCrypto.Fidu,
                      },
                      { includeToken: true }
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <div className="text-sm">
                  {withdrawalToken
                    ? "Next distribution"
                    : "First distribution date"}
                </div>
                <InfoIconTooltip
                  size="sm"
                  content="The next date that the FIDU submitted in withdrawal requests will be distributed to requestors. Distributions happen every two weeks, and requests automatically roll-over to the next period until they are fully fulfilled."
                />
              </div>
              {currentEpoch ? (
                <div className="text-lg">
                  {format(
                    currentEpoch.endTime.mul(1000).toNumber(),
                    "MMM d, y"
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <p className="mb-1 text-xs">
            By clicking &ldquo;Submit request&rdquo; below, I hereby agree to
            the{" "}
            <Link href="/senior-pool-agreement-interstitial">
              Senior Pool Agreement
            </Link>
            , including:
          </p>
          <ul className="list-disc pl-6 text-xs">
            <li>
              Once a request has been submitted, it can only be increased or
              cancelled, not reduced
            </li>
            <li>
              My withdrawal request may be fulfilled over multiple distribution
              periods, and it will remain active until it is completely
              fulfilled or I cancel
            </li>
            {cancellationFee ? (
              <li>
                If I cancel a request before it is fulfilled, I will be charged
                a fee of {formatPercent(cancellationFee)} of the total request
              </li>
            ) : null}
          </ul>
        </div>

        <Button
          type="submit"
          size="xl"
          className="w-full px-12 py-5"
          disabled={
            !watchFields[0] || balanceWallet.amount.lte(BigNumber.from("0"))
          }
        >
          {withdrawalToken ? "Increase request" : "Submit request"}
        </Button>
      </Form>
    </Modal>
  );
}
