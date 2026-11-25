// 一句話記帳：本機規則式解析引擎（免費、不連網、不使用 AI）
// 流程：正規化 → 日期 → 金額 → 拆筆 → 收支/轉帳 → 項目與商家 → 分類 → 信心度
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { DEFAULT_TZ, addDays, makeDate, startOfWeek, weekday, zonedParts } from "@/lib/dates";

// ---------- 中文數字 ----------
const CN_DIGIT = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_UNIT = { 十: 10, 百: 100, 千: 1000 };

// 一萬以下的一段：支援「四百」「一千三百九十」「五百六」（口語省略的下一位）
function parseSection(str) {
  let total = 0;
  let current = null;
  let lastUnit = null;
  let zeroSeen = false;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < str.length && /[0-9.]/.test(str[j])) j += 1;
      current = Number(str.slice(i, j));
      i = j - 1;
      continue;
    }
    if (ch in CN_DIGIT) {
      if (CN_DIGIT[ch] === 0) zeroSeen = true;
      else current = CN_DIGIT[ch];
      continue;
    }
    if (ch in CN_UNIT) {
      total += (current ?? 1) * CN_UNIT[ch];
      lastUnit = CN_UNIT[ch];
      current = null;
      zeroSeen = false;
    }
  }
  if (current != null) {
    // 口語：五百六 = 560、一千二 = 1200（最後一個數字沒有單位、且前面不是「零」）
    total += lastUnit && lastUnit >= 100 && !zeroSeen && current < 10 ? current * (lastUnit / 10) : current;
  }
  return total;
}

export function chineseToNumber(raw) {
  const str = String(raw).replace(/万/g, "萬");
  if (/^[0-9.]+$/.test(str)) return Number(str);
  if (str.includes("萬")) {
    const [high, low = ""] = str.split("萬");
    const highValue = (high ? parseSection(high) : 1) * 10000;
    if (!low) return highValue;
    // 三萬五 = 35000
    if (/^[一二兩两三四五六七八九]$/.test(low)) return highValue + CN_DIGIT[low] * 1000;
    return highValue + parseSection(low);
  }
  return parseSection(str);
}

// ---------- 正規化 ----------
export function normalizeText(input) {
  let text = String(input || "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[，、。！？；：]/g, (ch) => ({ "，": ",", "、": ",", "。": ",", "！": ",", "？": ",", "；": ",", "：": "," })[ch])
    .replace(/臺/g, "台")
    .replace(/块/g, "塊")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    .replace(/(?:NT\$|NTD|NT|＄|\$)\s*(\d+)/gi, "$1元")
    .replace(/(新台幣|台幣)\s*(\d+)/g, "$2元")
    .replace(/(\d+|[零〇一二兩两三四五六七八九十百千萬万]+)\s*(塊錢|塊|圓|元整|元|台幣)/g, "$1元")
    .replace(/一共|總共|合計/g, "共")
    .replace(/(嗯+|呃+|那個|然後|就是)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

// ---------- 日期 ----------
const WEEK_INDEX = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 0 };
const NUM_TOKEN = "(?:\\d{1,4}|[零〇一二兩两三四五六七八九十]{1,3})";

function parseDate(text, today) {
  let found = null;
  let consumed = text;
  const take = (regex, compute) => {
    if (found) return;
    const match = consumed.match(regex);
    if (!match) return;
    const result = compute(match);
    if (!result) return;
    found = result;
    consumed = consumed.replace(match[0], " ");
  };

  take(/大前天/, () => ({ date: addDays(today, -3), explicit: true }));
  take(/前天/, () => ({ date: addDays(today, -2), explicit: true }));
  take(/昨天|昨日|昨晚/, () => ({ date: addDays(today, -1), explicit: true }));
  take(/今天|今日|今早|今晚|剛剛|剛才/, () => ({ date: today, explicit: true, now: true }));
  take(/(上上|上|這|本)?(?:個)?(星期|禮拜|週|周)([一二三四五六日天1-7])/, (m) => {
    const target = WEEK_INDEX[m[3]];
    const monday = startOfWeek(today);
    const offset = target === 0 ? 6 : target - 1;
    if (m[1] === "上上") return { date: addDays(monday, offset - 14), explicit: true };
    if (m[1] === "上") return { date: addDays(monday, offset - 7), explicit: true };
    let date = addDays(monday, offset);
    // 沒說「上」：取最近一個已經過去（或今天）的那一天
    if (!m[1] && date > today) date = addDays(date, -7);
    return { date, explicit: true, now: date === today };
  });
  take(new RegExp(`(?:(\\d{4})年)?(${NUM_TOKEN})月(${NUM_TOKEN})(?:日|號)?`), (m) => {
    const thisYear = Number(today.slice(0, 4));
    const month = chineseToNumber(m[2]);
    const day = chineseToNumber(m[3]);
    let year = m[1] ? Number(m[1]) : thisYear;
    let date = makeDate(year, month, day);
    if (!date) return null;
    let yearGuessed = false;
    if (!m[1] && date > today) {
      date = makeDate(thisYear - 1, month, day);
      yearGuessed = true;
    }
    return date ? { date, explicit: true, yearGuessed } : null;
  });
  take(new RegExp(`(${NUM_TOKEN})(?:號|日)(?![本記])`), (m) => {
    const day = chineseToNumber(m[1]);
    if (!day || day > 31) return null;
    let date = makeDate(Number(today.slice(0, 4)), Number(today.slice(5, 7)), day);
    if (!date) return null;
    if (date > today) {
      const prev = addDays(`${today.slice(0, 7)}-01`, -1);
      date = makeDate(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)), day);
    }
    return date ? { date, explicit: true } : null;
  });

  return { date: found, rest: consumed };
}

