import { useApolloClient, gql } from "@apollo/client";
import { BigNumber, FixedNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  DollarInput,
  Form,
  Icon,
  InfoIconTooltip,
  Input,
  Link,
  Tooltip,
} from "@/components/design-system";
import { TRANCHES, USDC_DECIMALS } from "@/constants";
import { dataLayerPushEvent } from "@/lib/analytics";
import { generateErc20PermitSignature, getContract } from "@/lib/contracts";
import { formatPercent, formatFiat, formatCrypto } from "@/lib/format";
import {
  SupplyPanelTranchedPoolFieldsFragment,
  SupplyPanelUserFieldsFragment,
} from "@/lib/graphql/generated";
import {
  approveErc20IfRequired,
  canUserParticipateInPool,
  computeApyFromGfiInFiat,
  signAgreement,
  usdcWithinEpsilon,
} from "@/lib/pools";
import { openWalletModal, openVerificationModal } from "@/lib/state/actions";
import { toastTransaction } from "@/lib/toast";
import { isSmartContract, useWallet } from "@/lib/wallet";

export const SUPPLY_PANEL_TRANCHED_POOL_FIELDS = gql`
  fragment SupplyPanelTranchedPoolFields on TranchedPool {
    id
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    juniorDeposited
    estimatedLeverageRatio
    allowedUidTypes
    creditLine {
      maxLimit
    }
  }
`;

export const SUPPLY_PANEL_USER_FIELDS = gql`
  fragment SupplyPanelUserFields on User {
    id
    isUsEntity
    isNonUsEntity
    isUsAccreditedIndividual
    isUsNonAccreditedIndividual
    isNonUsIndividual
    isGoListed
  }
`;

interface SupplyPanelProps {
  tranchedPool: SupplyPanelTranchedPoolFieldsFragment;
  user: SupplyPanelUserFieldsFragment | null;
  fiatPerGfi: number;
  seniorPoolApyFromGfiRaw: FixedNumber;
  agreement?: string | null;
  isUnitrancheDeal?: boolean;
}

interface SupplyForm {
  supply: string;
  backerName: string;
}

