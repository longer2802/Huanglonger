import { useCallback, useEffect, useState } from "react";
import { addDays, endOfMonth, makeDate, startOfWeek, weekday } from "@/lib/dates";

// 固定繳費與預定花費：存在這支手機（與帳本相同）
const RECURRING_KEY = "yijuhua-recurring-v1";
const PLANNED_KEY = "yijuhua-planned-v1";
export const DUE_SOON_DAYS = 7;
export const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function read(key) {
  try {
    const list = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(key, list) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export const newScheduleId = () =>
  `sch-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

// 某月的扣款日：31 號遇到小月就用月底
function monthlyDate(year, month, day) {
  const last = Number(endOfMonth(makeDate(year, month, 1)).slice(8, 10));
  return makeDate(year, month, Math.min(day, last));
}

// 指定週期中「本期」的扣款日
function periodDate(item, ref) {
  const year = Number(ref.slice(0, 4));
  const month = Number(ref.slice(5, 7));
  if (item.cycle === "weekly") return addDays(startOfWeek(ref), item.weekday === 0 ? 6 : item.weekday - 1);
  if (item.cycle === "yearly") return monthlyDate(year, item.month, item.day);
  return monthlyDate(year, month, item.day);
}

function nextPeriod(item, date) {
  if (item.cycle === "weekly") return addDays(date, 7);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (item.cycle === "yearly") return monthlyDate(year + 1, item.month, item.day);
  return month === 12 ? monthlyDate(year + 1, 1, item.day) : monthlyDate(year, month + 1, item.day);
}

// 下一筆還沒記入帳本的扣款日（本期沒記就是本期，可能已過期）
export function nextDue(item, today) {
  const paid = new Set(item.paidPeriods || []);
  let due = periodDate(item, today);
  // 建立當天之前的期數不算（建立前應已自行繳過）；已記入帳本的期數略過
  for (let i = 0; i < 60 && (paid.has(due) || (item.createdOn && due < item.createdOn)); i += 1) {
    due = nextPeriod(item, due);
  }
  return due;
}

export function dueStatus(due, today) {
  if (due < today) return "overdue";
  if (due <= addDays(today, DUE_SOON_DAYS)) return "soon";
  return "later";
}

export function cycleLabel(item) {
  if (item.cycle === "weekly") return `每週${WEEK_LABELS[item.weekday]}`;
  if (item.cycle === "yearly") return `每年 ${item.month} 月 ${item.day} 日`;
  return `每月 ${item.day} 日`;
}

// 每月約略金額（統計用）
export function monthlyEquivalent(item) {
  if (item.cycle === "weekly") return (item.amount * 52) / 12;
  if (item.cycle === "yearly") return item.amount / 12;
  return item.amount;
}

function useStoredList(key) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setItems(read(key));
    setReady(true);
  }, [key]);
  const save = useCallback(
    (updater) => {
      setItems((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (!write(key, next)) throw new Error("無法寫入手機儲存空間");
        return next;
      });
    },
    [key]
  );
  return [items, save, ready];
}

export function useRecurring() {
  const [items, save, ready] = useStoredList(RECURRING_KEY);
  return {
    items,
    ready,
    upsert: (item) => save((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item])),
    remove: (id) => save((list) => list.filter((i) => i.id !== id)),
    markPaid: (id, due) =>
      save((list) =>
        list.map((i) => (i.id === id ? { ...i, paidPeriods: [...new Set([...(i.paidPeriods || []), due])].slice(-24) } : i))
      ),
  };
}

export function usePlanned() {
  const [items, save, ready] = useStoredList(PLANNED_KEY);
  return {
    items,
    ready,
    upsert: (item) => save((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item])),
    remove: (id) => save((list) => list.filter((i) => i.id !== id)),
    setDone: (id, done) => save((list) => list.map((i) => (i.id === id ? { ...i, done } : i))),
  };
}

export { weekday };
