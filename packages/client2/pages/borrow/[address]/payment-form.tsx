import { useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { ChangeEvent, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  DollarInput,
  Form,
  RadioButton,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { approveErc20IfRequired } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { assertUnreachable } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { CreditLineStatus } from "@/pages/borrow/helpers";

interface PaymentFormProps {
  remainingPeriodDueAmount: BigNumber;
  remainingTotalDueAmount: BigNumber;
  borrowerContractAddress: string;
  loanAddress: string;
  creditLineStatus?: CreditLineStatus;
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
  loanAddress,
  creditLineStatus,
  onClose,
}: PaymentFormProps) {
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const showPayMinimumDueOption =
    remainingPeriodDueAmount.gt(0) &&
    // When both are equal we're on last period of loan
    !remainingPeriodDueAmount.eq(remainingTotalDueAmount);

  type FormFields = { usdcAmount: string; paymentOption: PaymentOption };
  const rhfMethods = useForm<FormFields>({
    defaultValues: {
      paymentOption: showPayMinimumDueOption
        ? PaymentOption.PayMinimumDue
        : PaymentOption.PayFullBalancePlusInterest,
      usdcAmount: showPayMinimumDueOption
        ? formatUnits(remainingPeriodDueAmount, USDC_DECIMALS)
        : formatUnits(remainingTotalDueAmount, USDC_DECIMALS),
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
      transaction: borrowerContract.pay(loanAddress, usdc.amount),
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

  // The reason why useEffect() isn't used to capture this behaviour is because we only want this to trigger when the user directly interacts with the radio buttons
  // Indirectly changing the paymentOption via setValue should not cause these side effects
  const onPaymentOptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    registerPaymentOption.onChange(e);
    switch (e.target.value as PaymentOption) {
      case PaymentOption.PayMinimumDue:
        setValue(
          "usdcAmount",
          formatUnits(remainingPeriodDueAmount, USDC_DECIMALS)
        );
        return;
      case PaymentOption.PayFullBalancePlusInterest:
        setValue(
          "usdcAmount",
          formatUnits(remainingTotalDueAmount, USDC_DECIMALS)
        );
        return;
      case PaymentOption.PayOtherAmount:
        setValue("usdcAmount", "");
        return;
      default:
        assertUnreachable(e.target.value as never);
    }
  };

  // Set the correct radio payment option based on the usdc amount inputted
  useEffect(() => {
    const usdcAmountCrypto = stringToCryptoAmount(usdcAmount, "USDC");
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
                {creditLineStatus === CreditLineStatus.PaymentLate
                  ? "Pay amount due: "
                  : "Pre-pay accrued interest: "}
                <span className="font-semibold">
                  {`${formatCrypto({
                    amount: remainingPeriodDueAmount,
                    token: "USDC",
                  })}`}
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
                {` ${formatCrypto({
                  amount: remainingTotalDueAmount,
                  token: "USDC",
                })}`}
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
        <div className="mt-4 flex items-start gap-8">
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
          <Button
            type="submit"
            size="xl"
            as="button"
            className="border border-transparent !px-12 !py-5"
          >
            Submit
          </Button>
        </div>
      </div>
    </Form>
  );
}
