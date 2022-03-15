import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { Button } from "@/components/button";
import { useSeniorPoolContract, useUsdcContract } from "@/lib/contracts";
import { formatPercent, formatUsdc } from "@/lib/format";
import { useSeniorPoolPortfolioQuery } from "@/lib/graphql/generated";
import { wait } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

gql`
  query SeniorPoolPortfolio($userId: ID!, $minBlock: Int!) {
    user(id: $userId, block: { number_gte: $minBlock }) {
      seniorPoolDeposits {
        amount
      }
    }
    seniorPools(first: 1, block: { number_gte: $minBlock }) {
      latestPoolStatus {
        estimatedApy
      }
    }
  }
`;

export function PortfolioSection() {
  const { account } = useWallet();
  const usdcContract = useUsdcContract();
  const { seniorPoolContract, seniorPoolAddress } = useSeniorPoolContract();
  const { data, refetch } = useSeniorPoolPortfolioQuery({
    variables: { userId: account?.toLowerCase() ?? "", minBlock: 0 },
  });
  const seniorPool = data?.seniorPools[0];

  const isGreyedOut = !data?.user;

  const portfolioBalance = data?.user?.seniorPoolDeposits
    .map((d) => d.amount)
    .reduce((prev, current) => current.add(prev), BigNumber.from(0));

  const handleDeposit = async () => {
    if (!account || !seniorPoolContract || !usdcContract) {
      return;
    }

    const depositAmount = BigNumber.from("100000"); // ! hard-coded just for now

    const allowance = await usdcContract.allowance(account, seniorPoolAddress);
    if (depositAmount.gt(allowance)) {
      // Approve a really big amount so the user doesn't have to spend gas approving this again in the future
      const approvalTransaction = await usdcContract.approve(
        seniorPoolAddress,
        BigNumber.from(Number.MAX_SAFE_INTEGER - 1)
      );
      await approvalTransaction.wait();
    }

    const transaction = await seniorPoolContract.deposit(depositAmount);
    const receipt = await transaction.wait();
    const minBlock = receipt.blockNumber;
    let subgraphUpdated = false;
    while (!subgraphUpdated) {
      try {
        await refetch({ minBlock: minBlock });
        subgraphUpdated = true;
      } catch (e) {
        if (
          (e as Error).message.includes("has only indexed up to block number")
        ) {
          await wait(1000);
        } else {
          throw e;
        }
      }
    }
  };

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
          onClick={handleDeposit}
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
    </div>
  );
}
