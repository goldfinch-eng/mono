import { Resolvers } from "@apollo/client";

import { batchProvider } from "@/lib/wallet";

import { User } from "../generated";

// This env var provides a way to bail out of ENS resolution in case it starts causing more RPC calls than we are allotted. Just set the env var to `true`
// Side note: it may be possible to batch these ENS resolutions in the future with v3 of the ENS lib (https://www.npmjs.com/package/@ensdomains/ensjs)
const ensDisabled = !!process.env.NEXT_PUBLIC_DISABLE_ENS_LOOKUP_IN_SCHEMA;

export const userResolvers: Resolvers[string] = {
  async ENSName(user: User): Promise<string | null> {
    if (ensDisabled) {
      return null;
    }
    try {
      return batchProvider.lookupAddress(user.id);
    } catch (e) {
      // Error is thrown above if the network does not support ENS (happens on localhost)
      return null;
    }
  },
  async ENSAvatar(user: User): Promise<string | null> {
    if (ensDisabled) {
      return null;
    }
    try {
      return await batchProvider.getAvatar(user.id);
    } catch (e) {
      // Error is thrown above if the network does not support ENS (happens on localhost)
      return null;
    }
  },
};
