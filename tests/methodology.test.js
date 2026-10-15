import test from "node:test";
import assert from "node:assert/strict";
import { getMethodology, listMethodologies, AAOIFI_PLACEHOLDER } from "../src/screening/methodology.js";

test("AAOIFI_PLACEHOLDER has required metadata", () => {
  assert.equal(AAOIFI_PLACEHOLDER.id, "aaoifi-placeholder");
  assert.ok(AAOIFI_PLACEHOLDER.version);
  assert.ok(AAOIFI_PLACEHOLDER.effectiveDate);
  assert.ok(AAOIFI_PLACEHOLDER.name);
  assert.ok(AAOIFI_PLACEHOLDER.description.toLowerCase().includes("placeholder"));
});

test("AAOIFI_PLACEHOLDER has business activity screen", () => {
  const screen = AAOIFI_PLACEHOLDER.businessActivityScreen;
  assert.ok(Array.isArray(screen.prohibited));
  assert.ok(screen.prohibited.includes("conventional-banking"));
  assert.ok(screen.prohibited.includes("alcohol"));
  assert.ok(screen.prohibited.includes("gambling"));
  assert.ok(Array.isArray(screen.requiresReview));
  assert.ok(screen.requiresReview.includes("entertainment"));
  assert.ok(Array.isArray(screen.permissible));
  assert.ok(screen.permissible.includes("technology"));
});

test("AAOIFI_PLACEHOLDER has financial ratio thresholds", () => {
  const ratios = AAOIFI_PLACEHOLDER.financialRatios;
  assert.equal(ratios.debtRatio.threshold, 0.33);
  assert.equal(ratios.cashAndInterestBearingSecurities.threshold, 0.33);
  assert.equal(ratios.impureIncomeRatio.threshold, 0.05);
  assert.equal(ratios.accountsReceivableRatio.threshold, 0.49);
});

test("getMethodology returns AAOIFI for default id", () => {
  assert.deepEqual(getMethodology("aaoifi-placeholder"), AAOIFI_PLACEHOLDER);
  assert.deepEqual(getMethodology(null), AAOIFI_PLACEHOLDER);
  assert.deepEqual(getMethodology(undefined), AAOIFI_PLACEHOLDER);
});

test("getMethodology returns null for unknown id", () => {
  assert.equal(getMethodology("unknown-methodology"), null);
});

test("listMethodologies returns at least one entry", () => {
  const list = listMethodologies();
  assert.ok(list.length >= 1);
  assert.equal(list[0].id, "aaoifi-placeholder");
  assert.ok(list[0].version);
  assert.ok(list[0].name);
});
