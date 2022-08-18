const {findEnvLocal} = require("@goldfinch-eng/utils")
require("dotenv").config({path: findEnvLocal()})

const resolve = require("@rollup/plugin-node-resolve").default
const commonjs = require("@rollup/plugin-commonjs")
const json = require("@rollup/plugin-json")
const builtins = require("builtin-modules")
const typescript = require("@rollup/plugin-typescript")

const rollup = require("rollup")
const {AutotaskClient} = require("defender-autotask-client")

async function buildAndDeploy(id, name, dir, autoTaskClient) {
  let dirToUpload = `./${dir}/`
  const inputOptions = {
    input: `./${dir}/index.ts`,
    plugins: [
      resolve({preferBuiltins: true}),
      commonjs(),
      json({compact: true}),
      typescript({
        tsconfig: "./tsconfig.build.json",
        sourceMap: true,
      }),
    ],
    external: [...builtins, "ethers", "web3", "axios", /^defender-relay-client(\/.*)?$/],
  }
  const outputOptions = {
    sourcemap: true,
    file: `./${dir}/dist/index.js`,
    format: "cjs",
  }

  const bundle = await rollup.rollup(inputOptions)
  await bundle.write(outputOptions)
  await bundle.close()

  dirToUpload = `./${dir}/dist/`
  console.log(`Rolled up ${name}`)

  console.log(`Updating ${name} (${id}) from ${dirToUpload}`)
  await autoTaskClient.updateCodeFromFolder(id, dirToUpload)
  console.log(`Finished updating ${name}`)
}

;(async () => {
  const builds = [
    {id: "0157e8f0-3e4b-4510-af27-364207d8fdbd", name: "RinkebyAssessor", dir: "assessor"},
    {id: "98e14e44-4137-4f25-9560-984c000445c6", name: "MainnetAssessor", dir: "assessor"},
    {id: "bc31d6f7-0ab4-4170-9ba0-4978a6ed6034", name: "Mainnet Unique Identity Signer", dir: "unique-identity-signer"},
    {id: "6ba87b47-341d-4b0a-a8b8-02bc04f978f7", name: "SeniorPoolRedeem", dir: "senior-pool-redeemer"},
  ]

  const autotaskClient = new AutotaskClient({
    apiKey: process.env.AUTOTASK_API_KEY,
    apiSecret: process.env.AUTOTASK_API_SECRET,
  })
  for (const item of builds) {
    await buildAndDeploy(item.id, item.name, item.dir, autotaskClient)
  }
})()
  .then(() => {
    process.exit(0)
  })
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
