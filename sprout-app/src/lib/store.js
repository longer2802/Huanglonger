import { useSyncExternalStore } from "react";
import * as db from "./db";
import { computeEdd, diffDays, isValidDate, todayTW, validatePregnancy } from "./dates";
import { planTodos, ruleByKey, todoId } from "./rules";
import { validateRecord } from "./records";

// One in-memory copy of the IndexedDB data, shared by every screen.
const EMPTY = {
  ready: false,
  error: null,
  family: null,
  settings: { key: "settings", icsDetail: false, alarmDay: true, alarmHours: true, activeSubject: "mother" },
  people: [],
  records: [],
  todos: [],
  answers: [],
};

let state = EMPTY;
const listeners = new Set();

function emit(next) {
  state = next;
  for (const l of listeners) l();
}

export function getState() {
  return state;
}

export function useSprout() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => EMPTY,
  );
}

function fromRaw(raw) {
  const meta = Object.fromEntries(raw.meta.map((m) => [m.key, m]));
  return {
    ready: true,
    error: null,
    family: meta.family ?? null,
    settings: { ...EMPTY.settings, ...(meta.settings ?? {}) },
    people: raw.people.sort((a, b) => (a.role === b.role ? String(a.createdAt).localeCompare(String(b.createdAt)) : a.role === "mother" ? -1 : 1)),
    records: raw.records.sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)),
    todos: raw.todos,
    answers: raw.answers,
  };
}

export async function reload() {
  try {
    emit(fromRaw(await db.loadAll()));
  } catch (e) {
    emit({ ...EMPTY, ready: true, error: e?.message || "讀取本機資料失敗" });
  }
}

