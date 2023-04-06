import { useApolloClient, gql } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import isEmail from "validator/lib/isEmail";

import {
  Button,
  DollarInput,
  Form,
  Icon,
  InfoIconTooltip,
  Input,
  Link,
} from "@/components/design-system";
import { TRANCHES, USDC_DECIMALS } from "@/constants";
import { dataLayerPushEvent } from "@/lib/analytics";
import { generateErc20PermitSignature, getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  SupplyPanelLoanFieldsFragment,
  SupplyPanelUserFieldsFragment,
  SupplyPanelDealFieldsFragment,
} from "@/lib/graphql/generated";
import {
  approveErc20IfRequired,
  canUserParticipateInPool,
  signAgreement,
  usdcWithinEpsilon,
} from "@/lib/pools";
import { openWalletModal, openVerificationModal } from "@/lib/state/actions";
import { toastTransaction } from "@/lib/toast";
import { isSmartContract, useWallet } from "@/lib/wallet";

export const SUPPLY_PANEL_LOAN_FIELDS = gql`
  fragment SupplyPanelLoanFields on Loan {
    __typename
    id
    address
    usdcApy
    rawGfiApy
    ... on TranchedPool {
      juniorDeposited
      estimatedLeverageRatio
    }
    totalDeposited
    allowedUidTypes
    fundingLimit
  }
`;

export const SUPPLY_PANEL_USER_FIELDS = gql`
  fragment SupplyPanelUserFields on User {
    id
    uidType
    isGoListed
  }
`;

export const SUPPLY_PANEL_DEAL_FIELDS = gql`
  fragment SupplyPanelDealFields on Deal {
    id
    name
    agreement
    dealType
  }
`;

interface SupplyPanelProps {
  loan: SupplyPanelLoanFieldsFragment;
  user: SupplyPanelUserFieldsFragment | null;
  deal: SupplyPanelDealFieldsFragment;
}

interface SupplyForm {
  supply: string;
  backerName: string;
  email: string;
}

