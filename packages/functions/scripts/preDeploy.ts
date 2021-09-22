import {promises} from "fs"
import path from "path"
import {spawn} from "child_process"
import {assertNonNullable} from "@goldfinch-eng/utils"

/**
 * Run a command in a sub-process.
 * @param {Array<string>} args A command to run
 */
async function runCommand(args: Array<string>, {cwd}: {cwd: string}): Promise<string> {
  const command = args.shift()
  assertNonNullable(command)
  return new Promise((resolve, reject) => {
    let output = ""
    const child = spawn(command, args, {cwd})
    child.stdout.on("data", (chunk) => {
      output += chunk.toString()
    })
    child.on("close", (code: number) => {
      if (code !== 0) {
        return reject(new Error(code.toString()))
      }
      return resolve(output)
    })
  })
}

/**
 * Pack all internal dependencies into the package root directory and re-write the package.json
 * to point to packed files. We need to do this since firebase assumes all dependencies are
 * available in npm, but our packages are private and unpublished.
 * See https://github.com/firebase/firebase-tools/issues/653 for more details.
 */
async function main() {
  const packageRoot = path.join(__dirname, "../")
  const monorepoRoot = path.join(packageRoot, "../../")
  const packageJsonPath = path.join(packageRoot, "package.json")
  const packageJsonStr = String(await promises.readFile(packageJsonPath))
  const packageJson = JSON.parse(packageJsonStr)

  const goldfinchPackages = Object.keys(packageJson.dependencies).filter((packageName: string) =>
    packageName.startsWith("@goldfinch-eng"),
  )

  const packagesDir = path.join(monorepoRoot, "packages")
  const monorepoPackages = await promises.readdir(packagesDir)

  await Promise.all(
    goldfinchPackages.map(async (scopedPackageName) => {
      const packageName = scopedPackageName.replace("@goldfinch-eng/", "")
      if (monorepoPackages.includes(packageName)) {
        const packed = await runCommand(["npm", "pack", path.join(packagesDir, packageName)], {cwd: packageRoot})
        packageJson.dependencies[scopedPackageName] = `file:./${packed.trim()}`
      }
    }),
  )

  await promises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
}

main()
