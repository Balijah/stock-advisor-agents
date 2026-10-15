/**
 * Evidence provider interface.
 *
 * Any concrete provider must implement these methods. The demo fixture
 * provider (below) ships with the app. Real providers (Zoya, Musaffa,
 * SEC EDGAR XBRL, etc.) plug in by exporting the same shape.
 *
 * Evidence shape returned by getEvidence(ticker):
 * {
 *   ticker: string,
 *   companyName: string,
 *   businessActivity: {
 *     classification: string,   // one of the methodology's activity keys
 *     description: string,
 *     source: string,
 *   },
 *   financials: {
 *     marketCap: number,
 *     totalAssets: number,
 *     interestBearingDebt: number,
 *     cashAndInterestBearingSecurities: number,
 *     accountsReceivable: number,
 *     totalRevenue: number,
 *     impureIncome: number,
 *     periodEnd: string (ISO date),
 *     source: string,
 *   },
 * }
 */

export class EvidenceProvider {
  /**
   * Look up a ticker in this provider's security directory.
   * @param {string} ticker
   * @returns {{ ticker: string, companyName: string } | null}
   */
  lookupTicker(_ticker) {
    throw new Error("lookupTicker() not implemented");
  }

  /**
   * List all known tickers.
   * @returns {Array<{ ticker: string, companyName: string }>}
   */
  listTickers() {
    throw new Error("listTickers() not implemented");
  }

  /**
   * Retrieve evidence for a given ticker.
   * @param {string} ticker
   * @returns {object|null} evidence object or null if not found
   */
  getEvidence(_ticker) {
    throw new Error("getEvidence() not implemented");
  }

  /**
   * Human-readable name for this provider.
   * @returns {string}
   */
  get name() {
    return "EvidenceProvider (base)";
  }

  /**
   * Whether this provider returns demo/fixture data.
   * @returns {boolean}
   */
  get isDemo() {
    return false;
  }
}
