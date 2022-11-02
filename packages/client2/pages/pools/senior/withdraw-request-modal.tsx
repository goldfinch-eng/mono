import { utils, BigNumber } from "ethers";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Form, Modal, Button, DollarInput } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto, CryptoAmount } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface WithdrawRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  balanceWallet: CryptoAmount;
  balanceStaked: CryptoAmount;
  balanceVaulted: CryptoAmount;
}

interface FormFields {
  amount: string;
}

export default function WithdrawRequestModal({
  isOpen,
  onClose,
  balanceWallet,
  balanceStaked,
  balanceVaulted,
}: WithdrawRequestModalProps) {
  const { provider } = useWallet();
  const rhfMethods = useForm<FormFields>();
  const { control, watch, formState } = rhfMethods;

  useEffect(() => {
    const contract = async () => {
      const senior = await getContract({
        name: "SeniorPool",
        provider,
      });

      console.log(await senior.currentEpoch());
    };
    if (provider) {
      contract();
    }
  }, [provider]);

  const handleSubmit = async (data: FormFields) => {
    // onClose();
    if (!provider) {
      return;
    }

    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });

    const gasPrice = await provider.getGasPrice();
    const value = utils.parseUnits("0", 18);

    const transaction = seniorPoolContract.requestWithdrawal(value);

    await toastTransaction({ transaction });

    onClose();
  };

  const watchFields = watch(["amount"]);

  console.log(watchFields);

  // useEffect(() => {
  //   if (watchFields[0]) {
  //     setParsedAmount(BigNumber.from("1"));
  //   } else {
  //     setParsedAmount(BigNumber.from("0"));
  //   }
  //   // const value = utils.parseUnits(data.amount, 18);
  // }, [watchFields]);

  return (
    <Modal
      size="sm"
      title="New withdrawal request"
      isOpen={isOpen}
      onClose={onClose}
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
            rules={{ required: "Required" }}
            textSize="xl"
            labelClassName="!text-base font-medium"
            labelDecoration={
              <span className="text-xs">
                Balance: {formatCrypto(balanceWallet, { includeToken: true })}
              </span>
            }
          />
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
              <div className="text-xl">
                {formatCrypto(balanceVaulted, { includeToken: true })}
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="mb-3 text-sm">Staked</div>
              <div className="text-xl">
                {formatCrypto(balanceStaked, { includeToken: true })}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-7">
          <h5 className="mb-2 text-base font-medium">
            Confirm withdrawal request
          </h5>
          <div className="mb-2 flex rounded border border-sand-200 bg-white">
            <div className="flex-1 border-r border-sand-200 p-5">
              <div className="mb-3 text-sm">Total FIDU requested</div>
              <div className="text-xl">
                {watchFields[0]
                  ? formatCrypto({
                      amount: utils.parseUnits(watchFields[0], 18),
                      token: SupportedCrypto.Fidu,
                    })
                  : ""}
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="mb-3 text-sm">First distribution date</div>
              <div className="text-xl">October 7, 2022</div>
            </div>
          </div>

          <p className="mb-1 text-xs">
            * Withdrawal requests are denomiated in FIDU, and the USD value of
            your request may change while the request is active.
            <br />
            <br />
            By clicking “Submit request” below, I hereby agree to the Senior
            Pool Agreement, including:
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

        <Button type="submit" size="xl" className="w-full px-12 py-5">
          Submit Request
        </Button>
      </Form>
    </Modal>
  );
}
