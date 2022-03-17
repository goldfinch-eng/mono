import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState } from "react";

import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { formatPercent, formatUsdc } from "@/lib/format";
import { useSeniorPoolPortfolioQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import { DepositForm } from "./deposit-form";

gql`
  query SeniorPoolPortfolio($userId: ID!) {
    user(id: $userId) {
      id
      seniorPoolDeposits {
        amount
      }
    }
    seniorPools(first: 1) {
      id
      latestPoolStatus {
        id
        estimatedApy
      }
    }
  }
`;

export function PortfolioSection() {
  const [isDepositFormOpen, setIsDepositFormOpen] = useState(false);
  const { account } = useWallet();
  const { data } = useSeniorPoolPortfolioQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });
  const seniorPool = data?.seniorPools[0];

  const isGreyedOut = !data?.user;

  const portfolioBalance = data?.user?.seniorPoolDeposits
    .map((d) => d.amount)
    .reduce((prev, current) => current.add(prev), BigNumber.from(0));

  return (
    <div className="rounded bg-sand-100 p-6">
      <div className="flex flex-wrap justify-evenly gap-4">
        <div className="flex flex-col items-center">
          <div>Portfolio Balance</div>
          <div className="text-4xl tabular-nums">
            {portfolioBalance ? formatUsdc(portfolioBalance) : "$0.00"}
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
