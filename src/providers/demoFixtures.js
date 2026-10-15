/**
 * Demo/test fixture evidence provider.
 *
 * Contains ~25 sample companies covering:
 *  - Clear passes (compliant tech, healthcare, industrials)
 *  - Clear fails (conventional banks, alcohol, gambling)
 *  - Needs-review (mixed businesses, borderline ratios)
 *  - Missing evidence (incomplete data)
 *
 * All financial figures are FICTIONAL and exist solely for testing.
 * Enable via DEMO_MODE=true environment variable.
 */

import { EvidenceProvider } from "./interface.js";

const fixtures = [
  // --- CLEAR PASSES ---
  {
    ticker: "MSFT",
    companyName: "Microsoft Corp",
    businessActivity: { classification: "technology", description: "Software & cloud services", source: "demo-fixture" },
    financials: {
      marketCap: 2_800_000_000_000,
      totalAssets: 411_000_000_000,
      interestBearingDebt: 47_000_000_000,
      cashAndInterestBearingSecurities: 110_000_000_000,
      accountsReceivable: 44_000_000_000,
      totalRevenue: 211_000_000_000,
      impureIncome: 1_200_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "AAPL",
    companyName: "Apple Inc",
    businessActivity: { classification: "technology", description: "Consumer electronics & software", source: "demo-fixture" },
    financials: {
      marketCap: 3_000_000_000_000,
      totalAssets: 352_000_000_000,
      interestBearingDebt: 98_000_000_000,
      cashAndInterestBearingSecurities: 62_000_000_000,
      accountsReceivable: 28_000_000_000,
      totalRevenue: 385_000_000_000,
      impureIncome: 800_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "JNJ",
    companyName: "Johnson & Johnson",
    businessActivity: { classification: "healthcare", description: "Pharmaceuticals & medical devices", source: "demo-fixture" },
    financials: {
      marketCap: 430_000_000_000,
      totalAssets: 187_000_000_000,
      interestBearingDebt: 28_000_000_000,
      cashAndInterestBearingSecurities: 22_000_000_000,
      accountsReceivable: 16_000_000_000,
      totalRevenue: 95_000_000_000,
      impureIncome: 200_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "CAT",
    companyName: "Caterpillar Inc",
    businessActivity: { classification: "industrials", description: "Heavy machinery & construction", source: "demo-fixture" },
    financials: {
      marketCap: 160_000_000_000,
      totalAssets: 82_000_000_000,
      interestBearingDebt: 25_000_000_000,
      cashAndInterestBearingSecurities: 8_000_000_000,
      accountsReceivable: 10_000_000_000,
      totalRevenue: 67_000_000_000,
      impureIncome: 300_000_000,
      periodEnd: "2026-03-31",
      source: "demo-fixture",
    },
  },
  {
    ticker: "LLY",
    companyName: "Eli Lilly & Co",
    businessActivity: { classification: "healthcare", description: "Pharmaceuticals", source: "demo-fixture" },
    financials: {
      marketCap: 800_000_000_000,
      totalAssets: 64_000_000_000,
      interestBearingDebt: 20_000_000_000,
      cashAndInterestBearingSecurities: 5_000_000_000,
      accountsReceivable: 7_000_000_000,
      totalRevenue: 41_000_000_000,
      impureIncome: 100_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    businessActivity: { classification: "technology", description: "Semiconductor design & AI accelerators", source: "demo-fixture" },
    financials: {
      marketCap: 2_500_000_000_000,
      totalAssets: 65_000_000_000,
      interestBearingDebt: 10_000_000_000,
      cashAndInterestBearingSecurities: 18_000_000_000,
      accountsReceivable: 9_000_000_000,
      totalRevenue: 80_000_000_000,
      impureIncome: 50_000_000,
      periodEnd: "2026-04-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "UNP",
    companyName: "Union Pacific Corp",
    businessActivity: { classification: "transportation", description: "Freight railroad", source: "demo-fixture" },
    financials: {
      marketCap: 150_000_000_000,
      totalAssets: 66_000_000_000,
      interestBearingDebt: 32_000_000_000,
      cashAndInterestBearingSecurities: 1_200_000_000,
      accountsReceivable: 2_000_000_000,
      totalRevenue: 24_000_000_000,
      impureIncome: 80_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "NEE",
    companyName: "NextEra Energy",
    businessActivity: { classification: "utilities", description: "Electric utilities & renewables", source: "demo-fixture" },
    financials: {
      marketCap: 160_000_000_000,
      totalAssets: 95_000_000_000,
      interestBearingDebt: 44_000_000_000,
      cashAndInterestBearingSecurities: 3_000_000_000,
      accountsReceivable: 4_000_000_000,
      totalRevenue: 28_000_000_000,
      impureIncome: 500_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },

  // --- CLEAR FAILS ---
  {
    ticker: "JPM",
    companyName: "JPMorgan Chase & Co",
    businessActivity: { classification: "conventional-banking", description: "Global financial services & banking", source: "demo-fixture" },
    financials: {
      marketCap: 550_000_000_000,
      totalAssets: 3_700_000_000_000,
      interestBearingDebt: 800_000_000_000,
      cashAndInterestBearingSecurities: 900_000_000_000,
      accountsReceivable: 120_000_000_000,
      totalRevenue: 155_000_000_000,
      impureIncome: 80_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "BAC",
    companyName: "Bank of America Corp",
    businessActivity: { classification: "conventional-banking", description: "Banking & financial services", source: "demo-fixture" },
    financials: {
      marketCap: 320_000_000_000,
      totalAssets: 3_100_000_000_000,
      interestBearingDebt: 650_000_000_000,
      cashAndInterestBearingSecurities: 750_000_000_000,
      accountsReceivable: 85_000_000_000,
      totalRevenue: 102_000_000_000,
      impureIncome: 55_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "DEO",
    companyName: "Diageo PLC",
    businessActivity: { classification: "alcohol", description: "Spirits, beer, and wine production", source: "demo-fixture" },
    financials: {
      marketCap: 70_000_000_000,
      totalAssets: 42_000_000_000,
      interestBearingDebt: 16_000_000_000,
      cashAndInterestBearingSecurities: 2_000_000_000,
      accountsReceivable: 5_000_000_000,
      totalRevenue: 20_000_000_000,
      impureIncome: 20_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "PM",
    companyName: "Philip Morris International",
    businessActivity: { classification: "tobacco", description: "Tobacco products", source: "demo-fixture" },
    financials: {
      marketCap: 190_000_000_000,
      totalAssets: 42_000_000_000,
      interestBearingDebt: 28_000_000_000,
      cashAndInterestBearingSecurities: 4_000_000_000,
      accountsReceivable: 3_000_000_000,
      totalRevenue: 35_000_000_000,
      impureIncome: 35_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "MGM",
    companyName: "MGM Resorts International",
    businessActivity: { classification: "gambling", description: "Casino resorts & online betting", source: "demo-fixture" },
    financials: {
      marketCap: 14_000_000_000,
      totalAssets: 38_000_000_000,
      interestBearingDebt: 22_000_000_000,
      cashAndInterestBearingSecurities: 5_000_000_000,
      accountsReceivable: 1_200_000_000,
      totalRevenue: 17_000_000_000,
      impureIncome: 15_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },

  // --- FAILS ON FINANCIAL RATIOS (but permissible business) ---
  {
    ticker: "HIGHDEBT",
    companyName: "HighDebt Utilities Corp (fictional)",
    businessActivity: { classification: "utilities", description: "Electric utility", source: "demo-fixture" },
    financials: {
      marketCap: 10_000_000_000,
      totalAssets: 30_000_000_000,
      interestBearingDebt: 8_000_000_000,
      cashAndInterestBearingSecurities: 1_000_000_000,
      accountsReceivable: 900_000_000,
      totalRevenue: 6_000_000_000,
      impureIncome: 50_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "HIGHCASH",
    companyName: "HighCash Holdings (fictional)",
    businessActivity: { classification: "technology", description: "Tech holding company", source: "demo-fixture" },
    financials: {
      marketCap: 5_000_000_000,
      totalAssets: 12_000_000_000,
      interestBearingDebt: 500_000_000,
      cashAndInterestBearingSecurities: 4_000_000_000,
      accountsReceivable: 600_000_000,
      totalRevenue: 3_000_000_000,
      impureIncome: 20_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },

  // --- NEEDS REVIEW (ambiguous business or borderline ratios) ---
  {
    ticker: "DIS",
    companyName: "Walt Disney Co",
    businessActivity: { classification: "entertainment", description: "Media, entertainment, theme parks", source: "demo-fixture" },
    financials: {
      marketCap: 200_000_000_000,
      totalAssets: 200_000_000_000,
      interestBearingDebt: 45_000_000_000,
      cashAndInterestBearingSecurities: 15_000_000_000,
      accountsReceivable: 12_000_000_000,
      totalRevenue: 89_000_000_000,
      impureIncome: 3_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "MAR",
    companyName: "Marriott International",
    businessActivity: { classification: "hospitality", description: "Hotels & resorts", source: "demo-fixture" },
    financials: {
      marketCap: 72_000_000_000,
      totalAssets: 25_000_000_000,
      interestBearingDebt: 12_000_000_000,
      cashAndInterestBearingSecurities: 1_500_000_000,
      accountsReceivable: 3_000_000_000,
      totalRevenue: 24_000_000_000,
      impureIncome: 800_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "BRK.B",
    companyName: "Berkshire Hathaway Inc",
    businessActivity: { classification: "conglomerate", description: "Diversified conglomerate with insurance", source: "demo-fixture" },
    financials: {
      marketCap: 780_000_000_000,
      totalAssets: 1_070_000_000_000,
      interestBearingDebt: 120_000_000_000,
      cashAndInterestBearingSecurities: 170_000_000_000,
      accountsReceivable: 45_000_000_000,
      totalRevenue: 365_000_000_000,
      impureIncome: 40_000_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "BORDERLINE",
    companyName: "BorderLine Industries (fictional)",
    businessActivity: { classification: "industrials", description: "Manufacturing", source: "demo-fixture" },
    financials: {
      marketCap: 20_000_000_000,
      totalAssets: 18_000_000_000,
      interestBearingDebt: 6_500_000_000,
      cashAndInterestBearingSecurities: 1_000_000_000,
      accountsReceivable: 2_000_000_000,
      totalRevenue: 12_000_000_000,
      impureIncome: 580_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },

  // --- MISSING / INCOMPLETE EVIDENCE ---
  {
    ticker: "NODATA",
    companyName: "NoData Corp (fictional)",
    businessActivity: { classification: "technology", description: "Software", source: "demo-fixture" },
    financials: null,
  },
  {
    ticker: "PARTIAL",
    companyName: "Partial Info Ltd (fictional)",
    businessActivity: { classification: "industrials", description: "Machinery", source: "demo-fixture" },
    financials: {
      marketCap: 5_000_000_000,
      totalAssets: null,
      interestBearingDebt: null,
      cashAndInterestBearingSecurities: null,
      accountsReceivable: null,
      totalRevenue: 4_000_000_000,
      impureIncome: 100_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "NOCLASS",
    companyName: "Unclassified Industries (fictional)",
    businessActivity: null,
    financials: {
      marketCap: 8_000_000_000,
      totalAssets: 6_000_000_000,
      interestBearingDebt: 1_000_000_000,
      cashAndInterestBearingSecurities: 500_000_000,
      accountsReceivable: 800_000_000,
      totalRevenue: 5_000_000_000,
      impureIncome: 50_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "STALE",
    companyName: "Stale Data Corp (fictional)",
    businessActivity: { classification: "technology", description: "Software", source: "demo-fixture" },
    financials: {
      marketCap: 12_000_000_000,
      totalAssets: 8_000_000_000,
      interestBearingDebt: 1_500_000_000,
      cashAndInterestBearingSecurities: 800_000_000,
      accountsReceivable: 600_000_000,
      totalRevenue: 7_000_000_000,
      impureIncome: 50_000_000,
      periodEnd: "2024-01-15",
      source: "demo-fixture",
    },
  },

  // --- ADDITIONAL PASSES (diverse sectors) ---
  {
    ticker: "GOOGL",
    companyName: "Alphabet Inc",
    businessActivity: { classification: "technology", description: "Internet services & AI", source: "demo-fixture" },
    financials: {
      marketCap: 2_100_000_000_000,
      totalAssets: 402_000_000_000,
      interestBearingDebt: 28_000_000_000,
      cashAndInterestBearingSecurities: 100_000_000_000,
      accountsReceivable: 42_000_000_000,
      totalRevenue: 340_000_000_000,
      impureIncome: 900_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
  {
    ticker: "LIN",
    companyName: "Linde PLC",
    businessActivity: { classification: "materials", description: "Industrial gases", source: "demo-fixture" },
    financials: {
      marketCap: 210_000_000_000,
      totalAssets: 80_000_000_000,
      interestBearingDebt: 18_000_000_000,
      cashAndInterestBearingSecurities: 5_000_000_000,
      accountsReceivable: 5_000_000_000,
      totalRevenue: 33_000_000_000,
      impureIncome: 100_000_000,
      periodEnd: "2026-06-30",
      source: "demo-fixture",
    },
  },
];

export class DemoFixtureProvider extends EvidenceProvider {
  constructor() {
    super();
    this._byTicker = new Map(fixtures.map((f) => [f.ticker.toUpperCase(), f]));
  }

  get name() {
    return "Demo Fixture Provider (fictional data)";
  }

  get isDemo() {
    return true;
  }

  lookupTicker(ticker) {
    const key = String(ticker || "").trim().toUpperCase();
    const hit = this._byTicker.get(key);
    if (!hit) return null;
    return { ticker: hit.ticker, companyName: hit.companyName };
  }

  listTickers() {
    return fixtures.map((f) => ({ ticker: f.ticker, companyName: f.companyName }));
  }

  getEvidence(ticker) {
    const key = String(ticker || "").trim().toUpperCase();
    const hit = this._byTicker.get(key);
    if (!hit) return null;
    return { ...hit };
  }
}
