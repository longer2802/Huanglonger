import { SOURCES } from "./sources";

// Content dataset. Each card is summarised in our own words from one official
// source and keeps its citation. Bump CONTENT_VERSION whenever a card changes.
// role: "pregnant" (weeks) | "postpartum" (days after birth) | "baby" (age in days)
// status: "published" shows to parents; "draft" only appears on the source-check page.
export const CONTENT_VERSION = "2026.11-1";

const M = (months) => Math.round(months * 30.4375);
const Y = (years) => M(years * 12);

const MOM = "hpa-mom-2026-06";
const CHILD = "hpa-child-2026-06";
const VAX = "cdc-vax-11509";
const PP = "hpa-edu-postpartum";

const DANGER_SIGNS = [
  "陰道出血（量多量少都算）",
  "持續或劇烈的頭痛",
  "持續或劇烈的腹痛",
  "持續或嚴重的噁心、嘔吐",
  "突然發冷發熱",
  "視力模糊",
  "臉部和手部浮腫",
  "尿量明顯變少，或小便時疼痛、灼熱",
  "胎動停止，或比平常少一半",
  "陰道有水樣分泌物不停流出（懷疑破水）",
  "持續腰痠，而且肚子變硬",
];

export const PREGNANCY_DANGER_SIGNS = DANGER_SIGNS;

function visitCard(n, startWeek, endWeek, week, fetus, mother, life, nurse, page, extra = {}) {
  return {
    id: `preg-visit-${n}`,
    role: "pregnant",
    startWeek,
    endWeek,
    title: `第 ${n} 次產檢（建議第 ${week} 週）`,
    summary: `${fetus} ${mother}`,
    doNow: [life, ...nurse],
    common: [mother],
    warnings: extra.warnings ?? [],
    warningAction: extra.warningAction,
    actions: [{ label: `安排第 ${n} 次產檢`, ruleKey: `prenatal-${n}` }, ...(extra.actions ?? [])],
    source: { id: MOM, section: `我的第 ${n} 次產檢週記`, page: `第 ${page} 頁` },
    status: "published",
  };
}

