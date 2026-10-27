import { describe, expect, it } from "vitest";
import {
  canonicalize,
  enumeratePaths,
  inferSchema,
  isScalar,
  isSchema,
  join,
  lookup,
  S,
  type Schema,
} from "../schema";

describe("Schema Lattice (Phase 2.1)", () => {
  describe("Lattice join", () => {
    it("identity with never", () => {
      expect(join(S.never, S.str)).toEqual(S.str);
      expect(join(S.num, S.never)).toEqual(S.num);
    });

    it("absorbs with unknown", () => {
      expect(join(S.str, S.unknown)).toEqual(S.unknown);
      expect(join(S.unknown, S.obj({ a: S.num }))).toEqual(S.unknown);
    });

    it("collapses identical schemas", () => {
      expect(join(S.str, S.str)).toEqual(S.str);
      const o1 = S.obj({ x: S.num, y: S.str });
      const o2 = S.obj({ y: S.str, x: S.num }); // different key insertion order
      expect(canonicalize(o1)).toBe(canonicalize(o2));
      expect(join(o1, o2)).toEqual(o1);
    });

    it("flattens and dedupes unions", () => {
      const u1: Schema = { k: "union", of: [S.str, S.num] };
      const u2: Schema = { k: "union", of: [S.num, S.bool] };
      const joined = join(u1, u2);
      expect(joined.k).toBe("union");
      if (joined.k === "union") {
        expect(joined.of.map((s) => s.k).sort()).toEqual([
          "bool",
          "num",
          "str",
        ]);
      }
    });
  });

  describe("Lookup rules", () => {
    it("empty path returns schema itself with ok", () => {
      const s = S.obj({ a: S.str });
      expect(lookup(s, [])).toEqual({ schema: s, status: "ok" });
    });

    it("unknown returns unchecked", () => {
      expect(lookup(S.unknown, ["any", "nested", "path"])).toEqual({
        schema: S.unknown,
        status: "unchecked",
      });
    });

    it("scalar with path returns missing", () => {
      expect(lookup(S.str, ["length"])).toEqual({
        schema: S.never,
        status: "missing",
        failedAt: "length",
      });
    });

    it("closed object with present required prop returns ok", () => {
      const s = S.obj({ user: S.obj({ name: S.str }) });
      const res = lookup(s, ["user", "name"]);
      expect(res.status).toBe("ok");
      expect(res.schema).toEqual(S.str);
    });

    it("closed object with optional prop returns maybe", () => {
      const s = S.obj({ user: { s: S.str, req: false } });
      const res = lookup(s, ["user"]);
      expect(res.status).toBe("maybe");
      expect(res.schema).toEqual(S.str);
    });

    it("closed object with missing key returns missing", () => {
      const s = S.obj({ a: S.str }, { open: false });
      const res = lookup(s, ["b"]);
      expect(res.status).toBe("missing");
      expect(res.failedAt).toBe("b");
    });

    it("open object with missing key returns unchecked", () => {
      const s = S.obj({ a: S.str }, { open: true });
      const res = lookup(s, ["b"]);
      expect(res.status).toBe("unchecked");
      expect(res.schema).toEqual(S.unknown);
    });

    it("array numeric index access returns maybe", () => {
      const s = S.arr(S.str);
      expect(lookup(s, ["0"])).toEqual({ schema: S.str, status: "maybe" });
      expect(lookup(s, ["[0]"])).toEqual({ schema: S.str, status: "maybe" });
    });

    it("array non-numeric property returns missing", () => {
      const s = S.arr(S.str);
      const res = lookup(s, ["map"]);
      expect(res.status).toBe("missing");
      expect(res.failedAt).toBe("map");
    });

    it("union lookup: missing on all branches", () => {
      const u: Schema = {
        k: "union",
        of: [S.obj({ a: S.str }), S.obj({ b: S.num })],
      };
      const res = lookup(u, ["c"]);
      expect(res.status).toBe("missing");
      expect(res.failedAt).toBe("c");
    });

    it("union lookup: present on some branches returns maybe", () => {
      const u: Schema = {
        k: "union",
        of: [S.obj({ a: S.str }), S.obj({ b: S.num })],
      };
      const res = lookup(u, ["a"]);
      expect(res.status).toBe("maybe");
      expect(res.schema).toEqual(S.str);
    });

    it("union lookup: present on all branches joins schemas", () => {
      const u: Schema = {
        k: "union",
        of: [S.obj({ a: S.str }), S.obj({ a: S.num })],
      };
      const res = lookup(u, ["a"]);
      expect(res.status).toBe("ok");
      expect(res.schema.k).toBe("union");
    });
  });

  describe("isScalar helper", () => {
    it("identifies scalars and non-scalars", () => {
      expect(isScalar(S.str)).toBe(true);
      expect(isScalar(S.num)).toBe(true);
      expect(isScalar(S.bool)).toBe(true);
      expect(isScalar(S.null)).toBe(true);
      expect(isScalar(S.unknown)).toBe(true);
      expect(isScalar(S.lit("foo"))).toBe(true);
      expect(isScalar(S.obj({}))).toBe(false);
      expect(isScalar(S.arr(S.str))).toBe(false);
    });
  });

  describe("inferSchema", () => {
    it("infers open object schema with req=false", () => {
      const sample = { id: 123, name: "Alice", tags: ["admin"] };
      const s = inferSchema(sample);
      expect(s.k).toBe("obj");
      if (s.k === "obj") {
        expect(s.open).toBe(true);
        expect(s.props.id.req).toBe(false);
        expect(s.props.id.s.k).toBe("num");
        expect(s.props.name.s.k).toBe("str");
        expect(s.props.tags.s.k).toBe("arr");
      }
    });

    it("handles empty arrays", () => {
      const s = inferSchema([]);
      expect(s).toEqual(S.arr(S.unknown));
    });
  });

  describe("enumeratePaths", () => {
    it("enumerates nested paths up to depth with kind and scalar attributes", () => {
      const s = S.obj({
        user: S.obj({
          profile: S.obj({
            email: S.str,
          }),
        }),
        tags: S.arr(S.str),
      });
      const results = enumeratePaths(s);
      const paths = results.map((r) => r.path);
      expect(paths).toContain("user");
      expect(paths).toContain("user.profile");
      expect(paths).toContain("user.profile.email");
      expect(paths).toContain("tags");

      const emailInfo = results.find((r) => r.path === "user.profile.email");
      expect(emailInfo).toBeDefined();
      expect(emailInfo?.scalar).toBe(true);
      expect(emailInfo?.kind).toBe("str");

      const userInfo = results.find((r) => r.path === "user");
      expect(userInfo).toBeDefined();
      expect(userInfo?.scalar).toBe(false);
      expect(userInfo?.kind).toBe("obj");

      const tagsInfo = results.find((r) => r.path === "tags");
      expect(tagsInfo).toBeDefined();
      expect(tagsInfo?.scalar).toBe(false);
      expect(tagsInfo?.kind).toBe("arr");
    });
  });

  describe("isSchema guard", () => {
    it("validates legitimate schemas and rejects malformed objects", () => {
      expect(isSchema(S.str)).toBe(true);
      expect(isSchema(S.obj({ a: S.num }))).toBe(true);
      expect(isSchema({ k: "invalid" })).toBe(false);
      expect(isSchema(null)).toBe(false);
      expect(isSchema("str")).toBe(false);
    });
  });
});
