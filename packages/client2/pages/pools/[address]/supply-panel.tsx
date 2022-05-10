import clsx from "clsx";
import { FixedNumber } from "ethers";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { IMaskInput } from "react-imask";

import { InfoIconTooltip } from "@/components/design-system";
import { formatPercent, formatDollarAmount } from "@/lib/format";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

interface SupplyPanelProps {
  apy?: FixedNumber;
  apyGfi?: FixedNumber;
}

interface SupplyForm {
  supply: string;
}

export default function SupplyPanel({ apy, apyGfi }: SupplyPanelProps) {
  const { account } = useWallet();
  const [apyEstimate, setApyEstimate] = useState(0);
  const [apyGfiEstimate, setApyGfiEstimate] = useState(0);

  const { handleSubmit, control, watch } = useForm<SupplyForm>();

  const onSubmit = (data: SupplyForm) => {
    // eslint-disable-next-line
    console.log(data);

    // TODO
  };

  const supplyValue = watch("supply");

  useEffect(() => {
    if (supplyValue) {
      const s = parseFloat(supplyValue);

      if (apy) {
        setApyEstimate(s * apy.toUnsafeFloat());
      } else {
        setApyEstimate(0);
      }

      if (apyGfi) {
        setApyGfiEstimate(s * apyGfi.toUnsafeFloat());
      } else {
        setApyGfiEstimate(0);
      }
    } else {
      setApyEstimate(0);
      setApyGfiEstimate(0);
    }
  }, [supplyValue, apy, apyGfi]);

  return (
    <div className="sticky top-5 rounded-xl bg-[#192852] bg-gradientRed p-5 text-white">
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
        {formatPercent(apy?.addUnsafe(apyGfi || FixedNumber.from(0)) || 0)}
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
                "block w-full rounded-md bg-white py-5 font-medium text-sky-700",
                !supplyValue ? "opacity-60" : "opacity-100"
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
              {formatPercent(apy || 0)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">{formatDollarAmount(apyEstimate)}</span>
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
              {formatPercent(apyGfi || 0)} APY
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
