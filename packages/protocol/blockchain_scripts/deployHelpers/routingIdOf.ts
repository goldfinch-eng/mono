import {ethers} from "hardhat"

/* NOTE: See Routing.sol for source of truth for keys.
 **      Any changes there should be reflected here.
 **      Ideally we would be able to import constants, but because it's an internal
 **      solidity library this is not possible.
 **/
export const routingIdOf = (s: string) => ethers.utils.hexDataSlice(ethers.utils.id(s), 0, 4)
