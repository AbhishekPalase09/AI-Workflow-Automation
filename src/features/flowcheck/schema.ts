// Pure schema lattice implementation for Flowcheck (Phase 2.1)
// Non-Negotiable Rule 4: Zero external imports except local/handlebars.

export type Schema =
  | { k: "never" }
  | { k: "null" }
  | { k: "bool" }
  | { k: "num" }
  | { k: "str" }
  | { k: "lit"; v: string | number | boolean }
  | {
      k: "obj";
      props: Record<string, { s: Schema; req: boolean }>;
      open: boolean;
    }
  | { k: "arr"; item: Schema }
  | { k: "union"; of: Schema[] }
  | { k: "unknown" };

export type LookupStatus = "ok" | "unchecked" | "maybe" | "missing";

export interface LookupResult {
  schema: Schema;
  status: LookupStatus;
  failedAt?: string;
}

const STATUS_SEVERITY: Record<LookupStatus, number> = {
  ok: 0,
  unchecked: 1,
  maybe: 2,
  missing: 3,
};

export function worstStatus(a: LookupStatus, b: LookupStatus): LookupStatus {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

export const S = {
  never: { k: "never" } as Schema,
  null: { k: "null" } as Schema,
  bool: { k: "bool" } as Schema,
  num: { k: "num" } as Schema,
  str: { k: "str" } as Schema,
  unknown: { k: "unknown" } as Schema,
  lit: (v: string | number | boolean): Schema => ({ k: "lit", v }),
  arr: (item: Schema): Schema => ({ k: "arr", item }),
  obj: (
    props: Record<string, Schema | { s: Schema; req: boolean }>,
    opts?: { open?: boolean },
  ): Schema => {
    const normalizedProps: Record<string, { s: Schema; req: boolean }> = {};
    for (const [key, value] of Object.entries(props)) {
      if ("s" in value && "req" in value && typeof value.req === "boolean") {
        normalizedProps[key] = value;
      } else {
        normalizedProps[key] = { s: value as Schema, req: true };
      }
    }
    return {
      k: "obj",
      props: normalizedProps,
      open: opts?.open ?? false,
    };
  },
  union: (of: Schema[]): Schema => {
    return of.reduce((acc, curr) => join(acc, curr), S.never);
  },
};

/**
 * Stable canonical serialization of a Schema for deduplication.
 */
export function canonicalize(s: Schema): string {
  switch (s.k) {
    case "never":
    case "null":
    case "bool":
    case "num":
    case "str":
    case "unknown":
      return s.k;
    case "lit":
      return `lit:${typeof s.v}:${String(s.v)}`;
    case "arr":
      return `arr(${canonicalize(s.item)})`;
    case "obj": {
      const keys = Object.keys(s.props).sort();
      const parts = keys.map(
        (k) =>
          `${k}:${s.props[k].req ? "req" : "opt"}:${canonicalize(s.props[k].s)}`,
      );
      return `obj(${s.open ? "open" : "closed"}|${parts.join(",")})`;
    }
    case "union": {
      const parts = Array.from(new Set(s.of.map(canonicalize))).sort();
      return `union(${parts.join("|")})`;
    }
  }
}

/**
 * Join two schemas in the lattice:
 * - unknown absorbs
 * - never is identity
 * - flatten unions
 * - deduplicate structurally
 */
export function join(a: Schema, b: Schema): Schema {
  if (a.k === "unknown" || b.k === "unknown") {
    return S.unknown;
  }
  if (a.k === "never") return b;
  if (b.k === "never") return a;

  const aCanon = canonicalize(a);
  const bCanon = canonicalize(b);
  if (aCanon === bCanon) return a;

  // Flatten unions
  const members: Schema[] = [];
  if (a.k === "union") {
    members.push(...a.of);
  } else {
    members.push(a);
  }
  if (b.k === "union") {
    members.push(...b.of);
  } else {
    members.push(b);
  }

  // Deduplicate using canonical representations
  const uniqueMap = new Map<string, Schema>();
  for (const m of members) {
    if (m.k === "never") continue;
    if (m.k === "unknown") return S.unknown;
    const c = canonicalize(m);
    if (!uniqueMap.has(c)) {
      uniqueMap.set(c, m);
    }
  }

  const result = Array.from(uniqueMap.values());
  if (result.length === 0) return S.never;
  if (result.length === 1) return result[0];

  return { k: "union", of: result };
}

/**
 * Check whether a schema is scalar: null, bool, num, str, lit, or unknown.
 */
export function isScalar(schema: Schema): boolean {
  switch (schema.k) {
    case "null":
    case "bool":
    case "num":
    case "str":
    case "lit":
    case "unknown":
      return true;
    case "never":
    case "obj":
    case "arr":
      return false;
    case "union":
      return schema.of.length > 0 && schema.of.every(isScalar);
  }
}

/**
 * Normalize an index segment such as "0" or "[0]" into a numeric index string,
 * or return null if it's not a numeric index.
 */
function normalizeIndex(seg: string): string | null {
  const clean =
    seg.startsWith("[") && seg.endsWith("]") ? seg.slice(1, -1) : seg;
  return /^\d+$/.test(clean) ? clean : null;
}

/**
 * Look up a path in a schema according to lattice semantics.
 */
export function lookup(schema: Schema, path: string[]): LookupResult {
  if (path.length === 0) {
    return { schema, status: "ok" };
  }

  const [head, ...rest] = path;

  switch (schema.k) {
    case "unknown":
      return { schema: S.unknown, status: "unchecked" };

    case "never":
      return { schema: S.never, status: "missing", failedAt: head };

    case "null":
    case "bool":
    case "num":
    case "str":
    case "lit":
      // Scalar with further path segment is invalid
      return { schema: S.never, status: "missing", failedAt: head };

    case "obj": {
      // Check if property exists
      if (head in schema.props) {
        const prop = schema.props[head];
        const keyStatus: LookupStatus = prop.req ? "ok" : "maybe";
        const inner = lookup(prop.s, rest);
        return {
          schema: inner.schema,
          status: worstStatus(keyStatus, inner.status),
          failedAt: inner.failedAt,
        };
      }

      // Key not present in props
      if (schema.open) {
        return { schema: S.unknown, status: "unchecked" };
      }

      return { schema: S.never, status: "missing", failedAt: head };
    }

    case "arr": {
      const idx = normalizeIndex(head);
      if (idx !== null) {
        // Numeric array index access is always 'maybe' at best (array length is dynamic)
        const inner = lookup(schema.item, rest);
        return {
          schema: inner.schema,
          status: worstStatus("maybe", inner.status),
          failedAt: inner.failedAt,
        };
      }
      return { schema: S.never, status: "missing", failedAt: head };
    }

    case "union": {
      const results = schema.of.map((m) => lookup(m, path));

      const missingCount = results.filter((r) => r.status === "missing").length;

      // If none has the key, it's missing across all branches
      if (missingCount === results.length) {
        return {
          schema: S.never,
          status: "missing",
          failedAt: results[0]?.failedAt || head,
        };
      }

      // If only some have the key, status is 'maybe'
      if (missingCount > 0) {
        const nonMissing = results.filter((r) => r.status !== "missing");
        const joinedSchema = nonMissing.reduce(
          (acc, curr) => join(acc, curr.schema),
          S.never,
        );
        return {
          schema: joinedSchema,
          status: "maybe",
          failedAt: results.find((r) => r.status === "missing")?.failedAt,
        };
      }

      // All branches succeeded: worst status among branches, join of schemas
      let worst: LookupStatus = "ok";
      for (const r of results) {
        worst = worstStatus(worst, r.status);
      }
      const joinedSchema = results.reduce(
        (acc, curr) => join(acc, curr.schema),
        S.never,
      );
      return { schema: joinedSchema, status: worst };
    }
  }
}

export interface PathInfo {
  path: string;
  kind: string;
  scalar: boolean;
}

/**
 * Enumerate paths up to a given depth for autocomplete, returning path, kind, and scalar info.
 */
export function enumeratePaths(
  schema: Schema,
  prefix = "",
  depth = 4,
): PathInfo[] {
  if (depth <= 0) return [];

  const formatKey = (base: string, key: string) =>
    base ? `${base}.${key}` : key;

  switch (schema.k) {
    case "never":
    case "null":
    case "bool":
    case "num":
    case "str":
    case "lit":
    case "unknown":
      return prefix
        ? [{ path: prefix, kind: schema.k, scalar: isScalar(schema) }]
        : [];

    case "obj": {
      const results: PathInfo[] = [];
      const seen = new Set<string>();

      if (prefix) {
        results.push({ path: prefix, kind: "obj", scalar: false });
        seen.add(prefix);
      }

      for (const [key, prop] of Object.entries(schema.props)) {
        const nextPrefix = formatKey(prefix, key);
        const subPaths = enumeratePaths(prop.s, nextPrefix, depth - 1);
        for (const sp of subPaths) {
          if (!seen.has(sp.path)) {
            seen.add(sp.path);
            results.push(sp);
          }
        }
      }
      return results;
    }

    case "arr": {
      const results: PathInfo[] = [];
      const seen = new Set<string>();

      if (prefix) {
        results.push({ path: prefix, kind: "arr", scalar: false });
        seen.add(prefix);
      }

      const nextPrefix = formatKey(prefix, "0");
      const subPaths = enumeratePaths(schema.item, nextPrefix, depth - 1);
      for (const sp of subPaths) {
        if (!seen.has(sp.path)) {
          seen.add(sp.path);
          results.push(sp);
        }
      }
      return results;
    }

    case "union": {
      const results: PathInfo[] = [];
      const seen = new Set<string>();

      if (prefix) {
        results.push({
          path: prefix,
          kind: "union",
          scalar: isScalar(schema),
        });
        seen.add(prefix);
      }

      for (const m of schema.of) {
        for (const sp of enumeratePaths(m, prefix, depth)) {
          if (!seen.has(sp.path)) {
            seen.add(sp.path);
            results.push(sp);
          }
        }
      }
      return results;
    }
  }
}

/**
 * Infer a Schema lattice representation from sample JSON data.
 * Objects become open objects with req=false.
 */
export function inferSchema(value: unknown): Schema {
  if (value === null) return S.null;
  if (typeof value === "boolean") return S.bool;
  if (typeof value === "number") return S.num;
  if (typeof value === "string") return S.str;

  if (Array.isArray(value)) {
    if (value.length === 0) return S.arr(S.unknown);
    const itemSchema = value
      .map(inferSchema)
      .reduce((acc, curr) => join(acc, curr), S.never);
    return S.arr(itemSchema);
  }

  if (typeof value === "object") {
    const props: Record<string, { s: Schema; req: boolean }> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      props[k] = { s: inferSchema(v), req: false };
    }
    return {
      k: "obj",
      props,
      open: true,
    };
  }

  return S.unknown;
}

