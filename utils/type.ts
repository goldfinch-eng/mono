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
