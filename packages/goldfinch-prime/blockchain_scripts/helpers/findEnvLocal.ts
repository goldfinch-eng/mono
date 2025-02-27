import path from "path"

export function findEnvLocal() {
  const envPath = path.join(__dirname, "../../../../.env.local")
  console.log("local path:", envPath)
  console.log("__dirname", __dirname)
  return envPath
}
