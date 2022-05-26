import localhostAddresses from "./localhost.json";
import mainnetAddresses from "./mainnet.json";

export const CONTRACT_ADDRESSES: { [chainId: number]: Record<string, string> } =
  {
    1: mainnetAddresses,
    31337: localhostAddresses,
  };
