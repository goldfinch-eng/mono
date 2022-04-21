import { makeVar } from "@apollo/client";

import { AppUser, Gfi } from "@/lib/graphql/generated";

export const currentUserVar = makeVar<Omit<AppUser, "__typename">>({});

export const gfiVar = makeVar<Omit<Gfi, "__typename"> | null>(null);

export const isWalletModalOpenVar = makeVar<boolean>(false);
