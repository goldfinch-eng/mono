import hardhat from "hardhat"

// Re-export hardhat for use by other packages that require access to the hardhat
// runtime environment to e.g. deploy contracts or get existing deployments.
//
// Packages that wish to use protocol's deployments should import hardhat from
// this package rather than from the "hardhat" node-module. This prevents type
// errors of the form:
//
//   Argument of type 'import("/home/mark/code/goldfinch-protocol/packages/server/node_modules/hardhat-deploy/dist/types").DeploymentsExtension'
//   is not assignable to parameter of type 'import("/home/mark/code/goldfinch-protocol/packages/autotasks/node_modules/hardhat-deploy/dist/types").DeploymentsExtension'
//
// Or other issues where custom type declarations from hardhat plugins like
// hardhat-deploy aren't being picked up by the typescript compiler.
export {hardhat}
