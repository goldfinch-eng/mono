import { useApolloClient, gql } from "@apollo/client";
import { BigNumber, FixedNumber, utils } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  DollarInput,
  Form,
  Icon,
  InfoIconTooltip,
  Input,
  Link,
  Select,
  Tooltip,
} from "@/components/design-system";
import { TRANCHES, USDC_DECIMALS } from "@/constants";
import { generateErc20PermitSignature, useContract } from "@/lib/contracts";
import { formatPercent, formatFiat, formatCrypto } from "@/lib/format";
import {
  SupportedFiat,
  SupplyPanelTranchedPoolFieldsFragment,
  SupplyPanelUserFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import {
  approveErc20IfRequired,
  canUserParticipateInPool,
  computeApyFromGfiInFiat,
  sharesToUsdc,
  signAgreement,
  usdcWithinEpsilon,
} from "@/lib/pools";
import { openWalletModal, openVerificationModal } from "@/lib/state/actions";
import { toastTransaction } from "@/lib/toast";
import { abbreviateAddress, isSmartContract, useWallet } from "@/lib/wallet";

export const SUPPLY_PANEL_TRANCHED_POOL_FIELDS = gql`
  fragment SupplyPanelTranchedPoolFields on TranchedPool {
    id
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    agreement @client
    remainingJuniorCapacity
    estimatedLeverageRatio
    allowedUidTypes
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
    # Need this for zapping
    seniorPoolStakedPositions {
      id
      amount
    }
  }
`;

interface SupplyPanelProps {
  tranchedPool: SupplyPanelTranchedPoolFieldsFragment;
  user: SupplyPanelUserFieldsFragment | null;
  fiatPerGfi: number;
  seniorPoolApyFromGfiRaw: FixedNumber;
  /**
   * This is necessary for zapping functionality. Senior pool staked position amounts are measured in FIDU, but we need to show the amounts to users in USDC.
   */
  seniorPoolSharePrice: BigNumber;
}

interface SupplyForm {
  supply: string;
  backerName: string;
  source: string;
}

export default function SupplyPanel({
  tranchedPool: {
    id: tranchedPoolAddress,
    estimatedJuniorApy,
    estimatedJuniorApyFromGfiRaw,
    agreement,
    remainingJuniorCapacity,
    allowedUidTypes,
  },
  user,
  fiatPerGfi,
  seniorPoolApyFromGfiRaw,
  seniorPoolSharePrice,
}: SupplyPanelProps) {
  const apolloClient = useApolloClient();
  const { account, provider } = useWallet();
  const tranchedPoolContract = useContract("TranchedPool", tranchedPoolAddress);
  const usdcContract = useContract("USDC");
  const zapperContract = useContract("Zapper");
  const stakingRewardsContract = useContract("StakingRewards");

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

  const rhfMethods = useForm<SupplyForm>({
    defaultValues: { source: "wallet" },
  });
  const { control, watch, register, setValue } = rhfMethods;

  const handleMax = async () => {
    if (!account || !usdcContract) {
      return;
    }
    const userUsdcBalance = availableBalance;
    const maxAvailable = userUsdcBalance.lt(remainingJuniorCapacity)
      ? userUsdcBalance
      : remainingJuniorCapacity;
    setValue(
      "supply",
      formatCrypto(
        { token: SupportedCrypto.Usdc, amount: maxAvailable },
        { includeSymbol: false }
      )
    );
  };

  const validateMaximumAmount = async (value: string) => {
    if (!account || !usdcContract) {
      return;
    }
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);
    if (valueAsUsdc.gt(remainingJuniorCapacity)) {
      return "Amount exceeds remaining junior capacity";
    }
    if (valueAsUsdc.lte(BigNumber.from(0))) {
      return "Must deposit more than 0";
    }
    if (
      valueAsUsdc.gt(availableBalance) &&
      !usdcWithinEpsilon(valueAsUsdc, availableBalance)
    ) {
      return "Amount exceeds USDC balance";
    }
  };

  const onSubmit = async (data: SupplyForm) => {
    if (!usdcContract || !provider || !account) {
      throw new Error("Wallet not connected properly");
    }

    await signAgreement(account, data.backerName, tranchedPoolAddress);

    // Ensures the user doesn't leave any dust behind when they choose to supply max
    let value = utils.parseUnits(data.supply, USDC_DECIMALS);
    if (usdcWithinEpsilon(value, availableBalance)) {
      value = availableBalance;
    }

    if (data.source === "wallet") {
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
        await toastTransaction({
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
        await toastTransaction({
          transaction,
          pendingPrompt: `Deposit submitted for pool ${tranchedPoolAddress}.`,
        });
      }
    } else {
      if (!zapperContract || !stakingRewardsContract) {
        throw new Error("Wallet not connected properly");
      }

      const stakedPositionId = BigNumber.from(data.source.split("-")[1]);
      const tranche = BigNumber.from(2); // TODO this is really lazy. With multi-sliced pools this needs to be dynamic

      const isAlreadyApproved = await stakingRewardsContract.isApprovedForAll(
        account,
        zapperContract.address
      );
      if (!isAlreadyApproved) {
        const approval = await stakingRewardsContract.setApprovalForAll(
          zapperContract.address,
          true
        );
        await approval.wait();
      }
      const transaction = zapperContract.zapStakeToTranchedPool(
        stakedPositionId,
        tranchedPoolAddress,
        tranche,
        value
      );
      await toastTransaction({
        transaction,
        pendingPrompt: `Zapping your senior pool position to ${tranchedPoolAddress}.`,
      });
    }
    await apolloClient.refetchQueries({ include: "active" });
  };

  const supplyValue = watch("supply");
  const selectedSource = watch("source");
  const [availableBalance, setAvailableBalance] = useState(BigNumber.from(0));
  useEffect(() => {
    if (!usdcContract || !account) {
      return;
    }
    if (selectedSource === "wallet") {
      usdcContract
        .balanceOf(account)
        .then((balance) => setAvailableBalance(balance));
    } else if (selectedSource.startsWith("seniorPool")) {
      const id = selectedSource.split("-")[1];
      const seniorPoolPosition = user?.seniorPoolStakedPositions.find(
        (s) => s.id === id
      );
      if (!seniorPoolPosition) {
        return;
      }
      setAvailableBalance(
        sharesToUsdc(seniorPoolPosition.amount, seniorPoolSharePrice).amount
      );
    }
  }, [selectedSource, usdcContract, account, user, seniorPoolSharePrice]);
  const fiatApyFromGfi = computeApyFromGfiInFiat(
    estimatedJuniorApyFromGfiRaw,
    fiatPerGfi
  );
  const seniorPoolApyFromGfiFiat = computeApyFromGfiInFiat(
    seniorPoolApyFromGfiRaw,
    fiatPerGfi
  );
  const totalApyFromGfi = fiatApyFromGfi.addUnsafe(seniorPoolApyFromGfiFiat);

  const availableSources = useMemo(() => {
    const walletOption = [
      {
        label: `Wallet \u00b7 ${abbreviateAddress(account ?? "")}`,
        value: "wallet",
      },
    ];
    const zappableOptions = user?.seniorPoolStakedPositions
      ? user.seniorPoolStakedPositions.map((s, index) => ({
          label: `Senior Pool Position ${index + 1} \u00b7 ${formatCrypto(
            sharesToUsdc(s.amount, seniorPoolSharePrice)
          )}`,
          value: `seniorPool-${s.id}`,
        }))
      : [];
    return walletOption.concat(zappableOptions);
  }, [user, account, seniorPoolSharePrice]);

  return (
    <div className="rounded-xl bg-sunrise-02 p-5 text-white">
      <div className="mb-3 flex flex-row justify-between">
        <span className="text-sm">Est. APY</span>
        <InfoIconTooltip
          size="sm"
          content="The pool's total estimated APY, including the USDC APY and est. GFI rewards APY."
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
                        symbol: SupportedFiat.Usd,
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
                        symbol: SupportedFiat.Usd,
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
          <Select
            control={control}
            name="source"
            label="Source"
            options={availableSources}
            colorScheme="dark"
            textSize="xl"
            labelClassName="!text-sm !mb-3"
            className={availableSources.length > 1 ? "mb-4" : "hidden"}
          />
          <DollarInput
            control={control}
            name="supply"
            label="Supply amount"
            labelDecoration={
              <span className="text-xs">
                Balance:{" "}
                {formatCrypto(
                  { token: SupportedCrypto.Usdc, amount: availableBalance },
                  { includeToken: true }
                )}
              </span>
            }
            rules={{ required: "Required", validate: validateMaximumAmount }}
            colorScheme="dark"
            textSize="xl"
            onMaxClick={handleMax}
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
              <Link href={agreement}>Loan Agreement</Link>
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
