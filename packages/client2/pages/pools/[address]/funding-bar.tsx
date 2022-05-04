import { BigNumber, utils } from "ethers";

import { USDC_DECIMALS } from "@/constants";
import { formatDollarAmount, usdcFromAtomic } from "@/lib/format";

interface FundingBarProps {
  goal?: BigNumber;
  backerSupply?: BigNumber;
  seniorSupply?: BigNumber;
}

export default function FundingBar({
  goal = BigNumber.from(0),
  backerSupply = BigNumber.from(0),
  seniorSupply = BigNumber.from(0),
}: FundingBarProps) {
  const goalFloat = parseFloat(utils.formatUnits(goal, USDC_DECIMALS));

  const backerSupplyFloat = parseFloat(
    utils.formatUnits(backerSupply, USDC_DECIMALS)
  );

  const seniorSupplyFloat = parseFloat(
    utils.formatUnits(seniorSupply, USDC_DECIMALS)
  );

  const backerWidth =
    goalFloat === 0 ? 0 : (backerSupplyFloat / goalFloat) * 100;
  const seniorWidth =
    goalFloat === 0 ? 0 : (seniorSupplyFloat / goalFloat) * 100;

  return (
    <div className="relative">
      <div
        className="mb-3 flex items-center justify-end text-sm text-sand-600"
        style={{
          marginRight: `${100 - backerWidth - seniorWidth}%`,
        }}
      >
        Supplied{" "}
        <span className="ml-3 inline-block text-base font-medium text-sand-700">
          {formatDollarAmount(backerSupplyFloat + seniorSupplyFloat)}
        </span>
      </div>
      <div className="relative mb-3 h-8 overflow-hidden rounded bg-sand-200 bg-diagonals bg-repeat">
        <div
          className="absolute left-0 top-0 bottom-0 w-full bg-[#D17673] transition-[max-width] duration-500"
          style={{
            maxWidth: `${backerWidth}%`,
          }}
        ></div>
        <div
          className="absolute top-0 bottom-0 w-full bg-[#3F4A7E] transition-[max-width] delay-500 duration-500"
          style={{
            left: `${backerWidth}%`,
            maxWidth: `${seniorWidth}%`,
          }}
        ></div>
      </div>
      <div className="flex items-center justify-end text-sm text-sand-600">
        Goal{" "}
        <span className="ml-3 inline-block text-base font-medium text-sand-700">
          ${usdcFromAtomic(goal)}
        </span>
      </div>
    </div>
  );
}
