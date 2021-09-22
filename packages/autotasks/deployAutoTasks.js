const {findEnvLocal} = require("@goldfinch-eng/utils")
require("dotenv").config({path: findEnvLocal()})

const resolve = require("@rollup/plugin-node-resolve").default
const commonjs = require("@rollup/plugin-commonjs")
const json = require("@rollup/plugin-json")
const builtins = require("builtin-modules")

const rollup = require("rollup")
const {AutotaskClient} = require("defender-autotask-client")

async function buildAndDeploy(id, name, dir, shouldRollup, autoTaskClient) {
  let dirToUpload = `./${dir}/`
  if (shouldRollup) {
    const inputOptions = {
      input: `./${dir}/index.js`,
      plugins: [resolve({preferBuiltins: true}), commonjs(), json({compact: true})],
      external: [...builtins, "ethers", "web3", "axios", /^defender-relay-client(\/.*)?$/],
    }
    const outputOptions = {
      file: `./${dir}/dist/index.js`,
      format: "cjs",
    }

    const bundle = await rollup.rollup(inputOptions)
    await bundle.write(outputOptions)
    await bundle.close()

    dirToUpload = `./${dir}/dist/`
    console.log(`Rolled up ${name}`)
  } else {
    console.log(`Skipping rollup for: ${name}`)
  }

  console.log(`Updating ${name} (${id}) from ${dirToUpload}`)
  await autoTaskClient.updateCodeFromFolder(id, dirToUpload)
  console.log(`Finished updating ${name}`)
}

;(async () => {
  const autotaskClient = new AutotaskClient({
    apiKey: process.env.AUTOTASK_API_KEY,
    apiSecret: process.env.AUTOTASK_API_SECRET,
  })
  ;[
    {id: "348209ac-8cfd-41a4-be60-e97eab073f29", name: "RinkebyRelayer", dir: "relayer", shouldRollup: true},
    {id: "9d2053fd-507a-473f-8b5a-b079a694723a", name: "MainnetRelayer", dir: "relayer", shouldRollup: true},
    {id: "0157e8f0-3e4b-4510-af27-364207d8fdbd", name: "RinkebyAssessor", dir: "assessor", shouldRollup: false},
    {id: "98e14e44-4137-4f25-9560-984c000445c6", name: "MainnetAssessor", dir: "assessor", shouldRollup: false},
  ].forEach(async (item) => await buildAndDeploy(item.id, item.name, item.dir, item.shouldRollup, autotaskClient))
})()