export default function SupplyPanel({
  tranchedPool: {
    id: tranchedPoolAddress,
    estimatedJuniorApy,
    estimatedJuniorApyFromGfiRaw,
    juniorDeposited,
    estimatedLeverageRatio,
    allowedUidTypes,
    creditLine: { maxLimit },
  },
  user,
  fiatPerGfi,
  seniorPoolApyFromGfiRaw,
  agreement,
  isUnitrancheDeal = false,
}: SupplyPanelProps) {
  const apolloClient = useApolloClient();
  const { account, provider } = useWallet();

  const isUserVerified =
    user?.isGoListed ||
    user?.isUsEntity ||
    user?.isNonUsEntity ||
    user?.isUsAccreditedIndividual ||
    user?.isUsNonAccreditedIndividual ||
    user?.isNonUsIndividual;

  const canUserParticipate = user
    ? canUserParticipateInPool(allowedUidTypes, user)
    : false;

  const rhfMethods = useForm<SupplyForm>();
  const { control, watch, register } = rhfMethods;

  const remainingJuniorCapacity =
    isUnitrancheDeal || !estimatedLeverageRatio
      ? maxLimit.sub(juniorDeposited)
      : maxLimit
          .sub(
            juniorDeposited.mul(
              utils.parseUnits(estimatedLeverageRatio.toString(), 0).add(1)
            )
          )
          .div(utils.parseUnits(estimatedLeverageRatio.toString(), 0).add(1));

  const validateMaximumAmount = async (value: string) => {
    if (!account) {
      return;
    }
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);
    if (valueAsUsdc.gt(remainingJuniorCapacity)) {
      return "Amount exceeds remaining junior capacity";
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
    if (!provider || !account) {
      throw new Error("Wallet not connected properly");
    }

    await signAgreement(account, data.backerName, tranchedPoolAddress);

    // Ensures the user doesn't leave any dust behind when they choose to supply max
    let value = utils.parseUnits(data.supply, USDC_DECIMALS);
    if (usdcWithinEpsilon(value, availableBalance)) {
      value = availableBalance;
    }

    let submittedTransaction;

    const usdcContract = await getContract({ name: "USDC", provider });
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      address: tranchedPoolAddress,
    });
    if (!tranchedPoolContract) {
      throw new Error("Wallet not connected properly");
    }
    if (await isSmartContract(account, provider)) {
      await approveErc20IfRequired({
        account,
        spender: tranchedPoolAddress,
        amount: value,
        erc20Contract: usdcContract,
      });
      submittedTransaction = await toastTransaction({
        transaction: tranchedPoolContract.deposit(TRANCHES.Junior, value),
        pendingPrompt: `Deposit submitted for pool ${tranchedPoolAddress}.`,
      });
    } else {
      const now = (await provider.getBlock("latest")).timestamp;
      const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now
      const signature = await generateErc20PermitSignature({
        erc20TokenContract: usdcContract,
        provider,
        owner: account,
        spender: tranchedPoolAddress,
        value,
        deadline,
      });

      const transaction = tranchedPoolContract.depositWithPermit(
        TRANCHES.Junior,
        value,
        deadline,
        signature.v,
        signature.r,
        signature.s
      );
      submittedTransaction = await toastTransaction({
        transaction,
        pendingPrompt: `Deposit submitted for pool ${tranchedPoolAddress}.`,
      });
    }

    dataLayerPushEvent("DEPOSITED_IN_TRANCHED_POOL", {
      transactionHash: submittedTransaction.transactionHash,
      tranchedPoolAddress,
      usdAmount: parseFloat(data.supply),
    });

    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "tranchedPoolTokens" });
      },
    });
  };

  const supplyValue = watch("supply");
  const [availableBalance, setAvailableBalance] = useState(BigNumber.from(0));
  useEffect(() => {
    if (!account || !provider) {
      return;
    }
    getContract({ name: "USDC", provider })
      .then((usdcContract) => usdcContract.balanceOf(account))
      .then((balance) => setAvailableBalance(balance));
  }, [account, provider, user]);
  const fiatApyFromGfi = computeApyFromGfiInFiat(
    estimatedJuniorApyFromGfiRaw,
    fiatPerGfi
  );
  const seniorPoolApyFromGfiFiat = computeApyFromGfiInFiat(
    seniorPoolApyFromGfiRaw,
    fiatPerGfi
  );
  const totalApyFromGfi = fiatApyFromGfi.addUnsafe(seniorPoolApyFromGfiFiat);

  return (
    <div className="rounded-xl bg-sunrise-02 p-5 text-white">
      <div className="mb-3 flex flex-row justify-between">
        <span className="text-sm">Est. APY</span>
        <InfoIconTooltip
          size="sm"
          content={
            <div className="max-w-xs">
              The Pool&rsquo;s total current estimated APY, including the
              current USDC APY and est. GFI rewards APY. The GFI rewards APY is
              volatile and changes based on several variables including the
              price of GFI, the total capital deployed on Goldfinch, and Senior
              Pool&rsquo;s utilization. Learn more in the{" "}
              <Link
                href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/backer-incentives"
                openInNewTab
              >
                Goldfinch Documentation
              </Link>
              .
            </div>
          }
        />
      </div>

      <div className="mb-8 text-6xl font-medium">
        {formatPercent(estimatedJuniorApy.addUnsafe(totalApyFromGfi))}
      </div>

      <table className="mb-8 w-full">
        <thead>
          <tr>
            <th className="w-1/2 pb-3 text-left text-sm font-normal">
              Est. APY breakdown
            </th>
            <th className="w-1/2 pb-3 text-left text-sm font-normal">
              <div className="flex items-center justify-end gap-2">
                <span>Est. return</span>
                <InfoIconTooltip
                  size="sm"
                  content="The estimated annual return on investment based on the supply amount entered below. The USDC returns are based on the fixed-rate USDC APY defined by the Borrower Pool's financing terms. The GFI returns are based on the Pool's estimated GFI rewards APY, including Investor Rewards and the Backer Bonus."
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">
              {formatPercent(estimatedJuniorApy)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {supplyValue
                    ? formatFiat({
                        symbol: "USD",
                        amount:
                          parseFloat(supplyValue) *
                          estimatedJuniorApy.toUnsafeFloat(),
                      })
                    : "USDC"}
                </span>
                <Icon name="Usdc" aria-label="USDC logo" size="md" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">
              {formatPercent(totalApyFromGfi)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {supplyValue
                    ? formatFiat({
                        symbol: "USD",
                        amount:
                          parseFloat(supplyValue) *
                          totalApyFromGfi.toUnsafeFloat(),
                      })
                    : "GFI"}
                </span>
                <Tooltip
                  content="This return is estimated based on the current value of GFI in US dollars."
                  placement="top"
                  useWrapper
                >
                  <Icon name="Gfi" aria-label="GFI logo" size="md" />
                </Tooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

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
            colorScheme="secondary"
          >
            Supply
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
            label="Supply amount"
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
            colorScheme="dark"
            textSize="xl"
            maxValue={
              availableBalance.lt(remainingJuniorCapacity)
                ? availableBalance
                : remainingJuniorCapacity
            }
            className="mb-4"
            labelClassName="!text-sm !mb-3"
          />
          <Input
            {...register("backerName", { required: "Required" })}
            label="Full legal name"
            labelDecoration={
              <InfoIconTooltip
                size="sm"
                placement="top"
                content="Your full name as it appears on your government-issued identification. This should be the same as your full legal name used to register your UID."
              />
            }
            placeholder="First and last name"
            colorScheme="dark"
            textSize="xl"
            className="mb-3"
            labelClassName="!text-sm !mb-3"
          />
          <div className="mb-3 text-xs">
            By entering my name and clicking “Supply” below, I hereby agree and
            acknowledge that (i) I am electronically signing and becoming a
            party to the{" "}
            {agreement ? (
              <Link href={agreement} target="_blank" rel="noreferrer">
                Loan Agreement
              </Link>
            ) : (
              "Loan Agreement"
            )}{" "}
            for this pool, and (ii) my name and transaction information may be
            shared with the borrower.
          </div>
          <Button
            className="block w-full"
            size="xl"
            colorScheme="secondary"
            type="submit"
          >
            Supply
          </Button>
        </Form>
      )}
    </div>
  );
}
