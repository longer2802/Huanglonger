import assert from "node:assert/strict";
import cases from "./growth-cases.json";
import who from "../../who-dl.json";
import { ageLabel, setWhoData, tableOf, INDICATORS, lmsAt, zScore, normalCdf, bandOf, chartDay, growthPoints, describe, pctText, formatAgeDays } from "../app/src/lib/growth";
const ok = (m) => console.log("PASS", m);
setWhoData(who);
const T = (ind, sex) => tableOf(INDICATORS[ind], sex);

// 1. Percentiles match the full WHO daily table at sampled and in-between days.
let worst = 0;
for (const [ind, sex, day, x, pct] of cases) {
  const got = normalCdf(zScore(x, lmsAt(T(ind, sex), day))) * 100;
  worst = Math.max(worst, Math.abs(got - pct));
}
assert.ok(worst < 0.15, `worst ${worst}`);
ok(`WHO percentiles reproduced for ${cases.length} reference points (max diff ${worst.toFixed(3)} pct points)`);

// 2. Handbook example (p.11): a 1.5-month boy weighing 5 kg is at about the 50th percentile.
const p = normalCdf(zScore(5, lmsAt(T("weight", "boy"), Math.round(1.5 * 30.4375)))) * 100;
assert.ok(p > 40 && p < 60, `got ${p}`);
ok(`handbook example: 1.5 個月 5 kg 男寶寶 → ${pctText(p)}`);

// 3. Bands follow the five printed lines.
assert.deepEqual([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(bandOf), [0, 1, 2, 3, 4, 5]);
ok("bands: <3, 3–15, 15–50, 50–85, 85–97, >97");

// 4. Corrected age for babies born early, until 2 years.
assert.deepEqual(chartDay({ birthDate: "2026-01-01", gestWeeks: "34" }, "2026-03-02"), { day: 18, actual: 60, corrected: true });
assert.equal(chartDay({ birthDate: "2026-01-01", gestWeeks: "39" }, "2026-03-02").corrected, false);
assert.equal(chartDay({ birthDate: "2024-01-01", gestWeeks: "34" }, "2026-03-02").corrected, false);
ok("早產兒用矯正年齡（滿 2 歲後不再矯正）");

// 5. Points, latest position, and crossing two bands.
const baby = { id: "b", sex: "girl", birthDate: "2026-01-01", gestWeeks: "39", birthWeight: "3.2" };
const W = T("weight", "girl");
const at = (d, zz) => { const [L, M, S] = lmsAt(W, d); return (L === 0 ? M * Math.exp(S * zz) : M * (1 + L * S * zz) ** (1 / L)).toFixed(2); };
const day = (n) => { const d = new Date(Date.UTC(2026, 0, 1 + n)); return d.toISOString().slice(0, 10); };
const recs = [
  { id: "r1", subjectId: "b", kind: "growth", date: day(60), fields: { weight: at(60, 0.6) } },
  { id: "r2", subjectId: "b", kind: "growth", date: day(120), fields: { weight: at(120, 0.5) } },
  { id: "x", subjectId: "other", kind: "growth", date: day(120), fields: { weight: "9" } },
];
let pts = growthPoints(baby, recs, "weight");
assert.equal(pts.length, 3);
assert.ok(pts[0].birth);
let d = describe(pts);
assert.ok(d.inRange && !d.crossing);
ok("steady growth: inside 3–97, no crossing");
recs.push({ id: "r3", subjectId: "b", kind: "growth", date: day(180), fields: { weight: at(180, -1.3) } });
d = describe(growthPoints(baby, recs, "weight"));
assert.ok(d.crossing && !d.crossing.up && d.inRange);
ok("drop from 50–85 to 3–15 → flagged as crossing two bands (handbook A→F)");
recs.push({ id: "r4", subjectId: "b", kind: "growth", date: day(240), fields: { weight: at(240, 2.3) } });
d = describe(growthPoints(baby, recs, "weight"));
assert.ok(!d.inRange && d.latest.band === 5);
ok("above the 97th line → out of the 3–97 range");
assert.equal(growthPoints({ ...baby, sex: "" }, recs, "weight").length, 0);
ok("no sex chosen → no chart (boys and girls use different charts)");

// 6. Length switches from lying (≤ 2 years) to standing height at day 731.
const lb = T("length", "boy");
assert.ok(lmsAt(lb, 730)[1] - lmsAt(lb, 731)[1] > 0.5);
ok("身長→身高 step at 2 years, as printed in the handbook");
assert.equal(formatAgeDays(45), "45 天");
assert.equal(formatAgeDays(400), "13 個月");
assert.equal(formatAgeDays(800), "2 歲 2 個月");
const bb = { birthDate: "2025-09-24", gestWeeks: "38" };
assert.equal(ageLabel(bb, { date: "2026-09-24" }), "12 個月");
assert.equal(ageLabel(bb, { date: "2026-03-24" }), "6 個月");
assert.equal(ageLabel(bb, { date: "2025-10-24" }), "30 天");
assert.equal(ageLabel(bb, { birth: true }), "出生");
assert.equal(ageLabel(bb, { date: "2026-01-01", corrected: true, day: 45 }), "45 天（矯正）");
ok("age labels use calendar months (12 個月 on the 1-year date)");
console.log("GROWTH OK");