// ---------- 金額 ----------
const MEASURE = "個件人位杯碗張次天點號月年份瓶台包盒顆本支雙條隻歲樓分秒歲間份公斤斤公里度";
const AMOUNT_VERB = /(花了?|付了?|繳了?|給了?|領到|收到|入帳|進帳|賺了?|共|是|要|用了?|刷了?|消費了?|吃了|喝了|買了|賣了?|捐了?|包了?)\s*$/;
const NUMBER_RUN = /\d+(?:\.\d+)?(?:[十百千萬万][零〇一二兩两三四五六七八九十百千萬万\d]*)?|[零〇一二兩两三四五六七八九十百千萬万]+/g;

function findAmounts(text) {
  const amounts = [];
  NUMBER_RUN.lastIndex = 0;
  let match;
  while ((match = NUMBER_RUN.exec(text))) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    const after = text.slice(end, end + 2);
    const before = text.slice(Math.max(0, start - 4), start);
    const value = chineseToNumber(raw);
    if (!Number.isFinite(value) || value <= 0) continue;

    const hasYuan = after.startsWith("元");
    const measured = new RegExp(`^\\s?[${MEASURE}]`).test(after) && !hasYuan;
    if (measured) continue;
    // 單獨的「一」「兩」（一起、一下、兩個…）不是金額
    if (/^[一二兩两]$/.test(raw) && !hasYuan) continue;

    let strength = 0;
    if (hasYuan) strength = 2;
    else if (AMOUNT_VERB.test(before)) strength = 2;
    else if (/[一-鿿A-Za-z]$/.test(before) && (/\d/.test(raw) || raw.length >= 2)) strength = 1; // 早餐80
    if (!strength) continue;

    const subtotal = /共\s*$/.test(before);
    amounts.push({ raw, value, start, end: hasYuan ? end + 1 : end, strength, subtotal });
  }
  return amounts;
}

// ---------- 收支與轉帳 ----------
const SELF_TRANSFER = /(轉|匯|存|移)(帳|款|錢)?(到|入|進|去)?\s*(我|自己)(的)?|(轉|匯|存|移).{0,16}(到|入|進|去)\s*(我|自己)|提款|領錢|領現|存錢|存款|儲值到自己/;
const OTHER_TRANSFER = /(轉|匯)(帳|款|錢)?(給|到)\s*(?!我|自己)([^\d,\s]{1,6})/;
const INCOME_VERB = /(領到|領了|收到|入帳|進帳|賺|拿到|發了?|領)/;

function detectIncome(text) {
  for (const cat of INCOME_CATEGORIES) {
    const keyword = cat.keywords.find((k) => text.includes(k));
    if (!keyword) continue;
    if (cat.id === "rent" && !/(收|領|入帳|進帳)/.test(text)) continue; // 「繳房租」是支出
    if (cat.id === "investment" && !INCOME_VERB.test(text) && !/(股利|股息|配息)/.test(text)) continue;
    if (cat.id === "salary" || cat.id === "bonus" || INCOME_VERB.test(text)) return { category: cat.name, keyword };
  }
  if (INCOME_VERB.test(text) && /(收入|進帳|入帳|賺)/.test(text)) return { category: "其他收入", keyword: "" };
  return null;
}

// ---------- 項目、商家、分類 ----------
const ACTION = "吃|喝|買|看|繳|加|搭|坐|唱|玩|付|消費|用|點|訂|修|剪|洗";
const MERCHANT_RE = new RegExp(`在\\s*([^\\d,\\s]{1,12}?)\\s*(?=${ACTION}|花|消費|共)`);
const FILLER = /今天|昨天|前天|大前天|剛剛|剛才|花了?|共|用了?|付了?|了|元|的|一下|去|跟|和|我們?|朋友|家人|一起|大概|左右|總共|大約|元整/g;

