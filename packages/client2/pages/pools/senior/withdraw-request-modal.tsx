import { format } from "date-fns";
import { utils, BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import {
  Form,
  Modal,
  Button,
  DollarInput,
  Link,
} from "@/components/design-system";
import { FIDU_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  CryptoAmount,
  EpochInfo,
} from "@/lib/graphql/generated";
import { sharesToUsdc, approveErc20IfRequired } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface WithdrawRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  withdrawalToken?: BigNumber | null;
  balanceWallet: CryptoAmount;
  balanceStaked: CryptoAmount;
  balanceVaulted: CryptoAmount;
  sharePrice?: BigNumber | null;
  currentEpoch?: EpochInfo | null;
  currentRequest?: BigNumber | null;
}

interface FormFields {
  amount: string;
}

export default function WithdrawRequestModal({
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
}: WithdrawRequestModalProps) {
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
          ? "New withdrawal request"
          : "Increase withdrawal request"
      }
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      className=" !bg-sand-100"
      titleSize="lg"
    >
      <Form rhfMethods={rhfMethods} onSubmit={handleSubmit}>
        <div className="mb-7">
          <DollarInput
            control={control}
            name="amount"
            label="In wallet FIDU"
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
        </div>

        <div className="mb-7">
          <h5 className="mb-2 text-base font-medium">Additional FIDU</h5>
          <p className="mb-2 text-xs">
            Only In Wallet FIDU can requested for withdrawal. If you want to
            withdraw Vaulted or Staked FIDU, you must un-vault and unstake the
            amount you want to withdraw before requesting.
          </p>

          <div className="flex rounded border border-sand-200 bg-white">
            <div className="flex-1 border-r border-sand-200 p-5">
              <div className="mb-3 text-sm">Vaulted</div>
              <div className="mb-3 text-xl">
                {formatCrypto(balanceVaulted, { includeToken: true })}
              </div>
              <Button
                as="a"
                className="block w-full"
                iconRight="ArrowSmRight"
                href="/vault"
              >
                Go to Vault page
              </Button>
            </div>
            <div className="flex-1 p-5">
              <div className="mb-3 text-sm">Staked</div>
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
            Confirm withdrawal request
          </h5>
          <div className="mb-2 flex rounded border border-sand-200 bg-white">
            {withdrawalToken ? (
              <>
                <div className="flex-1 border-r border-sand-200 p-5">
                  <div className="mb-3 text-sm">Current request</div>
                  <div className="text-xl">
                    {currentRequest
                      ? formatCrypto({
                          amount: currentRequest,
                          token: SupportedCrypto.Fidu,
                        })
                      : null}
                  </div>
                </div>
                <div className="flex-1 border-r border-sand-200 p-5">
                  <div className="mb-3 text-sm">New request</div>
                  <div className="text-xl">
                    {watchFields[0] && currentRequest
                      ? formatCrypto({
                          amount: utils
                            .parseUnits(watchFields[0], FIDU_DECIMALS)
                            .add(currentRequest),
                          token: SupportedCrypto.Fidu,
                        })
                      : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 border-r border-sand-200 p-5">
                  <div className="mb-3 text-sm">Total FIDU requested</div>
                  <div className="text-xl">
                    {watchFields[0]
                      ? formatCrypto({
                          amount: utils.parseUnits(
                            watchFields[0],
                            FIDU_DECIMALS
                          ),
                          token: SupportedCrypto.Fidu,
                        })
                      : null}
                  </div>
                </div>
              </>
            )}
            <div className="flex-1 p-5">
              <div className="mb-3 text-sm">
                {withdrawalToken
                  ? "Next distribution"
                  : "First distribution date"}
              </div>
              {currentEpoch ? (
                <div className="text-xl">
                  {format(
                    currentEpoch.endTime.mul(1000).toNumber(),
                    "MMM d, y"
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <p className="mb-1 text-xs">
            * Withdrawal requests are denomiated in FIDU, and the USD value of
            your request may change while the request is active.
            <br />
            <br />
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
            <li>
              If I cancel a request before it is fulfilled, I will be charged a
              fee of 12.00% of the total request
            </li>
          </ul>
        </div>

        <Button
          type="submit"
          size="xl"
          className="w-full px-12 py-5"
          disabled={!watchFields[0]}
        >
          {withdrawalToken ? "Increase Request" : "Submit Request"}
        </Button>
      </Form>
    </Modal>
  );
}
