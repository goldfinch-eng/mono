import { useApolloClient, gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber, utils } from "ethers";
import { useForm, Controller } from "react-hook-form";
import { IMaskInput } from "react-imask";
import { toast } from "react-toastify";

import { Icon, InfoIconTooltip, Link } from "@/components/design-system";
import { TRANCHES, USDC_DECIMALS } from "@/constants";
import {
  useTranchedPoolContract,
  useUsdcContract,
  generateErc20PermitSignature,
} from "@/lib/contracts";
import { formatPercent, formatFiat } from "@/lib/format";
import {
  SupportedFiat,
  SupplyPanelFieldsFragment,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";
import { openWalletModal } from "@/lib/state/actions";
import { waitForSubgraphBlock } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

export const SUPPLY_PANEL_FIELDS = gql`
  fragment SupplyPanelFields on TranchedPool {
    id
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    agreement @client
  }
`;
interface SupplyPanelProps {
  tranchedPool: SupplyPanelFieldsFragment;
  fiatPerGfi: number;
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
    agreement,
  },
  fiatPerGfi,
}: SupplyPanelProps) {
  const apolloClient = useApolloClient();

  const { account, provider, chainId } = useWallet();

  const { tranchedPoolContract } = useTranchedPoolContract(tranchedPoolAddress);
  const { usdcContract } = useUsdcContract();

  const { handleSubmit, control, watch, register } = useForm<SupplyForm>();

  const onSubmit = async (data: SupplyForm) => {
    if (
      !usdcContract ||
      !tranchedPoolContract ||
      !provider ||
      !account ||
      !chainId
    ) {
      throw new Error("Wallet not connected properly");
    }

    const value = utils.parseUnits(data.supply, USDC_DECIMALS);
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

    const transaction = await tranchedPoolContract.depositWithPermit(
      TRANCHES.Junior,
      value,
      deadline,
      signature.v,
      signature.r,
      signature.s
    );
    const toastId = toast(
      <div>
        Deposit submitted for pool {tranchedPoolAddress}, view it on{" "}
        <Link href={`https://etherscan.io/tx/${transaction.hash}`}>
          etherscan.io
        </Link>
      </div>,
      { autoClose: false }
    );
    const receipt = await transaction.wait();
    await waitForSubgraphBlock(receipt.blockNumber);
    await apolloClient.refetchQueries({ include: "active" });
    toast.update(toastId, {
      render: `Deposit into pool ${tranchedPoolAddress} succeeded`,
      type: "success",
      autoClose: 5000,
    });
  };

  const supplyValue = watch("supply");
  const backerName = watch("backerName");
  const fiatApyFromGfi = computeApyFromGfiInFiat(
    estimatedJuniorApyFromGfiRaw,
    fiatPerGfi
  );

  return (
    <div className="rounded-xl bg-sunrise-02 p-5 text-white">
      <div className="mb-3 flex flex-row justify-between">
        <span className="text-sm">Est APY</span>
        <span className="opacity-60">
          <InfoIconTooltip
            size="sm"
            content={
              <div className="max-w-xs">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                Officia culpa possimus accusantium cumque suscipit.
              </div>
            }
          />
        </span>
      </div>

      <div className="mb-8 text-6xl font-medium">
        {formatPercent(estimatedJuniorApy.addUnsafe(fiatApyFromGfi))}
      </div>

      <table className="mb-8 w-full">
        <thead>
          <tr>
            <th className="w-1/2 pb-3 text-left text-sm font-normal">
              Est APY breakdown
            </th>
            <th className="w-1/2 pb-3 text-left text-sm font-normal">
              <div className="flex items-center justify-between">
                <span>Est return</span>
                <span className="opacity-60">
                  <InfoIconTooltip
                    size="sm"
                    content={
                      <div className="max-w-xs">
                        Lorem ipsum dolor sit amet, consectetur adipisicing
                        elit. Officia culpa possimus accusantium cumque
                        suscipit.
                      </div>
                    }
                  />
                </span>
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
                  {formatFiat({
                    symbol: SupportedFiat.Usd,
                    amount: supplyValue
                      ? parseFloat(supplyValue) *
                        estimatedJuniorApy.toUnsafeFloat()
                      : 0,
                  })}
                </span>
                <Icon name="Usdc" aria-label="USDC logo" size="md" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">
              {formatPercent(fiatApyFromGfi)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {formatFiat({
                    symbol: SupportedFiat.Usd,
                    amount: supplyValue
                      ? parseFloat(supplyValue) * fiatApyFromGfi.toUnsafeFloat()
                      : 0,
                  })}
                </span>
                <Icon name="Gfi" aria-label="GFI logo" size="md" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {account ? (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <div className="mb-3 flex flex-row items-end justify-between">
              <label htmlFor="supply" className="text-sm">
                Supply amount
              </label>
              <span className="text-xs opacity-60">
                {account.substring(0, 6)}...
                {account.substring(account.length - 4)}
              </span>
            </div>
            <div className="relative">
              <Controller
                control={control}
                name="supply"
                rules={{ required: "Required" }}
                render={({ field: { onChange, ref } }) => (
                  <IMaskInput
                    mask="$amount USDC"
                    blocks={{
                      amount: {
                        mask: Number,
                        thousandsSeparator: ",",
                        placeholderChar: "9",
                        lazy: false,
                        scale: 2,
                        radix: ".",
                      },
                    }}
                    id="supply"
                    radix="."
                    unmask={true}
                    lazy={false}
                    ref={ref}
                    onAccept={onChange}
                    className="mb-4 w-full rounded bg-sky-900 py-4 pl-5 pr-16 text-2xl"
                  />
                )}
              />

              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-3/4 transform rounded-md border border-sky-500 px-2 py-1 text-[10px] uppercase"
              >
                Max
              </button>
            </div>
          </div>
          <div className={!supplyValue ? "hidden" : undefined}>
            <div className="mb-3">
              <label htmlFor="backerName" className="mb-3 block w-max text-sm">
                Full legal name
              </label>
              <input
                id="backerName"
                {...register("backerName")}
                className="w-full rounded bg-sky-900 py-4 px-5 text-2xl"
                placeholder="First and last name"
              />
            </div>
            <div className="mb-3 text-xs">
              By entering my name and clicking “Supply” below, I hereby agree
              and acknowledge that (i) I am electronically signing and becoming
              a party to the{" "}
              {agreement ? (
                <Link href={agreement}>Loan Agreement</Link>
              ) : (
                "Loan Agreement"
              )}{" "}
              for this pool, and (ii) my name and transaction information may be
              shared with the borrower.
            </div>
          </div>
          <button
            className={clsx(
              "block w-full rounded-md bg-white py-5 font-medium text-sky-700 hover:bg-sand-200 disabled:pointer-events-none disabled:opacity-60"
            )}
            disabled={!supplyValue || !backerName}
            type="submit"
          >
            Supply
          </button>
        </form>
      ) : (
        <button
          className="block w-full rounded-md bg-white py-5 font-medium text-sky-700"
          onClick={openWalletModal}
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}
