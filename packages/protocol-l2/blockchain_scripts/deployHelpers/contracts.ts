import * as Contracts from "@goldfinch-eng/protocol/typechain/ethers"

// Selects only types that do not start or end with Test
type IgnoreTestTypes<T> = Exclude<T, `${string}Test`> & Exclude<T, `Test${string}`>
// Selects types that have the factory suffix and strips the factory suffix off before returning
type StripFactorySuffix<T> = T extends `${infer P}__factory` ? P : never

// If you're not seeing your contract in this type you may need to generate the typechain types
export type ProbablyValidContract = IgnoreTestTypes<StripFactorySuffix<keyof typeof Contracts>>
