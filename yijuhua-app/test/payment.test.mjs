import assert from "node:assert/strict";
import { paymentStats, paymentMethodOf, roundedShares } from "../src/lib/paymentStats.js";
const ok = (m) => console.log("PASS", m);
const recs = [
  { type: "expense", amount: 150, paymentMethod: "現金" },
  { type: "expense", amount: 1200, paymentMethod: "信用卡" },
  { type: "expense", amount: 800, paymentMethod: "信用卡" },
  { type: "expense", amount: 15000, paymentMethod: "銀行轉帳" },
  { type: "expense", amount: 50 },                       // old record, no method → 現金
  { type: "expense", amount: 99, paymentMethod: "轉帳" }, // old name → 銀行轉帳
  { type: "income", amount: 40000 },
  { type: "transfer", amount: 5000 },
];
const s = paymentStats(recs);
assert.equal(s.total, 17299);
assert.deepEqual(s.rows.map((r) => [r.name, r.amount, r.count]), [["現金", 200, 2], ["信用卡", 2000, 2], ["銀行轉帳", 15099, 2]]);
ok("totals by method; income and account transfers excluded; old/missing methods mapped");
const pct = roundedShares(s.rows);
assert.equal(pct.reduce((a, b) => a + b, 0), 100);
assert.deepEqual(pct, [1, 12, 87]);
ok("percentages add up to 100");
assert.deepEqual(roundedShares(paymentStats([]).rows), [0, 0, 0]);
assert.deepEqual(roundedShares(paymentStats([{ type: "expense", amount: 1, paymentMethod: "信用卡" }]).rows), [0, 100, 0]);
ok("empty period and single method");
assert.equal(paymentMethodOf({ paymentMethod: "悠遊卡" }), "現金");
console.log("PAYMENT OK");
