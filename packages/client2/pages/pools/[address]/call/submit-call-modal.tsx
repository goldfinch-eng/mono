import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import {
  Alert,
  AssetInputBox,
  FormStep,
  ModalStepper,
  useStepperContext,
} from "@/components/design-system";
import { getContract2 } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { SubmitCallModalPoolTokenFieldsFragment } from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet2 } from "@/lib/wallet";

interface SubmitCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callableLoanAddress: string;
  callablePoolTokens: SubmitCallModalPoolTokenFieldsFragment[];
}

gql`
  fragment SubmitCallModalPoolTokenFields on PoolToken {
    id
    principalAmount
    principalRedeemable @client
    interestRedeemable
  }
`;

export function SubmitCallModal({
  isOpen,
  onClose,
  callableLoanAddress,
  callablePoolTokens,
}: SubmitCallModalProps) {
  return (
    <ModalStepper
      isOpen={isOpen}
      onClose={onClose}
      title="Submitting call request"
      size="sm"
    >
      <CallAmountStep
        callableLoanAddress={callableLoanAddress}
        maxCallable={{
          token: "USDC",
          amount: sum("principalAmount", callablePoolTokens),
        }}
      />
      <ReviewStep
        callableLoanAddress={callableLoanAddress}
        callablePoolTokens={callablePoolTokens}
      />
    </ModalStepper>
  );
}

interface StepperDataType {
  usdcToCall: CryptoAmount<"USDC">;
  expectedRepaymentDate: number;
}

interface CallAmountStepProps {
  callableLoanAddress: string;
  maxCallable: CryptoAmount<"USDC">;
}

function CallAmountStep({
  callableLoanAddress,
  maxCallable,
}: CallAmountStepProps) {
  const { signer } = useWallet2();
  type FormData = { usdcToCall: string };
  const rhfMethods = useForm<FormData>();
  const validateAmount = async (value: string) => {
    if (!value) {
      return "Required";
    }
    const parsed = stringToCryptoAmount(value, "USDC");
    if (parsed.amount.isZero()) {
      return "Must be more than 0";
    }
  };
  const { setData } = useStepperContext();
  const onSubmit = async ({ usdcToCall }: FormData) => {
    if (!signer) {
      throw new Error("Wallet not connected properly");
    }
    const callableLoanContract = await getContract2({
      name: "CallableLoan",
      address: callableLoanAddress,
      signer,
    });
    const nextPrincipalDueTime =
      await callableLoanContract.nextPrincipalDueTime();
    setData({
      usdcToCall: stringToCryptoAmount(usdcToCall, "USDC"),
      expectedRepaymentDate: nextPrincipalDueTime.toNumber() * 1000,
    } as StepperDataType);
  };
  return (
    <FormStep className="max-h-96" rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <AssetInputBox
        asset={{
          name: "Withdrawable USDC",
          description: "Available to request for withdrawal",
          usdcAmount: maxCallable,
        }}
        name="usdcToCall"
        label="USDC to withdraw"
        textSize="xl"
        control={rhfMethods.control}
        rules={{ validate: { validateAmount } }}
      />
    </FormStep>
  );
}

interface ReviewStepProps {
  callableLoanAddress: string;
  callablePoolTokens: SubmitCallModalPoolTokenFieldsFragment[];
}

function ReviewStep({
  callableLoanAddress,
  callablePoolTokens,
}: ReviewStepProps) {
  const { signer } = useWallet2();
  const apolloClient = useApolloClient();
  const { data } = useStepperContext();
  const { usdcToCall, expectedRepaymentDate } = data as StepperDataType;

  const totalUsdcAutoRedeeming = {
    token: "USDC" as const,
    amount: sum("principalRedeemable", callablePoolTokens).add(
      sum("interestRedeemable", callablePoolTokens)
    ),
  };

  const onSubmit = async () => {
    if (!signer) {
      throw new Error("Wallet not connected properly");
    }
    const callableLoanContract = await getContract2({
      name: "CallableLoan",
      address: callableLoanAddress,
      signer,
    });
    callablePoolTokens.sort((a, b) =>
      b.principalAmount.sub(a.principalAmount).toNumber()
    );
    let remainingUsdcToCall = usdcToCall.amount;
    const tokensAndCalls: { tokenId: string; callAmount: BigNumber }[] = [];
    for (const pt of callablePoolTokens) {
      const callAmount = remainingUsdcToCall.gt(pt.principalAmount)
        ? pt.principalAmount
        : remainingUsdcToCall;
      tokensAndCalls.push({ tokenId: pt.id, callAmount });
      await toastTransaction({
        transaction: callableLoanContract.submitCall(callAmount, pt.id),
        pendingPrompt: `Calling capital on pool token ID ${pt.id}`,
      });
      remainingUsdcToCall = remainingUsdcToCall.sub(callAmount);
      if (remainingUsdcToCall.lte(0)) {
        break;
      }
    }
    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <FormStep
      className="max-h-96"
      rhfMethods={useForm()}
      onSubmit={onSubmit}
      requireScrolled
    >
      <div className="mb-8 divide-y divide-sand-200 rounded-lg border border-sand-200 bg-white text-lg">
        <div className="flex items-center justify-between p-5">
          <div>Total USDC requested</div>
          <div>{formatCrypto(usdcToCall)}</div>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>Expected repayment date</div>
          <div>{format(expectedRepaymentDate, "MMMM d, yyyy")}</div>
        </div>
      </div>
      <Alert className="mb-6" type="info">
        By submitting a call request, your current claimable principal and
        interest ({formatCrypto(totalUsdcAutoRedeeming)}) will be automatically
        claimed.
      </Alert>
      <div className="text-xs text-sand-400">
        Per the terms of the Facility Agreement, you acknowledge that you are
        submitting a request to call some portion or all of the outstanding
        principal and outstanding interest due from the Borrower. You further
        acknowledge that by clicking “Submit,” the Borrower will be informed of
        your intent to withdraw some portion or all of the outstanding principal
        and outstanding interest due (“Call Notice”). You may not cancel the
        Call Notice. The Expected Repayment Date is an estimate and is
        contingent on (a) the Call Period defined in the Facility Agreement, and
        (b) the Borrower supplying USDC to the appropriate Goldfinch smart
        contract.
      </div>
    </FormStep>
  );
}
