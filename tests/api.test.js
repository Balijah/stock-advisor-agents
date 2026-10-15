import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";

function makeRequest(app, method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const url = `http://localhost:${port}${path}`;
      const opts = { method, headers: { "content-type": "application/json", ...headers } };
      if (body) opts.body = JSON.stringify(body);
      fetch(url, opts)
        .then(async (res) => {
          const json = await res.json();
          server.close();
          resolve({ status: res.status, json });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

test("GET /api/v1/health returns ok", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/health");
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.equal(json.status, "ok");
  assert.equal(json.demo, true);
});

test("GET /api/v1/methodologies returns list", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/methodologies");
  assert.equal(status, 200);
  assert.ok(json.data.length >= 1);
  assert.equal(json.data[0].id, "aaoifi-placeholder");
});

test("GET /api/v1/methodologies/aaoifi-placeholder returns methodology", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/methodologies/aaoifi-placeholder");
  assert.equal(status, 200);
  assert.equal(json.data.id, "aaoifi-placeholder");
  assert.ok(json.data.financialRatios);
});

test("GET /api/v1/methodologies/unknown returns 404", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/methodologies/unknown");
  assert.equal(status, 404);
  assert.equal(json.success, false);
});

test("GET /api/v1/tickers returns list of tickers", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/tickers");
  assert.equal(status, 200);
  assert.ok(json.data.length >= 20);
  assert.ok(json.data[0].ticker);
  assert.ok(json.data[0].companyName);
  assert.equal(json.demo, true);
});

test("GET /api/v1/screen/AAPL returns pass result", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/screen/AAPL");
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.equal(json.demo, true);
  assert.equal(json.data.outcome, "pass");
  assert.equal(json.data.ticker, "AAPL");
  assert.ok(json.data.checks.length >= 5);
  assert.ok(json.data.methodology);
  assert.ok(json.data.disclaimer);
});

test("GET /api/v1/screen/JPM returns fail result", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/screen/JPM");
  assert.equal(status, 200);
  assert.equal(json.data.outcome, "fail");
});

test("GET /api/v1/screen/UNKNOWN returns 404 for unknown ticker", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/screen/UNKNOWN");
  assert.equal(status, 404);
  assert.equal(json.success, false);
  assert.equal(json.error.code, "UNKNOWN_TICKER");
});

test("GET /api/v1/screen is case-insensitive", async () => {
  const app = createApp();
  const { status, json } = await makeRequest(app, "GET", "/api/v1/screen/aapl");
  assert.equal(status, 200);
  assert.equal(json.data.ticker, "AAPL");
});

test("auth rejects when API_KEY is set", async () => {
  const original = process.env.API_KEY;
  process.env.API_KEY = "test-secret-key";
  try {
    const app = createApp();
    const { status, json } = await makeRequest(app, "GET", "/api/v1/screen/AAPL");
    assert.equal(status, 401);
    assert.equal(json.error.code, "UNAUTHORIZED");
  } finally {
    if (original === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = original;
  }
});

test("auth passes with correct Bearer token", async () => {
  const original = process.env.API_KEY;
  process.env.API_KEY = "test-secret-key";
  try {
    const app = createApp();
    const { status, json } = await makeRequest(app, "GET", "/api/v1/screen/AAPL", {
      headers: { Authorization: "Bearer test-secret-key" },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
  } finally {
    if (original === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = original;
  }
});

test("health endpoint does not require auth", async () => {
  const original = process.env.API_KEY;
  process.env.API_KEY = "test-secret-key";
  try {
    const app = createApp();
    const { status } = await makeRequest(app, "GET", "/api/v1/health");
    assert.equal(status, 200);
  } finally {
    if (original === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = original;
  }
});