/**
 * Runtime guard validating if an arbitrary unknown object matches Schema lattice structure.
 */
export function isSchema(x: unknown): x is Schema {
  if (!x || typeof x !== "object") return false;
  const s = x as { k?: unknown };
  if (typeof s.k !== "string") return false;

  switch (s.k) {
    case "never":
    case "null":
    case "bool":
    case "num":
    case "str":
    case "unknown":
      return true;
    case "lit": {
      const lit = s as { k: "lit"; v?: unknown };
      return (
        typeof lit.v === "string" ||
        typeof lit.v === "number" ||
        typeof lit.v === "boolean"
      );
    }
    case "arr": {
      const arr = s as { k: "arr"; item?: unknown };
      return isSchema(arr.item);
    }
    case "obj": {
      const obj = s as {
        k: "obj";
        props?: Record<string, unknown>;
        open?: unknown;
      };
      if (
        typeof obj.open !== "boolean" ||
        !obj.props ||
        typeof obj.props !== "object"
      ) {
        return false;
      }
      for (const prop of Object.values(obj.props)) {
        if (!prop || typeof prop !== "object") return false;
        const p = prop as { req?: unknown; s?: unknown };
        if (typeof p.req !== "boolean" || !isSchema(p.s)) return false;
      }
      return true;
    }
    case "union": {
      const u = s as { k: "union"; of?: unknown };
      return Array.isArray(u.of) && u.of.every(isSchema);
    }
    default:
      return false;
  }
}
