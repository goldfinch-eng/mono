import { SeniorPoolPortfolioDetailsFieldsFragment } from "@/lib/graphql/generated";

interface PortfolioCurrentDistributionProps {
  seniorPool: SeniorPoolPortfolioDetailsFieldsFragment;
}

export function PortfolioCurrentDistribution({
  seniorPool,
}: PortfolioCurrentDistributionProps) {
  return <div>Current distribution: {seniorPool.name}</div>;
}
