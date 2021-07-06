function getTypeof(obj: unknown) {
  return typeof obj
}
type TypeofReturnType = ReturnType<typeof getTypeof>

export class TypeofAssertionError extends Error {
  constructor(obj: unknown, expectedType: TypeofReturnType) {
    const message = `${typeof obj} type does not match expected type: ${expectedType}`
    super(message)
    this.name = "TypeofAssertionError"
  }
}

function genAssertIsTypeof<T extends TypeofReturnType>(assertedType: T): (obj: unknown) => asserts obj is T {
  return (obj: unknown): asserts obj is T => {
    if (typeof obj !== assertedType) {
      throw new TypeofAssertionError(obj, assertedType)
    }
  }
}

export const assertIsString: (obj: unknown) => asserts obj is string = genAssertIsTypeof("string")

export class AssertionError extends Error {}

export function assertNonNullable<T>(val: T | null | undefined): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new AssertionError(`Value ${val} is not non-nullable.`)
  }
}

/**
 * Helper for generating an exhaustive tuple from a union type, i.e. a tuple that
 * contains all of the possible values, and no impossible values, of the union type.
 *
 * Cf. https://stackoverflow.com/a/55266531
 */
export function genExhaustiveTuple<T extends string>() {
  return function <L extends T[]>(
    ...x: L & ([T] extends [L[number]] ? L : [Error, "You are missing ", Exclude<T, L[number]>])
  ) {
    return x
  }
}
