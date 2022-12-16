if (
  process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet" &&
  typeof process.env.NEXT_PUBLIC_MAINNET_RPC_URL === "undefined"
) {
  throw new Error(
    "Target network is set to `mainnet` but a mainnet RPC URL has not been provided. Please set the environment variable `NEXT_PUBLIC_MAINNET_RPC_URL`"
  );
}

export const RPC_URLS: { [chainId: number]: string } =
  process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? { 1: process.env.NEXT_PUBLIC_MAINNET_RPC_URL as string }
    : {
        31337:
          typeof process.env.NEXT_PUBLIC_LOCALHOST_RPC_URL !== "undefined"
            ? process.env.NEXT_PUBLIC_LOCALHOST_RPC_URL
            : "http://localhost:8545",
      };
