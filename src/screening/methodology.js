/**
 * AAOIFI-style Sharia compliance screening methodology.
 *
 * IMPORTANT DISCLAIMER:
 * These thresholds and business-activity classifications are PLACEHOLDERS
 * for development purposes only. They are loosely modeled on publicly
 * documented AAOIFI screening standards but have NOT been reviewed or
 * approved by a qualified Sharia adviser. Before any production use,
 * every threshold, classification, and ratio definition must be reviewed
 * and certified by a qualified Sharia advisory board.
 */

export const AAOIFI_PLACEHOLDER = {
  id: "aaoifi-placeholder",
  version: "0.1.0",
  effectiveDate: "2026-10-15",
  name: "AAOIFI-Style Placeholder Screen",
  description:
    "Placeholder Sharia compliance screen loosely based on publicly available " +
    "AAOIFI guidelines. All thresholds require review by a qualified Sharia adviser.",

  businessActivityScreen: {
    description:
      "Companies whose core business involves prohibited (haram) activities " +
      "are excluded outright. Companies with mixed activities require review.",
    prohibited: [
      "conventional-banking",
      "conventional-insurance",
      "alcohol",
      "tobacco",
      "pork",
      "gambling",
      "adult-entertainment",
      "weapons-controversial",
    ],
    requiresReview: [
      "mixed-financials",
      "entertainment",
      "hospitality",
      "conglomerate",
    ],
    permissible: [
      "technology",
      "healthcare",
      "industrials",
      "consumer-staples",
      "materials",
      "real-estate",
      "utilities",
      "energy",
      "telecommunications",
      "transportation",
    ],
  },

  financialRatios: {
    description:
      "Financial ratio screens applied to companies that pass the business " +
      "activity screen. Ratios use trailing 12-month or most recent annual " +
      "figures. Denominator is trailing 36-month average market capitalization " +
      "or total assets, depending on the standard variant.",

    debtRatio: {
      label: "Interest-Bearing Debt / Market Cap",
      threshold: 0.33,
      operator: "<=",
      denominatorNote: "36-month average market capitalization (placeholder: uses latest market cap)",
    },

    cashAndInterestBearingSecurities: {
      label: "Cash + Interest-Bearing Securities / Market Cap",
      threshold: 0.33,
      operator: "<=",
      denominatorNote: "36-month average market capitalization (placeholder: uses latest market cap)",
    },

    impureIncomeRatio: {
      label: "Impure Income / Total Revenue",
      threshold: 0.05,
      operator: "<=",
      note: "Income from non-compliant activities as a fraction of total revenue",
    },

    accountsReceivableRatio: {
      label: "Accounts Receivable / Market Cap",
      threshold: 0.49,
      operator: "<=",
      denominatorNote: "36-month average market capitalization (placeholder: uses latest market cap)",
    },
  },

  purificationNote:
    "If a company passes all screens but derives a small portion of income " +
    "from non-compliant sources, investors are expected to purify that " +
    "portion of any dividends received. The purification percentage equals " +
    "the impure income ratio.",
};

export function getMethodology(id) {
  if (!id || id === "aaoifi-placeholder") return AAOIFI_PLACEHOLDER;
  return null;
}

export function listMethodologies() {
  return [
    {
      id: AAOIFI_PLACEHOLDER.id,
      version: AAOIFI_PLACEHOLDER.version,
      name: AAOIFI_PLACEHOLDER.name,
    },
  ];
}
