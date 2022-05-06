import clsx from "clsx";
import { BigNumber } from "ethers";

import { cryptoToFloat, formatCrypto, formatFiat } from "@/lib/format";
import {
  CryptoAmount,
  SupportedCrypto,
  SupportedFiat,
} from "@/lib/graphql/generated";

interface FundingBarProps {
  goal?: CryptoAmount;
  backerSupply?: CryptoAmount;
  seniorSupply?: CryptoAmount;
}

const zeroUsdc = { token: SupportedCrypto.Usdc, amount: BigNumber.from(0) };

export default function FundingBar({
  goal = zeroUsdc,
  backerSupply = zeroUsdc,
  seniorSupply = zeroUsdc,
}: FundingBarProps) {
  const goalFloat = cryptoToFloat(goal);
  const backerSupplyFloat = cryptoToFloat(backerSupply);
  const seniorSupplyFloat = cryptoToFloat(seniorSupply);

  const backerWidth =
    goalFloat === 0 ? 0 : (backerSupplyFloat / goalFloat) * 100;
  const seniorWidth =
    goalFloat === 0 ? 0 : (seniorSupplyFloat / goalFloat) * 100;

  return (
    <div className="relative">
      <div
        className={clsx(
          "mb-3 flex items-center text-sm text-sand-600",
          backerWidth + seniorWidth < 50 ? "justify-start" : "justify-end"
        )}
        style={
          backerWidth + seniorWidth < 50
            ? { marginLeft: `${Math.min(backerWidth + seniorWidth, 50)}%` }
            : {
                marginRight: `${Math.min(
                  100 - backerWidth - seniorWidth,
                  50
                )}%`,
              }
        }
      >
        Supplied{" "}
        <span className="ml-3 inline-block text-base font-medium text-sand-700">
          {formatFiat({
            symbol: SupportedFiat.Usd,
            amount: backerSupplyFloat + seniorSupplyFloat,
          })}
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
          {formatCrypto(goal, { includeSymbol: true })}
        </span>
      </div>
    </div>
  );
}
