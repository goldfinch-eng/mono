/*
This is for simple utility types. DO NOT import other src files in here. Only export,
or import from 3rd party libraries. Importing source files can cause downstream issues,
such as our server/functions trying to run typescript against all our src files, but
outside of the hardhat context and throwing all kinds of errors.
*/

import {isPlainObject as _isPlainObject} from "lodash"

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

export function isString(obj: unknown): obj is string {
  return typeof obj === "string"
}
export function isNonEmptyString(obj: unknown): obj is string {
  return typeof obj === "string" && obj !== ""
}
export const isStringOrUndefined = orUndefined(isString)

export const assertIsString: (obj: unknown) => asserts obj is string = genAssertIsTypeof("string")

export class AssertionError extends Error {}

export function assertNonNullable<T>(val: T | null | undefined, errorMessage?: string): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new AssertionError(errorMessage || `Value ${val} is not non-nullable.`)
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

export type PlainObject = Record<string, unknown>

export function isPlainObject(obj: unknown): obj is PlainObject {
  return _isPlainObject(obj)
}

export function isUndefined(obj: unknown): obj is undefined {
  return obj === undefined
}

export function orUndefined<T>(typeGuard: (obj: unknown) => obj is T): (obj: unknown) => obj is T | undefined {
  return (obj: unknown): obj is T | undefined => typeGuard(obj) || isUndefined(obj)
}

