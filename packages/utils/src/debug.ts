export function debug(...args: any[]) {
  if (process.env.GF_DEBUG) {
    const e = new Error()
    const frame = e.stack?.split("\n")[2] // change to 3 for grandparent func
    const lineNo = frame?.split(":").reverse()[1]
    const functionName = frame?.split(" ")[5]
    console.log(functionName, ":", lineNo, ": ", ...args)
  }
}
