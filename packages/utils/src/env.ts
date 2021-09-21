import path from "path"

export function findEnvLocal() {
  const envPath = path.join(__dirname, "../../../.env.local")
  return envPath
}
