import clsx from "clsx";
import { BigNumber } from "ethers";

import { cryptoToFloat } from "@/lib/format";

interface CreditStatusProgressBarProps {
  className?: string;
  balanceWithInterest: BigNumber;
  availableToDrawDown: BigNumber;
}

export function CreditStatusProgressBar({
  className,
  balanceWithInterest,
  availableToDrawDown,
}: CreditStatusProgressBarProps) {
  if (balanceWithInterest.lte(0) && availableToDrawDown.lte(0)) {
    return null;
  }

  const balanceWithInterestFloat = cryptoToFloat({
    amount: balanceWithInterest,
    token: "USDC",
  });
  const availableToDrawdownFloat = cryptoToFloat({
    amount: availableToDrawDown,
    token: "USDC",
  });
  const progressBarSum = cryptoToFloat({
    amount: balanceWithInterest.add(availableToDrawDown),
    token: "USDC",
  });

  let balanceWithInterestBarStyle = "rounded-tl-lg rounded-bl-lg";
  let availableToDrawdownStyle = "rounded-tr-lg rounded-br-lg";
  if (availableToDrawdownFloat === 0) {
    balanceWithInterestBarStyle = "rounded-lg";
    availableToDrawdownStyle = "";
  } else if (balanceWithInterestFloat === 0) {
    balanceWithInterestBarStyle = "";
    availableToDrawdownStyle = "rounded-lg";
  }

  return (
    <div className={clsx("flex", className)}>
      <div
        className={clsx("h-3.5 bg-sand-700", balanceWithInterestBarStyle)}
        style={{
          width: `${(balanceWithInterestFloat / progressBarSum) * 100}%`,
        }}
      />
      <div
        className={clsx("h-3.5 bg-mustard-400", availableToDrawdownStyle)}
        style={{
          width: `${(availableToDrawdownFloat / progressBarSum) * 100}%`,
        }}
      />
    </div>
  );
}
