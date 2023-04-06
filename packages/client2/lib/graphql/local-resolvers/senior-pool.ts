import { Resolvers } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

export const seniorPoolResolvers: Resolvers[string] = {
  name: () => "Goldfinch Senior Pool",
  description: () => "Automated diversified portfolio",
  icon: () => goldfinchLogoPngUrl,
  async epochEndsAt(): Promise<number> {
    const provider = await getProvider();
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
      useSigner: false,
    });
    const currentEpoch = await seniorPoolContract.currentEpoch();
    return currentEpoch.endsAt.toNumber();
  },
};
