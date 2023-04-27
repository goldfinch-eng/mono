import {promises as fs} from "fs"
import {parse} from "csv-parse"

import {asNonNullable} from "@goldfinch-eng/utils"

export async function parseCsv<T = any>(path: string): Promise<T[]> {
  const csvFile = await fs.readFile(path)
  return new Promise((resolve, reject) => {
    parse(csvFile, {columns: true}, function (err, rows) {
      if (err) {
        reject(err)
      } else {
        resolve(rows as T[])
      }
    })
  })
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  parseCsv(asNonNullable(process.env.EARLY_LP_CSV))
    .then((res) => {
      console.log(res)
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