function uid(prefix) {
  const r = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${r}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function commit(change) {
  await db.write(change);
  await reload();
}

// Recalculate suggested to-dos after any change to dates or people.
async function replan(family, people, extraKeys = []) {
  const today = todayTW();
  const result = planTodos({ family, people, todos: state.todos, today, extraKeys });
  await db.write({ put: { todos: result.todos } });
  return result;
}

// ---------- Family set-up ----------

// Real data replaces the example family completely: nothing from the demo
// (records, to-dos, answers, reminder settings) is carried over.
async function clearDemo() {
  if (!state.family?.demo) return;
  await db.clearAll();
  state = { ...state, family: null, settings: { ...EMPTY.settings }, people: [], records: [], todos: [], answers: [] };
}

export async function startPregnancy({ pregnancy, handbookDate, motherName, clinic, clinicPhone }) {
  const today = todayTW();
  const errors = validatePregnancy(pregnancy, today);
  if (errors.length) throw new Error(errors.join("\n"));
  await clearDemo();
  const family = {
    key: "family",
    stage: "pregnant",
    pregnancy,
    edd: computeEdd(pregnancy),
    handbookDate: isValidDate(handbookDate) ? handbookDate : null,
    startedOn: today,
    deliveryDate: null,
    createdAt: nowIso(),
  };
  const mother = { id: "mother", role: "mother", nickname: motherName?.trim() || "媽媽", clinic: clinic || "", clinicPhone: clinicPhone || "", createdAt: nowIso() };
  await db.write({ put: { meta: [family], people: [mother] } });
  state = { ...state, todos: [] };
  await replan(family, [mother]);
  await reload();
}

export async function startBorn({ baby, deliveryDate, motherName, clinic, clinicPhone }) {
  const today = todayTW();
  const errors = validateBaby(baby, today);
  if (!isValidDate(deliveryDate)) errors.push("請填寫有效的生產日期。");
  if (errors.length) throw new Error(errors.join("\n"));
  await clearDemo();
  const family = { key: "family", stage: "born", pregnancy: null, edd: null, handbookDate: null, startedOn: today, deliveryDate, createdAt: nowIso() };
  const mother = { id: "mother", role: "mother", nickname: motherName?.trim() || "媽媽", clinic: clinic || "", clinicPhone: clinicPhone || "", createdAt: nowIso() };
  const b = newBaby(baby);
  await db.write({ put: { meta: [family], people: [mother, b] } });
  state = { ...state, todos: [] };
  await replan(family, [mother, b]);
  await updateSettings({ activeSubject: b.id });
}

export function validateBaby(baby, today) {
  const errors = [];
  if (!baby?.nickname?.trim()) errors.push("請幫寶寶取個暱稱（可以是小名）。");
  if (!isValidDate(baby?.birthDate)) errors.push("請填寫有效的出生日期。");
  else if (diffDays(baby.birthDate, today) > 0) errors.push("出生日期不能晚於今天。");
  if (baby?.gestWeeks !== undefined && baby.gestWeeks !== "" && (Number(baby.gestWeeks) < 20 || Number(baby.gestWeeks) > 44)) {
    errors.push("出生週數請填 20 到 44。");
  }
  return errors;
}

function newBaby(baby) {
  return {
    id: uid("baby"),
    role: "baby",
    nickname: baby.nickname.trim(),
    sex: baby.sex === "boy" || baby.sex === "girl" ? baby.sex : "",
    birthDate: baby.birthDate,
    birthTime: baby.birthTime || "",
    gestWeeks: baby.gestWeeks ?? "",
    birthWeight: baby.birthWeight ?? "",
    birthLength: baby.birthLength ?? "",
    birthHead: baby.birthHead ?? "",
    clinic: baby.clinic || "",
    clinicPhone: baby.clinicPhone || "",
    allergies: baby.allergies || "",
    note: baby.note || "",
    createdAt: nowIso(),
  };
}

// Changing the due date moves only untouched suggestions.
export async function updatePregnancy(pregnancy) {
  const today = todayTW();
  const errors = validatePregnancy(pregnancy, today);
  if (errors.length) throw new Error(errors.join("\n"));
  const family = { ...state.family, pregnancy, edd: computeEdd(pregnancy) };
  await db.write({ put: { meta: [family] } });
  const result = await replan(family, state.people);
  await reload();
  return result;
}

// Birth: keeps the pregnancy timeline, adds the baby, starts postpartum care.
export async function recordBirth({ baby, deliveryDate }) {
  const today = todayTW();
  const errors = validateBaby(baby, today);
  if (!isValidDate(deliveryDate)) errors.push("請填寫有效的生產日期。");
  else if (diffDays(deliveryDate, today) > 0) errors.push("生產日期不能晚於今天。");
  if (errors.length) throw new Error(errors.join("\n"));
  const family = { ...state.family, stage: "born", deliveryDate };
  const b = newBaby(baby);
  const people = [...state.people, b];
  // Prenatal suggestions that never happened are closed, not deleted.
  const closed = state.todos
    .filter((t) => t.subjectId === "mother" && ["suggested", "past"].includes(t.status) && ruleByKey(t.ruleKey)?.basis === "ga")
    .map((t) => ({ ...t, status: "cancelled", cancelReason: "寶寶已出生" }));
  await db.write({ put: { meta: [family], people: [b], todos: closed } });
  state = { ...state, todos: state.todos.map((t) => closed.find((c) => c.id === t.id) ?? t) };
  await replan(family, people);
  await updateSettings({ activeSubject: b.id });
  return b;
}

export async function addBaby(baby) {
  const errors = validateBaby(baby, todayTW());
  if (errors.length) throw new Error(errors.join("\n"));
  const b = newBaby(baby);
  const people = [...state.people, b];
  await db.write({ put: { people: [b] } });
  await replan(state.family, people);
  await reload();
  return b;
}

export async function updatePerson(person) {
  if (person.role === "baby") {
    const errors = validateBaby(person, todayTW());
    if (errors.length) throw new Error(errors.join("\n"));
  }
  const people = state.people.map((p) => (p.id === person.id ? person : p));
  await db.write({ put: { people: [person] } });
  const result = await replan(state.family, people);
  await reload();
  return result;
}

export async function deletePerson(id) {
  if (id === "mother") throw new Error("媽媽的資料不能單獨刪除；要清空請用「刪除全部資料」。");
  await commit({
    del: {
      people: [id],
      records: state.records.filter((r) => r.subjectId === id).map((r) => r.id),
      todos: state.todos.filter((t) => t.subjectId === id).map((t) => t.id),
      answers: state.answers.filter((a) => a.subjectId === id).map((a) => a.id),
    },
  });
  if (state.settings.activeSubject === id) await updateSettings({ activeSubject: "mother" });
}

export async function updateSettings(patch) {
  const settings = { ...state.settings, ...patch, key: "settings" };
  await commit({ put: { meta: [settings] } });
}

// ---------- Records ----------

export async function saveRecord(input) {
  const today = todayTW();
  const existing = input.id ? state.records.find((r) => r.id === input.id) : null;
  const record = {
    ...input,
    id: input.id || uid("rec"),
    source: "family",
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    history: existing
      ? [...(existing.history || []), { at: nowIso(), action: "edit", before: { date: existing.date, time: existing.time, fields: existing.fields } }]
      : [{ at: nowIso(), action: "create" }],
  };
  const errors = validateRecord(record, { records: state.records, isValidDate, today, diffDays });
  if (errors.length) throw new Error(errors.join("\n"));

  const put = { records: [record] };
  // A recorded vaccine dose completes its matching suggestion.
  if (record.kind === "vaccine" && record.fields?.vaccineCode) {
    const t = state.todos.find((x) => x.id === todoId(record.subjectId, `vax-${record.fields.vaccineCode}-${Number(record.fields.dose)}`));
    if (t && t.status !== "done") put.todos = [{ ...t, status: "done", doneDate: record.date, linkedRecordId: record.id }];
  }
  await commit({ put });
  return record;
}

export async function deleteRecord(id) {
  const rec = state.records.find((r) => r.id === id);
  const put = {};
  const linked = state.todos.find((t) => t.linkedRecordId === id);
  if (linked) {
    const rest = { ...linked };
    delete rest.linkedRecordId;
    delete rest.doneDate;
    put.todos = [{ ...rest, status: linked.bookedDate ? "booked" : "suggested" }];
  }
  await commit({ put, del: { records: [rec?.id ?? id] } });
}

// ---------- To-dos ----------

export async function addRuleTodo(subjectId, ruleKey) {
  const id = todoId(subjectId, ruleKey);
  if (state.todos.some((t) => t.id === id)) return id;
  await replan(state.family, state.people, [id]);
  await reload();
  return id;
}

export async function addCustomTodo({ subjectId, title, date, time, type = "custom", note = "" }) {
  if (!title?.trim()) throw new Error("請填寫待辦名稱。");
  if (!isValidDate(date)) throw new Error("請選擇日期。");
  const todo = {
    id: uid("todo"),
    subjectId,
    ruleKey: null,
    type,
    title: title.trim(),
    note,
    suggestStart: date,
    suggestEnd: date,
    status: time ? "booked" : "suggested",
    bookedDate: time ? date : null,
    bookedTime: time || null,
    createdOn: todayTW(),
  };
  await commit({ put: { todos: [todo] } });
  return todo;
}

function patchTodo(id, patch) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) throw new Error("找不到這個待辦");
  return { ...t, ...patch };
}