export const CARDS = [
  // ---------- Pregnancy: always-on danger signs ----------
  {
    id: "preg-danger",
    role: "pregnant",
    startWeek: 0,
    endWeek: 45,
    title: "亮黃燈！懷孕期間的危險徵兆",
    summary: "出現下列任何一項，手冊寫明應立即就醫。",
    doNow: ["把產檢院所電話存在「我的」，需要時一鍵撥打。"],
    common: [],
    warnings: DANGER_SIGNS,
    warningAction: "出現任何一項：立即就醫。",
    actions: [],
    source: { id: MOM, section: "亮黃燈！注意危險徵兆", page: "第 13 頁" },
    status: "published",
    alert: true,
  },
  // ---------- Pregnancy: phase overviews ----------
  {
    id: "preg-phase-early",
    role: "pregnant",
    startWeek: 0,
    endWeek: 12,
    title: "懷孕初期：未滿 13 週",
    summary: "可能開始孕吐；寶寶的五官、四肢、骨骼等重要器官逐步發展。",
    doNow: [
      "國健署提供 14 次產前檢查：一開始每 4 週 1 次。",
      "第 1 次超音波建議在 8～16 週。",
      "第 2 次產檢會做血液常規、血型、Rh 因子、德國麻疹抗體、B 型肝炎、梅毒、愛滋病毒篩檢與尿液檢查。",
    ],
    common: ["孕吐困擾，可改成少量多餐。"],
    warnings: [],
    actions: [{ label: "安排第 1 次超音波", ruleKey: "test-us1" }],
    source: { id: MOM, section: "懷孕 3 階段產檢時間表", page: "第 8～9 頁" },
    status: "published",
  },
  {
    id: "preg-phase-mid",
    role: "pregnant",
    startWeek: 13,
    endWeek: 28,
    title: "懷孕中期：13～未滿 29 週",
    summary: "孕吐減少，寶寶快速成長，會開始感覺到胎動。",
    doNow: [
      "這段時間每 4 週產檢 1 次，28 週起改為每 2 週 1 次。",
      "第 2 次超音波約在 20 週前後。",
      "24～28 週做妊娠糖尿病篩檢及貧血檢驗。",
    ],
    common: ["可能有頭痛、抽筋、水腫等不適。"],
    warnings: [],
    actions: [
      { label: "安排第 2 次超音波", ruleKey: "test-us2" },
      { label: "安排妊娠糖尿病篩檢及貧血檢驗", ruleKey: "test-gdm" },
    ],
    source: { id: MOM, section: "懷孕 3 階段產檢時間表", page: "第 8～9 頁" },
    status: "published",
  },
  {
    id: "preg-phase-late",
    role: "pregnant",
    startWeek: 29,
    endWeek: 45,
    title: "懷孕後期：29 週以上",
    summary: "請留意產兆！手冊註明 37～42 週都是正常生產期。",
    doNow: [
      "36 週起每週產檢 1 次。",
      "32 週後做第 3 次超音波。",
      "35～37 週可做孕婦乙型鏈球菌篩檢。",
    ],
    common: ["可能有呼吸急促、恥骨痛、失眠、便祕、痔瘡等困擾。"],
    warnings: [],
    actions: [
      { label: "安排第 3 次超音波", ruleKey: "test-us3" },
      { label: "安排乙型鏈球菌篩檢", ruleKey: "test-gbs" },
    ],
    source: { id: MOM, section: "懷孕 3 階段產檢時間表", page: "第 8～9 頁" },
    status: "published",
  },
  // ---------- Pregnancy: the 14 visit journals (each covers its weeks) ----------
  visitCard(1, 0, 8, 8, "心跳越來越清楚，寶寶看起來像一顆豆子。", "約 8 成孕媽咪有不同程度的孕吐。", "孕吐時可改為少量多餐。", ["做第 1 次超音波，確定預產期。"], 30, {
    warnings: ["懷孕初期陰道出血"],
    warningAction: "懷孕初期若有陰道出血，手冊寫明請立即就醫。",
  }),
  visitCard(2, 9, 12, 12, "五官、四肢、骨骼等重要器官逐步發展。", "肚子漸漸隆起、乳暈顏色變深，常想上廁所。", "常跑廁所也不要憋尿。", ["做尿液、血液、B 型肝炎、德國麻疹、梅毒、愛滋病等檢驗。", "和伴侶一起和醫師討論唐氏症篩檢方式（手冊第 22 頁）。", "填寫心情溫度計兩題；任一題為「是」，建議再做愛丁堡產後憂鬱量表自我篩檢。"], 31),
  visitCard(3, 13, 16, 16, "外型已明顯可辨，動作越來越多。", "肚子明顯隆起，可能分泌物變多、腰痠背痛、小腿抽筋。", "分泌物變多可穿清爽衣物；若量多、會癢或有異味，請就醫檢查。", ["循序增加運動量，建議每週至少 150 分鐘。", "認識並預防早產（手冊第 44 頁）。", "若自己或親友可能遭受家暴，可撥 113 保護專線。"], 32),
  visitCard(4, 17, 20, 20, "肺部開始發育，腦部快速發展。", "肚子裡像有氣泡在滾動，那就是胎動！", "寶寶需要更多營養，全家一起吃得均衡，心情愉快也很重要。", ["做第 2 次超音波。", "認識並預防早產（手冊第 44 頁）。"], 33),
  visitCard(5, 21, 24, 24, "開始練習呼吸動作，也聽得到聲音了。", "乳房脹痛、可能開始分泌乳汁；下肢浮腫、痠麻較明顯。", "寶寶聽得到聲音，家人可以多跟寶寶說話。", ["24～28 週做妊娠糖尿病篩檢及貧血檢驗。", "認識早產徵兆，注意孕期均衡營養。", "填寫心情溫度計兩題。"], 34, {
    actions: [{ label: "安排妊娠糖尿病篩檢及貧血檢驗", ruleKey: "test-gdm" }],
  }),
  visitCard(6, 25, 28, 28, "眼睛完全發育，會睜眼閉眼，皮下脂肪變厚。", "子宮變大往上推擠造成的腹脹，和硬硬的子宮收縮不同。", "家人陪著一起做適量運動，飯後散步也不錯。", ["27～36 週可自費接種 Tdap 疫苗（手冊第 52 頁）。"], 35, {
    actions: [{ label: "安排 Tdap 疫苗（自費）", ruleKey: "mvax-tdap" }],
  }),
  visitCard(7, 29, 30, 30, "手腳很有力，胎動變得頻繁。", "肚子變重，走路時雙腳會打開維持平衡。", "有靜脈曲張要避免久站久坐，休息時抬腿。", ["持續運動、穩定核心肌群。"], 36),
  visitCard(8, 31, 32, 32, "快速成長，幾乎佔滿整個子宮。", "骨盆底肌肉負擔重，大笑、咳嗽可能漏尿。", "有漏尿可多練骨盆底肌運動。", ["做第 3 次超音波、確認胎位。", "抽血做第 2 次梅毒檢查。", "填寫心情溫度計兩題。"], 37),
  visitCard(9, 33, 34, 34, "大部分寶寶頭已朝下，少數到 37 週才固定。", "骨盆、膀胱、臀部可能更不舒服，可用托腹帶減輕痠痛。", "還在工作的媽咪可開始準備交接、休產假。", ["若還沒做過孕婦愛滋病毒篩檢，可免費篩檢。", "和醫師討論生產方式。"], 38),
  visitCard(10, 35, 36, 36, "胎毛漸漸消失，循環、呼吸、消化器官成熟。", "宮縮更頻繁，這是身體在準備生產。", "家人先規劃好去醫院的交通與陪產人選。", ["35～37 週可做乙型鏈球菌篩檢（手冊第 24 頁）。", "認識「幼兒專責醫師制度」。", "留意胎動。"], 39, {
    actions: [{ label: "安排乙型鏈球菌篩檢", ruleKey: "test-gbs" }],
  }),
  visitCard(11, 37, 37, 37, "37 週後就算足月了，頭髮濃密、指甲長到指尖。", "胎頭下降到骨盆腔，反胃、喘的感覺可能減輕，但仍頻尿。", "家人再次確認待產包放在好拿的地方。", ["認識生產方式，擬定生產計畫書（手冊第 29 頁）。", "填寫心情溫度計兩題。"], 40),
  visitCard(12, 38, 38, 38, "皮膚光滑圓潤，指甲發育完成。", "進入最後倒數，這週生產也是正常的。", "38 週後隨時可能生產，家人先了解產兆。", ["認識 3 大產兆：落紅、破水、陣痛。"], 41),
  visitCard(13, 39, 39, 39, "寶寶變大、空間變小，胎動稍微減少。", "子宮頸和陰道變軟，陣痛、浮腫、靜脈曲張更明顯。", "家人準備好陪產假，手機隨時帶在身邊。", ["閱讀母乳哺育相關知識。", "先熟悉產後健康管理。"], 42),
  visitCard(14, 40, 45, 40, "頭朝下、膝蓋貼近鼻子，準備出來了。", "有些媽咪乳頭會分泌濃稠的黃色乳汁。", "放輕鬆、留意身體變化；超過 40 週還沒有產兆，醫師會評估是否催生。", ["認識「過期妊娠」。", "和醫師討論是否需要催生。", "填寫心情溫度計兩題。"], 43),
  // ---------- Pregnancy vaccines ----------
  {
    id: "preg-vax-flu-covid",
    role: "pregnant",
    startWeek: 0,
    endWeek: 45,
    title: "孕期可接種：流感、COVID-19 疫苗",
    summary: "任何孕期都可以接種，也能間接保護出生後 6 個月內的寶寶。",
    doNow: [
      "孕婦與 6 個月內嬰兒的雙親都是公費流感與 COVID-19 疫苗對象，每年 10 月以後開打。",
      "COVID-19 疫苗可和醫師討論合適的接種時間。",
      "家中其他成員與照顧者可自費接種流感疫苗。",
    ],
    common: [],
    warnings: [],
    actions: [{ label: "安排流感疫苗", ruleKey: "mvax-flu" }],
    source: { id: MOM, section: "孕期疫苗接種", page: "第 51 頁" },
    status: "published",
  },
  {
    id: "preg-vax-tdap-rsv",
    role: "pregnant",
    startWeek: 26,
    endWeek: 36,
    title: "孕期自費疫苗：Tdap、RSV",
    summary: "保護 6 個月內最容易被傳染的寶寶。",
    doNow: [
      "Tdap（百日咳）：建議懷孕 27～36 週自費接種；孕期沒打，則產後立即接種。",
      "常接觸寶寶的家人也建議在寶寶出生前接種 Tdap。",
      "RSV：建議懷孕 28～36 週自費接種 1 劑，讓寶寶出生後 6 個月內有被動免疫。",
    ],
    common: [],
    warnings: [],
    actions: [
      { label: "安排 Tdap 疫苗（自費）", ruleKey: "mvax-tdap" },
      { label: "安排 RSV 疫苗（自費）", ruleKey: "mvax-rsv" },
    ],
    source: { id: MOM, section: "孕期疫苗接種", page: "第 52 頁" },
    status: "published",
  },
  // ---------- Postpartum (mother) ----------
  {
    id: "pp-care-1",
    role: "postpartum",
    startDay: 0,
    endDay: 30,
    title: "產後健康照護：第 1 次",
    summary: "產後 1 個月內，建議在產後 1～2 週回院所。",
    doNow: [
      "服務內容包含身高體重、健康與生活型態諮詢（如戒菸、血壓、慢性疾病）。",
      "會用愛丁堡產後憂鬱量表自我評估。",
    ],
    common: [],
    warnings: [],
    actions: [{ label: "安排產後健康照護第 1 次", ruleKey: "pp-1" }],
    source: { id: MOM, section: "產後健康照護服務紀錄表", page: "第 18 頁" },
    status: "published",
  },
  {
    id: "pp-care-2",
    role: "postpartum",
    startDay: 31,
    endDay: 92,
    title: "產後健康照護：第 2 次",
    summary: "產後 3 個月內，建議在產後 6～8 週回院所。",
    doNow: [
      "會討論健康體位、飲食營養、運動、血壓與慢性疾病。",
      "再次用愛丁堡產後憂鬱量表自我評估。",
    ],
    common: [],
    warnings: [],
    actions: [{ label: "安排產後健康照護第 2 次", ruleKey: "pp-2" }],
    source: { id: MOM, section: "產後健康照護服務紀錄表", page: "第 18 頁" },
    status: "published",
  },
  {
    id: "pp-mood",
    role: "postpartum",
    startDay: 0,
    endDay: 365,
    title: "心情溫度計",
    summary: "手冊在產檢週記放了兩題情緒自我檢查。",
    doNow: [
      "過去一個月，是否常被情緒低落、憂鬱或對未來焦慮所困擾？",
      "過去一個月，是否因對事物失去興趣或無法專心而困擾？",
      "任一題為「是」，手冊建議再用「愛丁堡產後憂鬱量表」自我篩檢。",
    ],
    common: [],
    warnings: [],
    actions: [],
    source: { id: MOM, section: "我的第 2 次產檢週記：心情溫度計", page: "第 31 頁" },
    status: "published",
  },
  // Drafts: content checked against the file, edition not printed → hidden.
  {
    id: "pp-lochia-draft",
    role: "postpartum",
    startDay: 0,
    endDay: 60,
    title: "產後排出物的變化",
    summary: "產後 2～3 天量最多，約 2 個月結束，顏色由鮮紅轉暗紅、褐色，最後淡白。",
    doNow: ["換護墊時順便觀察量與顏色。"],
    common: [],
    warnings: ["量明顯變多", "有異味", "顏色一直是鮮紅色"],
    warningAction: "出現上述情況，需告知醫護人員。",
    actions: [],
    source: { id: PP, section: "產後排出物及狀態", page: "第 69 頁" },
    status: "draft",
  },
  // ---------- Baby ----------
  {
    id: "baby-newborn",
    role: "baby",
    startDay: 0,
    endDay: 6,
    title: "新生兒：出生 6 天內",
    summary: "出生後的身體診察與兩項篩檢。",
    doNow: [
      "出生 6 天內有一次完整身體診察（含髖關節篩檢）。",
      "先天性代謝異常疾病篩檢：出生滿 48 小時且哺乳滿 24 小時採檢。",
      "新生兒聽力篩檢：建議出生 72 小時內（補助到出生 3 個月內）。",
      "B 型肝炎疫苗第一劑：出生 24 小時內儘速接種。",
    ],
    common: [],
    warnings: [],
    actions: [],
    source: { id: CHILD, section: "兒童預防保健服務時程及服務項目；新生兒篩檢紀錄表", page: "第 6 頁、手冊前頁紀錄表" },
    status: "published",
  },
  {
    id: "baby-stool",
    role: "baby",
    startDay: 0,
    endDay: 60,
    title: "嬰兒黃金九色卡：看大便顏色",
    summary: "出生 1 個月內，用手冊上的九色卡比對寶寶大便顏色，在日光或白光下看最準。",
    doNow: [
      "正常顏色是卡上 7～9 號。",
      "出生滿 1 週內、滿 1 個月（打 B 肝第二劑時）各做一次大便卡篩檢。",
      "膽道閉鎖宜在出生 45 天內完成診斷，越早處理越好。",
    ],
    common: ["一般新生兒黃疸約在出生 2 週消失；喝母乳的寶寶黃疸期可能較長。"],
    warnings: ["大便顏色像卡上 1～6 號（不正常）", "出生滿 14 天仍有黃疸，或皮膚、眼白變黃"],
    warningAction: "手冊寫明：出生 14 天仍有黃疸或大便顏色不正常，要帶回院所檢驗；請攜帶寶寶的大便或照片就醫。",
    actions: [
      { label: "安排大便卡第 1 次比對", ruleKey: "screen-stool-1" },
      { label: "安排大便卡第 2 次比對", ruleKey: "screen-stool-2" },
    ],
    source: { id: CHILD, section: "嬰兒黃金九色卡；認識膽道閉鎖；出生後二週至二個月衛教紀錄表", page: "第 20～22 頁" },
    status: "published",
    alert: true,
  },
  {
    id: "baby-sleep-safety",
    role: "baby",
    startDay: 14,
    endDay: M(2),
    title: "安全睡眠與照顧",
    summary: "手冊在 2 週～2 個月的衛教重點裡提醒的安全事項。",
    doNow: [
      "每次睡覺都仰睡；床面要堅實，嬰兒床淨空，不放鬆軟物品或床圍。",
      "1 歲以下不使用枕頭。同室不同床。",
      "寶寶身上身邊不要有繩子（奶嘴鍊、項鍊、窗簾繩等）。",
      "不可劇烈搖晃寶寶；照顧者情緒失控時，請向親友或專業人員求助。",
      "乘車用後向式安全座椅放後座，避免用機車或自行車載寶寶。",
      "以一天尿布濕 5～8 次確認寶寶有吃飽。",
    ],
    common: [],
    warnings: [],
    actions: [],
    source: { id: CHILD, section: "出生後二週至二個月衛教紀錄表", page: "第 22 頁" },
    status: "published",
  },
  ...[
    [1, 14, M(2), "2 週～2 個月", "俯臥姿勢、驚嚇反應、眨眼、聽力反應"],
    [2, M(2), M(4), "2～4 個月", "抬頭、對人微笑、眼神追視、發出咕咕聲"],
    [3, M(4), M(6), "4～6 個月", "頸部支撐、手掌張開、發出笑聲、眼神追視"],
    [4, M(6), M(12), "6 個月～1 歲", "翻身、伸手拿東西、對聲音敏銳、坐穩、爬、扶站、兩手交換拿東西、叫名字有反應"],
    [5, M(12), M(18), "1～1 歲半", "躺姿變坐姿、放手走、拇指食指對握拿東西、聽懂簡單指令、說單字、用肢體表達、尋找物品、理解「再見」"],
    [6, M(18), M(24), "1 歲半～2 歲", "扶欄杆上樓、蹲下再站起、拿杯子喝水、指認身體部位、聽懂簡單指令、模仿動作、用湯匙"],
    [7, M(24), M(36), "2～3 歲", "下樓梯、雙腳跳、疊積木、說片語、說至少 10 個語詞、脫鞋襪、假扮遊戲"],
    [8, M(36), M(60), "3～5 歲", "會跳、騎三輪車、畫圓、自己上廁所、用代名詞、辨認顏色、用句子對話、和同伴輪流合作"],
    [9, M(60), Y(7) - 1, "5 歲～未滿 7 歲", "單腳站、一腳一階上下樓、用剪刀剪紙、扣釦子或拉拉鍊、說話清楚、理解連續指令、遵守遊戲規則"],
  ].map(([n, startDay, endDay, label, dev]) => ({
    id: `baby-wellchild-${n}`,
    role: "baby",
    startDay,
    endDay,
    title: `兒童預防保健第 ${n} 次（${label}）`,
    summary: "國健署補助的健兒門診，含身體診察、問診與發展診察。",
    doNow: [
      `這次醫師會看的發展項目：${dev}。`,
      "可先在「＋記錄」寫下想問醫師的問題。",
      ...(n >= 4 ? ["長牙後可由牙醫師每半年塗氟一次（一般兒童補助到 6 歲）。"] : []),
      ...(n >= 8 ? ["醫師會確認預防接種是否完整。"] : []),
    ],
    common: [],
    warnings: [],
    actions: [{ label: `安排兒童預防保健第 ${n} 次`, ruleKey: `wellchild-${n}` }],
    source: { id: CHILD, section: "兒童預防保健服務時程及服務項目", page: "第 6～7 頁" },
    status: "published",
  })),
  {
    id: "baby-devscreen",
    role: "baby",
    startDay: M(6),
    endDay: Y(7) - 1,
    title: "兒童發展篩檢服務",
    summary: "手冊前頁附有就醫憑證，分 6 個時段由院所用量表篩檢。",
    doNow: [
      "時段：6～10 個月、10 個月～1 歲半、1 歲半～2 歲、2～3 歲、3～5 歲、5 歲～未滿 7 歲。",
      "就診請帶兒童健康手冊；超過適用年齡的次數就不能再用。",
    ],
    common: [],
    warnings: [],
    actions: [],
    source: { id: CHILD, section: "兒童發展篩檢服務就醫憑證", page: "手冊前頁" },
    status: "published",
  },
  {
    id: "baby-vax-overview",
    role: "baby",
    startDay: 0,
    endDay: Y(7),
    title: "公費常規疫苗時程",
    summary: "疾管署 115.09 版，2026-10-01 起實施。實際接種日請依醫療院所安排。",
    doNow: [
      "B 型肝炎：出生 24 小時內、滿 1 個月、滿 6 個月。",
      "五合一（DTaP-Hib-IPV）：2、4、6、18 個月。",
      "13 價肺炎鏈球菌：2、4 個月，第三劑 12～15 個月。",
      "卡介苗：滿 5 個月（建議 5～8 個月）。",
      "水痘、MMR 第一劑：滿 12 個月；日本腦炎：15、27 個月。",
      "A 型肝炎：18、27 個月（公費對象依資格）。",
      "MMR 第二劑、DTaP-IPV：滿 5 歲至入國小前。",
      "流感：滿 6 個月起每年接種；9 歲以下初次接種要打 2 劑，間隔 4 週以上。",
    ],
    common: [],
    warnings: [],
    actions: [],
    source: { id: VAX, section: "我國現行兒童預防接種時程（115.09 版）", page: "單頁時程表" },
    status: "published",
  },
];

export function isShowable(card) {
  return card.status === "published" && SOURCES[card.source.id]?.status === "verified";
}

export function cardsForPregnancyWeek(week) {
  return CARDS.filter((c) => c.role === "pregnant" && isShowable(c) && week >= c.startWeek && week <= c.endWeek);
}

export function cardsForPostpartumDay(day) {
  return CARDS.filter((c) => c.role === "postpartum" && isShowable(c) && day >= c.startDay && day <= c.endDay);
}

export function cardsForBabyAge(days) {
  return CARDS.filter((c) => c.role === "baby" && isShowable(c) && days >= c.startDay && days <= c.endDay);
}

export const MONTH_DAYS = M;