function scoreCategories(text, merchant) {
  const scores = new Map();
  const add = (name, points) => scores.set(name, (scores.get(name) || 0) + points);
  const rest = merchant ? text.replace(merchant, " ") : text;
  for (const cat of EXPENSE_CATEGORIES) {
    for (const keyword of cat.keywords) {
      if (keyword.length === 1) continue; // 單字關鍵字只用在動詞語境
      if (rest.includes(keyword)) add(cat.name, 3);
      if (merchant && merchant.includes(keyword)) add(cat.name, 1);
    }
  }
  if (/(吃|喝)/.test(rest)) add("飲食", 2);
  if (/看(醫生|病|診|牙)/.test(rest)) add("醫療健康", 2);
  if (/買.{0,3}藥|藥局|拿藥/.test(rest)) add("醫療健康", 2);
  if (/(買|看).{0,2}書/.test(rest)) add("教育學習", 2);
  if (/(搭|坐).{0,3}(車|計程|高鐵|台鐵|捷運|公車|飛機)/.test(rest)) add("交通", 2);
  if (/(包|給).{0,3}紅包/.test(rest)) add("人情禮金", 2);
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

function extractItem(segment, merchant, category, incomeKeyword) {
  if (incomeKeyword) return incomeKeyword === "薪" ? "薪水" : incomeKeyword;
  const rest = (merchant ? segment.replace(merchant, " ") : segment).replace(/在\s*/g, " ");
  const verb = rest.match(/(看|吃|喝|買|繳|加|搭|坐|唱|玩|剪|洗|修)了?\s*([^\d,\s元共花]{1,6})/);
  if (verb) {
    let object = verb[2]
      .replace(new RegExp(`^[零〇一二兩两三四五六七八九十\\d]+[${MEASURE}]`), "")
      .replace(FILLER, "")
      .trim();
    if (object) {
      if (["看", "加", "唱", "剪", "洗", "修", "搭", "坐", "玩"].includes(verb[1]) || object.length === 1) return verb[1] + object;
      return object;
    }
  }
  if (merchant) return merchant;
  const cat = EXPENSE_CATEGORIES.find((c) => c.name === category);
  const keyword = cat?.keywords.filter((k) => k.length > 1 && rest.includes(k)).sort((a, b) => b.length - a.length)[0];
  if (keyword) return keyword;
  const cleaned = rest
    .replace(FILLER, "")
    .replace(/[\d,\s零〇一二兩两三四五六七八九十百千萬万]/g, "")
    .slice(0, 12);
  return cleaned.length >= 2 ? cleaned : "";
}

function buildNote(segment, merchant) {
  if (!merchant) return "";
  const m = segment.match(/(吃|喝|看|唱|玩)了?\s*([^\d,\s元共花]{0,6})/);
  if (!m) return "";
  const object = (m[2] || "").replace(FILLER, "");
  if (object) return m[1] + object;
  const food = ["火鍋", "燒肉", "牛排", "拉麵", "壽司", "披薩", "咖啡"].find((k) => merchant.includes(k));
  return food ? m[1] + food : "";
}

let idCounter = 0;
export function newRequestId() {
  idCounter += 1;
  const random = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `req-${random}-${idCounter}`;
}

// ---------- 主函式 ----------
export function parseExpenseText(input, { now = new Date(), timeZone = DEFAULT_TZ, inputMethod = "voice" } = {}) {
  const originalText = String(input || "").trim();
  const { date: today, time: nowTime } = zonedParts(now, timeZone);
  const normalized = normalizeText(originalText);
  if (!normalized) return { drafts: [], normalized, error: "沒有聽到內容，請再說一次。" };

  // 付款方式：先判斷，再把這些字拿掉，避免被當成商家或項目
  const spokenPayment = /刷卡|信用卡/.test(normalized)
    ? "信用卡"
    : /(轉帳|匯款)\s*(付|給店|支付)/.test(normalized)
      ? "銀行轉帳"
      : /付現|現金/.test(normalized)
        ? "現金"
        : null;
  const { date: dateInfo, rest: restWithPayment } = parseDate(normalized, today);
  const rest = restWithPayment.replace(/(用|以)?(刷卡|信用卡|付現金?|現金)(付款|支付|付)?/g, " ");
  const transactionDate = dateInfo?.date || today;
  const isNow = !dateInfo || dateInfo.now;
  const transactionTime = isNow && transactionDate === today ? nowTime : "";

  let amounts = findAmounts(rest);
  // 「共 730」等於前面加總 → 小計，不重複記帳
  if (amounts.length > 1) {
    const sumBefore = (index) => amounts.slice(0, index).reduce((s, a) => s + a.value, 0);
    amounts = amounts.filter((a, index) => !(a.subtotal && index > 0 && Math.abs(sumBefore(index) - a.value) < 0.5));
  }

  const segments = [];
  if (!amounts.length) {
    segments.push({ text: rest, amount: null });
  } else {
    let cursor = 0;
    amounts.forEach((a, index) => {
      let text = rest.slice(cursor, a.end);
      cursor = a.end;
      if (index === amounts.length - 1) text += rest.slice(cursor);
      segments.push({ text, amount: a });
    });
    // 只有金額、沒有內容的片段（例如「共 1200」），併回前一筆的說明
    for (let i = segments.length - 1; i > 0; i -= 1) {
      const content = segments[i].text.replace(/[\d零〇一二兩两三四五六七八九十百千萬万元共,\s]/g, "");
      if (!content && segments[i].amount?.subtotal) segments.splice(i, 1);
    }
  }

  const wholeMerchant = (rest.match(MERCHANT_RE) || [])[1]?.trim() || "";

  const drafts = segments.map((segment) => {
    const text = segment.text;
    const issues = [];
    let type = "expense";
    let categoryName = "其他支出";
    let candidates = [];
    let incomeKeyword = "";
    let categoryScore = 0;
    let categoryMargin = 0;

    const segMerchant = (text.match(MERCHANT_RE) || [])[1]?.trim() || "";
    const merchant = segMerchant || (segments.length === 1 ? wholeMerchant : "");

    if (SELF_TRANSFER.test(text) || SELF_TRANSFER.test(normalized)) {
      type = "transfer";
      categoryName = "轉帳";
      issues.push({ kind: "info", message: "這是轉帳（自己帳戶之間移動），不會算進收入或支出。" });
    } else if (OTHER_TRANSFER.test(text)) {
      issues.push({
        kind: "transferPurpose",
        message: "這筆轉帳是什麼用途？",
        options: ["借給對方", "還款給對方", "送給對方（人情禮金）", "轉帳（不算支出）"],
      });
      categoryName = "其他支出";
    } else {
      const income = detectIncome(text);
      if (income) {
        type = "income";
        categoryName = income.category;
        incomeKeyword = income.keyword;
        categoryScore = 3;
        categoryMargin = 3;
      } else {
        const scored = scoreCategories(text, merchant);
        if (scored.length) {
          categoryName = scored[0][0];
          categoryScore = scored[0][1];
          categoryMargin = scored[0][1] - (scored[1]?.[1] || 0);
          if (categoryMargin < 2) {
            candidates = scored.slice(0, 3).map(([name]) => name);
            issues.push({ kind: "category", message: "這筆可能屬於好幾個分類，請選一個。", options: candidates });
          }
        } else {
          issues.push({ kind: "category", message: "看不出分類，請確認或選一個分類。", options: [] });
        }
      }
    }

    const amount = segment.amount ? Math.round(segment.amount.value) : null;
    if (amount == null) issues.push({ kind: "amount", message: "請補充這筆消費的金額。" });
    if (dateInfo?.yearGuessed) issues.push({ kind: "date", message: `日期判斷為 ${transactionDate}，請確認年份。` });

    let confidence = 0;
    if (segment.amount) confidence += segment.amount.strength === 2 ? 0.4 : 0.25;
    if (type !== "expense" || categoryMargin >= 2) confidence += 0.4;
    else if (categoryScore > 0) confidence += 0.15;
    confidence += dateInfo?.yearGuessed ? 0.05 : 0.2;
    if (issues.some((i) => i.kind === "transferPurpose")) confidence = Math.min(confidence, 0.5);

    const toOther = text.match(OTHER_TRANSFER);
    const itemName =
      type === "transfer"
        ? "轉帳"
        : toOther && type === "expense" && issues.some((i) => i.kind === "transferPurpose")
          ? `轉帳給${toOther[4]}`
          : extractItem(text, merchant, categoryName, incomeKeyword);

    const paymentMethod = type !== "expense" ? undefined : spokenPayment || "現金";

    return {
      clientRequestId: newRequestId(),
      type,
      paymentMethod,
      amount,
      currency: "TWD",
      categoryName,
      itemName,
      merchant,
      note: buildNote(text, merchant),
      transactionDate,
      transactionTime,
      timezone: timeZone,
      inputMethod,
      originalText,
      confidence: Math.round(Math.min(1, confidence) * 100) / 100,
      issues,
    };
  });

  return { drafts, normalized };
}

// 草稿是否可以直接儲存（沒有待補的問題）
export function draftBlockers(draft) {
  const blockers = [];
  if (!(Number(draft.amount) > 0)) blockers.push("請輸入大於 0 的金額");
  if (!draft.transactionDate) blockers.push("請選擇日期");
  if (!draft.categoryName) blockers.push("請選擇分類");
  if ((draft.issues || []).some((i) => i.kind === "transferPurpose")) blockers.push("請選擇轉帳用途");
  return blockers;
}

export { weekday };