// Booking or moving a booked item. If it was exported, the phone calendar now
// has an old copy: flag it so the family is reminded to re-export.
export async function bookTodo(id, { date, time, place }) {
  if (!isValidDate(date)) throw new Error("請選擇有效的日期。");
  if (!/^\d{2}:\d{2}$/.test(time || "")) throw new Error("請選擇時間。");
  const t = state.todos.find((x) => x.id === id);
  const changed = t.exportedAt && (t.exported?.date !== date || t.exported?.time !== time);
  await commit({ put: { todos: [patchTodo(id, { status: "booked", bookedDate: date, bookedTime: time, place: place ?? t.place ?? "", needsCalendarUpdate: changed || t.needsCalendarUpdate || false })] } });
  return { changed };
}

export async function completeTodo(id, date) {
  await commit({ put: { todos: [patchTodo(id, { status: "done", doneDate: isValidDate(date) ? date : todayTW() })] } });
}

export async function reopenTodo(id) {
  const t = state.todos.find((x) => x.id === id);
  await commit({ put: { todos: [patchTodo(id, { status: t.bookedDate ? "booked" : "suggested", doneDate: null })] } });
}

export async function cancelTodo(id) {
  const t = state.todos.find((x) => x.id === id);
  await commit({ put: { todos: [patchTodo(id, { status: "cancelled", needsCalendarUpdate: !!t.exportedAt })] } });
}

export async function deleteTodo(id) {
  await commit({ del: { todos: [id] } });
}

export async function markExported(id, { date, time, cancelled = false }) {
  const t = state.todos.find((x) => x.id === id);
  await commit({
    put: {
      todos: [
        patchTodo(id, {
          exportedAt: nowIso(),
          exportSeq: (t.exportSeq ?? -1) + 1,
          exported: cancelled ? null : { date, time },
          needsCalendarUpdate: false,
        }),
      ],
    },
  });
}

// ---------- Check-ins ----------

export async function saveAnswer({ subjectId, stage, answer, items = [] }) {
  const record = {
    id: `${subjectId}:${stage.key}:v${stage.version}`,
    subjectId,
    stageKey: stage.key,
    questionVersion: stage.version,
    answer,
    items,
    answeredAt: nowIso(),
  };
  await commit({ put: { answers: [record] } });
  return record;
}

// ---------- Whole data set ----------

export async function wipeAll() {
  await db.clearAll();
  await reload();
}

export async function replaceEverything(snapshot) {
  await db.replaceAll(snapshot);
  await reload();
}

export function snapshotForBackup() {
  const { family, settings, people, records, todos, answers } = state;
  return { meta: [family, settings].filter(Boolean), people, records, todos, answers };
}
