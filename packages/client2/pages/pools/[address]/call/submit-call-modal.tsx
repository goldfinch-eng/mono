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
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { SubmitCallModalPoolTokenFieldsFragment } from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

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
  const { provider } = useWallet();
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
    if (!provider) {
      throw new Error("Wallet not connected properly");
    }
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      address: callableLoanAddress,
      provider,
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
  const { provider } = useWallet();
  const apolloClient = useApolloClient();
  const { data } = useStepperContext();
  const { usdcToCall, expectedRepaymentDate } = data as StepperDataType;

  const onSubmit = async () => {
    if (!provider) {
      throw new Error("Wallet not connected properly");
    }
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      address: callableLoanAddress,
      provider,
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
        Lorem ipsum
      </Alert>
      <div className="text-xs text-sand-400">
        Legalese goes here. Lorem ipsum dolor sit amet, consectetur adipiscing
        elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
        ut aliquip ex ea commodo consequat. Duis aute irure dolor in
        reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
        pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa
        qui officia deserunt mollit anim id est laborum.
      </div>
    </FormStep>
  );
}
