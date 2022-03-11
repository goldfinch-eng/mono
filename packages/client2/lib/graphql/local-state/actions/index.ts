import { AppUser } from "@/lib/graphql/generated";

import { currentUserVar } from "../vars";

export function updateCurrentUserAttributes(attributes: Partial<AppUser>) {
  const user = currentUserVar();
  currentUserVar({ ...user, ...attributes });
}