export function SupplyPanel({ loan, user, deal }: SupplyPanelProps) {
  const apolloClient = useApolloClient();
  const { account, provider, signer } = useWallet();

  const isUserVerified = user?.isGoListed || !!user?.uidType;

  const canUserParticipate = user
    ? canUserParticipateInPool(loan.allowedUidTypes, user)
    : false;

  const rhfMethods = useForm<SupplyForm>();
  const { control, register } = rhfMethods;

  const remainingCapacity =
    loan.__typename === "TranchedPool"
      ? deal.dealType === "multitranche" && loan.estimatedLeverageRatio
        ? loan.fundingLimit
            .sub(
              loan.juniorDeposited.mul(
                utils
                  .parseUnits(loan.estimatedLeverageRatio.toString(), 0)
                  .add(1)
              )
            )
            .div(
              utils.parseUnits(loan.estimatedLeverageRatio.toString(), 0).add(1)
            )
        : loan.fundingLimit.sub(loan.juniorDeposited)
      : loan.fundingLimit.sub(loan.totalDeposited);

  const validateMaximumAmount = async (value: string) => {
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);
    if (valueAsUsdc.gt(remainingCapacity)) {
      return "Amount exceeds remaining capacity";
    }
    if (valueAsUsdc.lt(utils.parseUnits("0.01", USDC_DECIMALS))) {
      return "Must deposit more than $0.01";
    }
    if (
      valueAsUsdc.gt(availableBalance) &&
      !usdcWithinEpsilon(valueAsUsdc, availableBalance)
    ) {
      return "Amount exceeds USDC balance";
    }
  };

  const onSubmit = async (data: SupplyForm) => {
    if (!account || !signer) {
      throw new Error("Wallet not connected properly");
    }

    await signAgreement(account, data.backerName, data.email, loan.address);

    // Ensures the user doesn't leave any dust behind when they choose to supply max
    let value = utils.parseUnits(data.supply, USDC_DECIMALS);
    if (usdcWithinEpsilon(value, availableBalance)) {
      value = availableBalance;
    }

    let submittedTransaction;

    const usdcContract = await getContract({ name: "USDC", signer });
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      signer,
      address: loan.address,
    });
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      signer,
      address: loan.address,
    });
    if (await isSmartContract(account, provider)) {
      await approveErc20IfRequired({
        account,
        spender: loan.address,
        amount: value,
        erc20Contract: usdcContract,
      });
      const transaction =
        loan.__typename === "TranchedPool"
          ? tranchedPoolContract.deposit(TRANCHES.Junior, value)
          : callableLoanContract.deposit(
              await callableLoanContract.uncalledCapitalTrancheIndex(),
              value
            );
      submittedTransaction = await toastTransaction({
        transaction,
        pendingPrompt: `Deposit submitted for pool ${loan.address}.`,
      });
    } else {
      const now = (await provider.getBlock("latest")).timestamp;
      const chainId = await signer.getChainId();
      const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now
      const signature = await generateErc20PermitSignature({
        erc20TokenContract: usdcContract,
        chainId,
        owner: account,
        spender: loan.address,
        value,
        deadline,
      });

      const transaction =
        loan.__typename === "TranchedPool"
          ? tranchedPoolContract.depositWithPermit(
              TRANCHES.Junior,
              value,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
          : callableLoanContract.depositWithPermit(
              await callableLoanContract.uncalledCapitalTrancheIndex(),
              value,
              deadline,
              signature.v,
              signature.r,
              signature.s
            );
      submittedTransaction = await toastTransaction({
        transaction,
        pendingPrompt: `Deposit submitted for pool ${loan.address}.`,
      });
    }

    dataLayerPushEvent("DEPOSITED_IN_TRANCHED_POOL", {
      currency: "USD",
      transaction_id: submittedTransaction.transactionHash,
      value: parseFloat(data.supply),
      items: [{ item_id: loan.id, item_name: deal.name }],
    });

    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "poolTokens" });
      },
    });
  };

  const [availableBalance, setAvailableBalance] = useState(BigNumber.from(0));
  useEffect(() => {
    if (!account) {
      return;
    }
    getContract({ name: "USDC" })
      .then((usdcContract) => usdcContract.balanceOf(account))
      .then((balance) => setAvailableBalance(balance));
  }, [account]);

  return (
    <div>
      {!account ? (
        <Button
          className="block w-full"
          onClick={openWalletModal}
          size="xl"
          colorScheme="secondary"
        >
          Connect wallet
        </Button>
      ) : !isUserVerified ? (
        <Button
          className="block w-full"
          onClick={openVerificationModal}
          size="xl"
          colorScheme="secondary"
        >
          Verify my identity
        </Button>
      ) : !canUserParticipate ? (
        <div>
          <Button
            disabled
            className="block w-full"
            size="xl"
            colorScheme="mustard"
          >
            Invest
          </Button>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white">
            <Icon size="md" name="Exclamation" />
            <div>
              Sorry, you are not eligible to participate in this pool because
              you do not have a suitable UID.
            </div>
          </div>
        </div>
      ) : (
        <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
          <DollarInput
            control={control}
            name="supply"
            label="Investment amount"
            labelDecoration={
              <span className="text-xs">
                Balance:{" "}
                {formatCrypto(
                  { token: "USDC", amount: availableBalance },
                  { includeToken: true }
                )}
              </span>
            }
            rules={{ required: "Required", validate: validateMaximumAmount }}
            colorScheme="light"
            textSize="xl"
            maxValue={
              availableBalance.lt(remainingCapacity)
                ? availableBalance
                : remainingCapacity
            }
            className="mb-4"
            labelClassName="!text-sm !mb-3"
          />
          <Input
            {...register("backerName", { required: "Required" })}
            label="Full name"
            labelDecoration={
              <InfoIconTooltip
                size="sm"
                placement="top"
                content="Your full name as it appears on your government-issued identification. This should be the same as your full legal name used to register your UID."
              />
            }
            colorScheme="light"
            textSize="xl"
            className="mb-3"
            labelClassName="!text-sm !mb-3"
          />
          <Input
            {...register("email", {
              required: "Required",
              validate: (value) => (isEmail(value) ? true : "Invalid email"),
            })}
            label="Email"
            colorScheme="light"
            textSize="xl"
            className="mb-3"
            labelClassName="!text-sm !mb-3"
          />
          <div className="mb-3 text-xs">
            By clicking &ldquo;Submit&rdquo; below, I agree that I have read and
            agree to the{" "}
            {deal.agreement ? (
              <Link href={deal.agreement} openInNewTab>
                Facility Agreement
              </Link>
            ) : (
              "Facility Agreement"
            )}{" "}
            for this deal as well as the Goldfinch{" "}
            <Link href="/terms" openInNewTab>
              Terms and Conditions
            </Link>
            . I agree that the Facility Agreement shall constitute the
            controlling agreement with respect to the lending relationship
            between the Borrower and me. In the event there is any discrepancy
            or inconsistency between the Facility Agreement and any of the
            agreements related to this deal or Goldfinch, the terms contained in
            the Facility Agreement shall prevail.
          </div>
          <Button
            className="block w-full"
            size="xl"
            colorScheme="mustard"
            type="submit"
          >
            Invest
          </Button>
        </Form>
      )}
    </div>
  );
}
