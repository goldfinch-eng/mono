import { Resolvers } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { getContract2 } from "@/lib/contracts";

export const seniorPoolResolvers: Resolvers[string] = {
  name: () => "Goldfinch Senior Pool",
  description: () => "Automated diversified portfolio",
  icon: () => goldfinchLogoPngUrl,
  async epochEndsAt(): Promise<number> {
    const seniorPoolContract = await getContract2({
      name: "SeniorPool",
    });
    const currentEpoch = await seniorPoolContract.currentEpoch();
    return currentEpoch.endsAt.toNumber();
  },
};
