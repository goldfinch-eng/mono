import { useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { BigNumber, FixedNumber, utils } from "ethers";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { IMaskInput } from "react-imask";
import { toast } from "react-toastify";

import { InfoIconTooltip, Link } from "@/components/design-system";
import { TRANCHES, USDC_DECIMALS } from "@/constants";
import { useTranchedPoolContract, useUsdcContract } from "@/lib/contracts";
import { formatPercent, formatDollarAmount, formatFiat } from "@/lib/format";
import { SupportedFiat } from "@/lib/graphql/generated";
import { openWalletModal } from "@/lib/state/actions";
import { waitForSubgraphBlock } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface SupplyPanelProps {
  tranchedPoolAddress: string;
  apy: FixedNumber;
  apyGfi: FixedNumber;
}

interface SupplyForm {
  supply: string;
}

export default function SupplyPanel({
  tranchedPoolAddress,
  apy,
  apyGfi,
}: SupplyPanelProps) {
  const apolloClient = useApolloClient();

  const { account, provider, chainId } = useWallet();
  const [apyEstimate, setApyEstimate] = useState(0);
  const [apyGfiEstimate, setApyGfiEstimate] = useState(0);

  const { tranchedPoolContract } = useTranchedPoolContract(tranchedPoolAddress);
  const { usdcContract } = useUsdcContract();

  const { handleSubmit, control, watch } = useForm<SupplyForm>();

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

    const domain = {
      name: await usdcContract.name(),
      version: chainId === 1 ? "2" : "1",
      chainId: chainId,
      verifyingContract: usdcContract.address,
    };
    const EIP712_DOMAIN_TYPE = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ];

    const value = utils.parseUnits(data.supply, USDC_DECIMALS);
    const now = (await provider.getBlock("latest")).timestamp;
    const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now
    const nonce = await usdcContract.nonces(account);
    const message = {
      owner: account,
      spender: tranchedPoolAddress,
      value: value.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    };
    const EIP2612_TYPE = [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ];

    const dataForSigning = JSON.stringify({
      types: {
        EIP712Domain: EIP712_DOMAIN_TYPE,
        Permit: EIP2612_TYPE,
      },
      domain,
      primaryType: "Permit",
      message,
    });

    const signature = await provider
      .send("eth_signTypedData_v4", [account, dataForSigning])
      .then(utils.splitSignature);

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

  useEffect(() => {
    if (supplyValue) {
      const s = parseFloat(supplyValue);
      setApyEstimate(s * apy.toUnsafeFloat());
      setApyGfiEstimate(s * apyGfi.toUnsafeFloat());
    } else {
      setApyEstimate(0);
      setApyGfiEstimate(0);
    }
  }, [supplyValue, apy, apyGfi]);

  return (
    <div className="rounded-xl bg-[#192852] bg-gradientRed p-5 text-white">
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

      <div className="mb-14 text-6xl font-medium">
        {formatPercent(apy.addUnsafe(apyGfi))}
      </div>

      <div className="mb-3 flex flex-row items-end justify-between">
        <span className="text-sm">Supply capital</span>
        {account && (
          <span className="text-xs opacity-60">
            {account.substring(0, 6)}...{account.substring(account.length - 4)}
            <span className=""></span>
          </span>
        )}
      </div>

      <div className="mb-6 rounded-lg bg-sky-900 p-1">
        {account ? (
          <form onSubmit={handleSubmit(onSubmit)}>
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
                    radix="."
                    unmask={true}
                    lazy={false}
                    ref={ref}
                    onAccept={onChange}
                    className="w-full bg-transparent py-4 pl-4 pr-16 text-2xl focus:ring-0"
                  />
                )}
              />

              <div className="absolute right-4 top-1/2 -translate-y-1/2 transform rounded-md border border-sky-500 px-2 py-1 text-[10px] uppercase">
                Max
              </div>
            </div>
            <button
              className={clsx(
                "block w-full rounded-md bg-white py-5 font-medium text-sky-700 hover:bg-sand-200 disabled:pointer-events-none disabled:opacity-60"
              )}
              disabled={!supplyValue}
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

      <table className="w-full">
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
              {formatPercent(apy)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {formatFiat({
                    symbol: SupportedFiat.Usd,
                    amount: apyEstimate,
                  })}
                </span>
                <Image
                  src="/ui/logo-usdc.png"
                  alt="USDC Logo"
                  width={20}
                  height={20}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">
              {formatPercent(apyGfi)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {formatDollarAmount(apyGfiEstimate)}
                </span>
                <Image
                  src="/ui/logo-gfi.png"
                  alt="GFI Logo"
                  width={20}
                  height={20}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
