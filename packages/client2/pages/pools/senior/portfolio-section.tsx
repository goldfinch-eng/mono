import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState } from "react";

import { Button, Modal } from "@/components/design-system";
import { formatPercent, formatUsdcAsDollars } from "@/lib/format";
import {
  SeniorPoolPortfolioUserFieldsFragment,
  SeniorPoolPortfolioPoolFieldsFragment,
} from "@/lib/graphql/generated";

import { DepositForm } from "./deposit-form";

export const SENIOR_POOL_PORTFOLIO_USER_FIELDS = gql`
  fragment SeniorPoolPortfolioUserFields on User {
    id
    seniorPoolDeposits {
      amount
    }
  }
`;

export const SENIOR_POOL_PORTFOLIO_POOL_FIELDS = gql`
  fragment SeniorPoolPortfolioPoolFields on SeniorPool {
    latestPoolStatus {
      id
      estimatedApy
    }
  }
`;

interface PortfolioSectionProps {
  user?: SeniorPoolPortfolioUserFieldsFragment | null;
  seniorPool?: SeniorPoolPortfolioPoolFieldsFragment;
}

export function PortfolioSection({ user, seniorPool }: PortfolioSectionProps) {
  const [isDepositFormOpen, setIsDepositFormOpen] = useState(false);
  const isGreyedOut = !user;
  const portfolioBalance = user?.seniorPoolDeposits
    .map((d) => d.amount)
    .reduce((prev, current) => current.add(prev), BigNumber.from(0));

  return (
    <div className="rounded bg-sand-100 p-6">
      <div className="flex flex-wrap justify-evenly gap-4">
        <div className="flex flex-col items-center">
          <div>Portfolio Balance</div>
          <div className="text-4xl tabular-nums">
            {portfolioBalance ? formatUsdcAsDollars(portfolioBalance) : "$0.00"}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div>Est. Annual Growth</div>
          <div className="text-4xl tabular-nums">$0.00</div>
          <div>
            {seniorPool
              ? formatPercent(seniorPool?.latestPoolStatus.estimatedApy)
              : "-.--"}{" "}
            APY
          </div>
        </div>
      </div>
      <hr className="my-4" />
      <div className="flex flex-wrap gap-4">
        <Button
          size="xl"
          className="grow"
          iconLeft="ArrowUp"
          disabled={isGreyedOut}
          onClick={() => setIsDepositFormOpen(true)}
        >
          Supply
        </Button>
        <Button
          size="xl"
          className="grow"
          iconLeft="ArrowDown"
          disabled={isGreyedOut}
        >
          Withdraw
        </Button>
      </div>
      <Modal
        title="Deposit into the Senior Pool"
        size="sm"
        isOpen={isDepositFormOpen}
        onClose={() => setIsDepositFormOpen(false)}
      >
        <DepositForm
          onTransactionSubmitted={() => {
            setIsDepositFormOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
