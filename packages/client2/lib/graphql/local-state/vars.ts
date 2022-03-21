import { makeVar } from "@apollo/client";

import { AppUser } from "@/lib/graphql/generated";

export const currentUserVar = makeVar<Omit<AppUser, "__typename">>({});
