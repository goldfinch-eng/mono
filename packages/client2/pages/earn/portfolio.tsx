import { BigNumber } from "ethers";

import { formatCrypto } from "@/lib/format";
import { CryptoAmount, SupportedCrypto } from "@/lib/graphql/generated";
import { sharesToUsdc } from "@/lib/pools";

interface PortfolioProps {
  /**
   * AKA `numShares` of the Senior Pool
   */
  fiduBalance?: CryptoAmount;
  seniorPoolSharePrice: BigNumber;
}

export function Portfolio({
  fiduBalance = { token: SupportedCrypto.Fidu, amount: BigNumber.from(0) },
  seniorPoolSharePrice,
}: PortfolioProps) {
  const unstakedSeniorPoolBalance = sharesToUsdc(
    fiduBalance.amount,
    seniorPoolSharePrice
  );

  return (
    <div className="rounded-xl border border-sand-200 p-8 text-center">
      <div>
        <div className="mb-5 text-lg text-sand-700">Portfolio Balance</div>
        <div className="font-serif text-5xl font-semibold text-sand-800">
          {formatCrypto(unstakedSeniorPoolBalance, { includeSymbol: true })}
        </div>
        <div>420.69%</div>
      </div>
      <hr className="my-8 border-t border-sand-200" />
      <div>
        <div className="mb-5 text-lg text-sand-700">Est. Annual Growth</div>
        <div className="font-serif text-5xl font-semibold text-sand-800">
          $0000.00
        </div>
        <div>420.69%</div>
      </div>
    </div>
  );
}
