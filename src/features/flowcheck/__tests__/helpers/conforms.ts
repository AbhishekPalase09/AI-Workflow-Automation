import type { Schema } from "../../schema";

/**
 * Validates whether a concrete runtime value conforms to a Schema lattice declaration.
 */
export function conforms(value: unknown, schema: Schema): boolean {
  switch (schema.k) {
    case "never":
      return false;

    case "unknown":
      return true;

    case "null":
      return value === null;

    case "bool":
      return typeof value === "boolean";

    case "num":
      return typeof value === "number";

    case "str":
      return typeof value === "string";

    case "lit":
      return value === schema.v;

    case "arr":
      if (!Array.isArray(value)) return false;
      return value.every((item) => conforms(item, schema.item));

    case "obj": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
      }
      const valObj = value as Record<string, unknown>;

      // Check all props declared in schema
      for (const [key, prop] of Object.entries(schema.props)) {
        if (prop.req) {
          if (!(key in valObj)) return false;
          if (!conforms(valObj[key], prop.s)) return false;
        } else {
          if (key in valObj && valObj[key] !== undefined) {
            if (!conforms(valObj[key], prop.s)) return false;
          }
        }
      }

      // Check extra keys if object is closed
      if (!schema.open) {
        for (const key of Object.keys(valObj)) {
          if (!(key in schema.props)) {
            return false;
          }
        }
      }

      return true;
    }

    case "union":
      return schema.of.some((member) => conforms(value, member));
  }
}
