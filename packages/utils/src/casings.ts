import {isArray, isObject, camelCase, transform} from "lodash"

export const camelize = (obj: object) =>
  transform(obj, (result: Record<string, unknown>, value: unknown, key: string, target) => {
    const camelKey = isArray(target) ? key : camelCase(key)
    result[camelKey] = isObject(value) ? camelize(value as Record<string, unknown>) : value
  })
