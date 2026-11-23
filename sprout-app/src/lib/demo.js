import { addDays, addMonths, computeEdd, todayTW } from "./dates";
import { planTodos } from "./rules";

// Fictional example families. Every name ends in （範例） and the family record
// carries demo: true, so the app always shows the example banner.
function rec(id, subjectId, kind, date, fields, time = "") {
  return { id, subjectId, kind, date, time, fields, source: "family", demo: true, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`, history: [{ at: `${date}T08:00:00.000Z`, action: "create" }] };
}

export function demoPregnancy(today = todayTW()) {
  const pregnancy = { basis: "ga", gaWeeks: 12, gaDays: 0, gaDate: today };
  const family = {
    key: "family",
    stage: "pregnant",
    demo: true,
    pregnancy,
    edd: computeEdd(pregnancy),
    handbookDate: today,
    startedOn: today,
    deliveryDate: null,
    createdAt: new Date().toISOString(),
  };
  const mother = { id: "mother", role: "mother", nickname: "範例媽媽", clinic: "範例婦產科診所", clinicPhone: "", createdAt: "2026-01-01" };
  const records = [
    rec("demo-r1", "mother", "prenatal", today, { clinic: "範例婦產科診所", weight: "55.2", bpSys: "112", bpDia: "70", tests: "例行檢查、血液常規", doctorNotes: "（範例）下次回診帶健康手冊", questions: "（範例）可以吃哪些營養補充品？" }, "10:00"),
  ];
  const { todos } = planTodos({ family, people: [mother], todos: [], today });
  return { meta: [family, { key: "settings", activeSubject: "mother", icsDetail: false, alarmDay: true, alarmHours: true }], people: [mother], records, todos, answers: [] };
}

export function demoBorn(today = todayTW()) {
  const delivery = addDays(today, -75);
  const family = { key: "family", stage: "born", demo: true, pregnancy: null, edd: null, handbookDate: null, startedOn: addDays(today, -75), deliveryDate: delivery, createdAt: new Date().toISOString() };
  const mother = { id: "mother", role: "mother", nickname: "範例媽媽", clinic: "範例婦產科診所", clinicPhone: "", createdAt: "2026-01-01" };
  const bean = { id: "baby-demo-bean", role: "baby", nickname: "小豆（範例）", birthDate: delivery, birthTime: "08:30", gestWeeks: "39", birthWeight: "3.1", birthLength: "50", birthHead: "34", clinic: "範例小兒科", clinicPhone: "", allergies: "", note: "", createdAt: "2026-01-02" };
  const millet = { id: "baby-demo-millet", role: "baby", nickname: "小米（範例）", birthDate: addMonths(today, -14), birthTime: "", gestWeeks: "38", birthWeight: "2.9", birthLength: "49", birthHead: "33", clinic: "範例小兒科", clinicPhone: "", allergies: "（範例）無已知過敏", note: "", createdAt: "2026-01-01" };
  const people = [mother, millet, bean];
  const records = [
    rec("demo-b1", bean.id, "vaccine", delivery, { vaccineCode: "hepb", dose: "1", clinic: "範例醫院", observation: "（範例）無明顯不適" }),
    rec("demo-b2", bean.id, "vaccine", addMonths(delivery, 1), { vaccineCode: "hepb", dose: "2", clinic: "範例小兒科" }),
    rec("demo-b3", bean.id, "growth", addMonths(delivery, 1), { length: "54.5", weight: "4.3", head: "37" }),
    rec("demo-b4", bean.id, "feeding", today, { method: "瓶餵母乳", amount: "120" }, "07:30"),
    rec("demo-b5", bean.id, "diaper", today, { type: "便便", stoolColor: "8", texture: "糊狀" }, "09:10"),
    rec("demo-m1", millet.id, "vaccine", addMonths(millet.birthDate, 12), { vaccineCode: "mmr", dose: "1", clinic: "範例小兒科" }),
    rec("demo-m2", millet.id, "milestone", addMonths(millet.birthDate, 13), { title: "（範例）第一次放手走路" }),
    rec("demo-m3", millet.id, "visit", addDays(today, -10), { clinic: "範例小兒科", reason: "（範例）流鼻水", diagnosis: "（範例）照醫師說明抄寫", orders: "（範例）照藥袋抄寫" }),
    rec("demo-p1", "mother", "postpartum", addDays(delivery, 10), { clinic: "範例婦產科診所", mood: "還可以", feeding: "（範例）親餵加瓶餵" }),
  ];
  let { todos } = planTodos({ family, people, todos: [], today });
  const done = new Map([
    [`${bean.id}:vax-hepb-1`, delivery],
    [`${bean.id}:vax-hepb-2`, addMonths(delivery, 1)],
    [`${millet.id}:vax-mmr-1`, addMonths(millet.birthDate, 12)],
    ["mother:pp-1", addDays(delivery, 10)],
  ]);
  todos = todos.map((t) => (done.has(t.id) ? { ...t, status: "done", doneDate: done.get(t.id) } : t));
  return {
    meta: [family, { key: "settings", activeSubject: bean.id, icsDetail: false, alarmDay: true, alarmHours: true }],
    people,
    records,
    todos,
    answers: [],
  };
}
