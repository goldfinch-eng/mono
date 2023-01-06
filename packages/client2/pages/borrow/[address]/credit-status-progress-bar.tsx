import clsx from "clsx";

import { cryptoToFloat } from "@/lib/format";

interface CreditLineProgressBarProps {
  className?: string;
  balanceWithInterest: CryptoAmount;
  availableToDrawDown: CryptoAmount;
}

export function CreditLineProgressBar({
  className,
  balanceWithInterest,
  availableToDrawDown,
}: CreditLineProgressBarProps) {
  const balanceWithInterestFloat = cryptoToFloat(balanceWithInterest);
  const availableToDrawdownFloat = cryptoToFloat(availableToDrawDown);

  if (balanceWithInterestFloat <= 0 && availableToDrawdownFloat <= 0) {
    return null;
  }

  const progressBarSum = balanceWithInterestFloat + availableToDrawdownFloat;

  let balanceWithInterestBarStyle = "";
  let availableToDrawdownStyle = "";
  if (availableToDrawdownFloat > 0 && balanceWithInterestFloat > 0) {
    balanceWithInterestBarStyle = "rounded-tl-lg rounded-bl-lg";
    availableToDrawdownStyle = "rounded-tr-lg rounded-br-lg";
  } else if (availableToDrawdownFloat <= 0 && balanceWithInterestFloat > 0) {
    balanceWithInterestBarStyle = "rounded-lg";
  } else if (balanceWithInterestFloat <= 0 && availableToDrawdownFloat > 0) {
    availableToDrawdownStyle = "rounded-lg";
  }

  return (
    <div className={clsx("flex", className)}>
      <div
        className={clsx("h-3.5 bg-eggplant-700", balanceWithInterestBarStyle)}
        style={{
          width: `${(balanceWithInterestFloat / progressBarSum) * 100}%`,
        }}
      ></div>
      <div
        className={clsx("h-3.5 bg-mustard-400", availableToDrawdownStyle)}
        style={{
          width: `${(availableToDrawdownFloat / progressBarSum) * 100}%`,
        }}
      ></div>
    </div>
  );
}
