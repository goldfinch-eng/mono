export function debug(...args) {
  if (process.env.GF_DEBUG) {
    let e = new Error();
    let frame = e.stack?.split("\n")[2]; // change to 3 for grandparent func
    let lineNo = frame?.split(":").reverse()[1];
    let functionName = frame?.split(" ")[5];
    console.log(functionName,":", lineNo, ": ", ...args)
  }
}
