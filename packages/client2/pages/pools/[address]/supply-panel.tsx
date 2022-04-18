import { Icon } from "@/components/design-system/icon";
import { formatPercent } from "@/lib/format";

interface SupplyPanelProps {
  apy: number;
}

export default function SupplyPanel({ apy }: SupplyPanelProps) {
  return (
    <div className="sticky top-5 rounded-xl bg-[#192852] bg-gradientRed p-5 text-white">
      <div className="mb-3 flex flex-row items-center justify-between">
        <span className="text-sm">Est APY</span>
        <span className="opacity-60">
          <Icon name="InfoCircle" size="sm" />
        </span>
      </div>

      <div className="mb-14 text-6xl font-medium">{formatPercent(apy)}</div>

      <div className="mb-3 flex flex-row items-center justify-between">
        <span className="text-sm">Supply capital</span>
        <span className="text-xs opacity-60">0xiNju...1Kp8</span>
      </div>

      <div className="mb-6 rounded-lg bg-sky-900 p-1">
        <div className="relative">
          <input
            type="text"
            className="w-full bg-transparent py-4 pl-4 pr-16 text-2xl"
            placeholder="$0 USDC"
          />

          <div className="absolute right-4 top-1/2 -translate-y-1/2 transform rounded-md border border-sky-500 px-2 py-1 text-[10px] uppercase">
            Max
          </div>
        </div>
        <button className="block w-full rounded-md bg-white py-5 font-medium text-sky-700">
          Supply
        </button>
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
                  <Icon name="InfoCircle" size="sm" />
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">17.00% APY</td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              0
            </td>
          </tr>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">21.30% APY</td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              0
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
