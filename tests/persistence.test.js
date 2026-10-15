import test from "node:test";
import assert from "node:assert/strict";
import { isValidRunId, getRunById } from "../src/v2/persistence.js";

test("isValidRunId accepts valid 16-char hex IDs", () => {
  assert.equal(isValidRunId("0d3cbfafe27c4648"), true);
  assert.equal(isValidRunId("abcdef0123456789"), true);
});

test("isValidRunId rejects malformed IDs", () => {
  assert.equal(isValidRunId(""), false);
  assert.equal(isValidRunId("short"), false);
  assert.equal(isValidRunId("../../etc/passwd"), false);
  assert.equal(isValidRunId("ABCDEF0123456789"), false);
  assert.equal(isValidRunId("0d3cbfafe27c464!"), false);
  assert.equal(isValidRunId(null), false);
  assert.equal(isValidRunId(undefined), false);
  assert.equal(isValidRunId(12345), false);
});

test("getRunById returns null for path-traversal attempts", () => {
  assert.equal(getRunById("../../etc/passwd"), null);
  assert.equal(getRunById("../../../etc/shadow"), null);
  assert.equal(getRunById(""), null);
});

test("getRunById returns null for non-existent valid ID", () => {
  assert.equal(getRunById("aaaaaaaaaaaaaaaa"), null);
});
