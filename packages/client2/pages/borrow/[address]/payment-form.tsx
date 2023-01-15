import { useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { ChangeEvent, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  DollarInput,
  Form,
  RadioButton,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { approveErc20IfRequired } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface PaymentFormProps {
  remainingPeriodDueAmount: BigNumber;
  remainingTotalDueAmount: BigNumber;
  borrowerContractAddress: string;
  tranchedPoolAddress: string;
  onClose: () => void;
}

// Using string enums b/c RHF incorrectly casts numeric enums on defaultValues set
enum PaymentOption {
  PayMinimumDue = "PayMinimumDue",
  PayFullBalancePlusInterest = "PayFullBalancePlusInterest",
  PayOtherAmount = "PayOtherAmount",
}

export function PaymentForm({
  remainingPeriodDueAmount,
  remainingTotalDueAmount,
  borrowerContractAddress,
  tranchedPoolAddress,
  onClose,
}: PaymentFormProps) {
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const remainingPeriodDueAmountCrypto = {
    amount: remainingPeriodDueAmount,
    token: "USDC",
  } as const;

  const remainingTotalDueAmountCrypto = {
    amount: remainingTotalDueAmount,
    token: "USDC",
  } as const;

  const showPayMinimumDueOption =
    remainingPeriodDueAmount.gt(0) &&
    !remainingPeriodDueAmount.eq(remainingTotalDueAmount);

  type FormFields = { usdcAmount: string; paymentOption: PaymentOption };
  const rhfMethods = useForm<FormFields>({
    defaultValues: {
      paymentOption: showPayMinimumDueOption
        ? PaymentOption.PayMinimumDue
        : PaymentOption.PayFullBalancePlusInterest,
      usdcAmount: showPayMinimumDueOption
        ? formatCrypto(remainingPeriodDueAmountCrypto, {
            includeSymbol: false,
            useMaximumPrecision: true,
          })
        : formatCrypto(remainingTotalDueAmountCrypto, {
            includeSymbol: false,
            useMaximumPrecision: true,
          }),
    },
  });
  const { control, register, setValue, watch } = rhfMethods;

  const onSubmit = async ({ usdcAmount }: FormFields) => {
    if (!account || !provider) {
      return;
    }
    const usdc = stringToCryptoAmount(usdcAmount, "USDC");

    const borrowerContract = await getContract({
      name: "Borrower",
      address: borrowerContractAddress,
      provider,
    });
    const usdcContract = await getContract({ name: "USDC", provider });

    await approveErc20IfRequired({
      account,
      spender: borrowerContract.address,
      erc20Contract: usdcContract,
      amount: usdc.amount,
    });
    await toastTransaction({
      transaction: borrowerContract.pay(tranchedPoolAddress, usdc.amount),
      pendingPrompt: "Credit Line payment submitted.",
    });
    await apolloClient.refetchQueries({ include: "active" });
    onClose();
  };

  const validatePaymentAmount = (usdcAmount: string) => {
    const usdcToPay = stringToCryptoAmount(usdcAmount, "USDC");
    if (usdcToPay.amount.gt(remainingTotalDueAmount)) {
      return "This is over the total balance of the credit line";
    }
    if (usdcToPay.amount.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  const registerPaymentOption = register("paymentOption");
  const usdcAmount = watch("usdcAmount");

  const onPaymentOptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    registerPaymentOption.onChange(e);
    switch (e.target.value as PaymentOption) {
      case PaymentOption.PayMinimumDue:
        setValue(
          "usdcAmount",
          formatCrypto(remainingPeriodDueAmountCrypto, {
            includeSymbol: false,
            useMaximumPrecision: true,
          })
        );
        return;
      case PaymentOption.PayFullBalancePlusInterest:
        setValue(
          "usdcAmount",
          formatCrypto(remainingTotalDueAmountCrypto, {
            includeSymbol: false,
            useMaximumPrecision: true,
          })
        );
        return;
      case PaymentOption.PayOtherAmount:
        setValue(
          "usdcAmount",
          formatCrypto(
            { amount: BigNumber.from(0), token: "USDC" },
            {
              includeSymbol: false,
              useMaximumPrecision: true,
            }
          )
        );
        return;
    }
  };

  // Set the correct radio payment option based on the usdc amount inputted
  useEffect(() => {
    const usdcAmountCrypto = stringToCryptoAmount(
      // In some instances the usdcAmount form value emitted includes commas i.e "5,020.000000"
      // which causes utils.parseUnits to throw an error
      usdcAmount.replaceAll(",", ""),
      "USDC"
    );
    if (
      usdcAmountCrypto.amount.eq(remainingPeriodDueAmount) &&
      showPayMinimumDueOption
    ) {
      setValue("paymentOption", PaymentOption.PayMinimumDue);
    } else if (usdcAmountCrypto.amount.eq(remainingTotalDueAmount)) {
      setValue("paymentOption", PaymentOption.PayFullBalancePlusInterest);
    } else {
      setValue("paymentOption", PaymentOption.PayOtherAmount);
    }
  }, [
    usdcAmount,
    remainingPeriodDueAmount,
    remainingTotalDueAmount,
    showPayMinimumDueOption,
    setValue,
  ]);

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div className="flex flex-col gap-1">
        {showPayMinimumDueOption && (
          <RadioButton
            id="payMinDue"
            labelClassName="text-lg"
            label={
              <div>
                Pay minimum due:
                <span className="font-semibold">
                  {` ${formatCrypto(remainingPeriodDueAmountCrypto)}`}
                </span>
              </div>
            }
            value={PaymentOption.PayMinimumDue}
            type="radio"
            {...registerPaymentOption}
            onChange={onPaymentOptionChange}
          />
        )}
        <RadioButton
          id="payFullBalancePlusInterest"
          labelClassName="text-lg"
          label={
            <div>
              Pay full balance plus interest:
              <span className="font-semibold">
                {` ${formatCrypto(remainingTotalDueAmountCrypto)}`}
              </span>
            </div>
          }
          value={PaymentOption.PayFullBalancePlusInterest}
          {...registerPaymentOption}
          onChange={onPaymentOptionChange}
        />
        <RadioButton
          id="payOtherAmount"
          labelClassName="text-lg"
          label="Pay other amount"
          value={PaymentOption.PayOtherAmount}
          {...registerPaymentOption}
          onChange={onPaymentOptionChange}
        />
        <div className="mt-4 flex flex-row gap-8">
          <DollarInput
            control={control}
            name="usdcAmount"
            label="USDC amount"
            hideLabel
            unit="USDC"
            rules={{
              required: "Required",
              validate: validatePaymentAmount,
            }}
            textSize="xl"
          />
          <Button type="submit" size="xl" as="button" className="px-12">
            Submit
          </Button>
        </div>
      </div>
    </Form>
  );
}
