import { AppUser } from "@/lib/graphql/generated";
import { Erc20 } from "@/types/ethers-contracts";

import { currentUserVar } from "../vars";

export function updateCurrentUserAttributes(attributes: Partial<AppUser>) {
  const user = currentUserVar();
  currentUserVar({ ...user, ...attributes });
}

export async function refreshCurrentUserUsdcBalance(usdcContract: Erc20) {
  const user = currentUserVar();
  const usdcBalance = await usdcContract.balanceOf(user.account!);
  currentUserVar({ ...user, usdcBalance });
}
