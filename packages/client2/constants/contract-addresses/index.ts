import localhostAddresses from "./localhost.json";
import mainnetAddresses from "./mainnet.json";

export const CONTRACT_ADDRESSES = {
  1: mainnetAddresses,
  31337: localhostAddresses,
};
