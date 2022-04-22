import { AppUser } from "@/lib/graphql/generated";
import { Erc20, Gfi } from "@/types/ethers-contracts";

import { currentUserVar } from "../vars";

/**
 * Broad-scope function that allows you to update any user attributes
 * @param attributes Object with new user attributes. Will be shallowly merged in with existing attributes.
 */
export function updateCurrentUserAttributes(attributes: Partial<AppUser>) {
  const user = currentUserVar();
  currentUserVar({ ...user, ...attributes });
}

export async function refreshCurrentUserUsdcBalance(usdcContract: Erc20) {
  const user = currentUserVar();
  const usdcBalance = await usdcContract.balanceOf(user.account!);
  currentUserVar({ ...user, usdcBalance });
}

export async function refreshCurrentUserGfiBalance(gfiContract: Gfi) {
  const user = currentUserVar();
  const gfiBalance = await gfiContract.balanceOf(user.account!);
  currentUserVar({ ...user, gfiBalance });
}
