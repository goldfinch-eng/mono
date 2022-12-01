import { Resolvers } from "@apollo/client";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

export const seniorPoolStatusResolvers: Resolvers[string] = {
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
