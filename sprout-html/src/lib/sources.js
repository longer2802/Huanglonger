// Official sources, one entry per edition. A new edition gets a new id; the
// old one stays so cards written from it keep their citation.
// status: "verified"  = the file was opened and the edition read from the file itself
//         "pending"   = content read, but the edition (出版年月) is not printed on it
export const SOURCES = {
  "hpa-mom-2026-06": {
    name: "孕媽咪健康手冊",
    publisher: "衛生福利部國民健康署",
    edition: "2026 年 6 月出版（115 年 6 月），GPN 1011500197",
    url: "https://www.hpa.gov.tw/Pages/ashx/GetFile.ashx?lang=c&type=1&sid=9bc293ce059f4abd85692d53e0450bd2",
    portal: "https://www.hpa.gov.tw/Pages/TopicList.aspx?nodeid=4843",
    status: "verified",
    checkedOn: "2026-11-23",
    note: "版權頁「出版年月：2026 年 6 月」；官網列表同標示 115 年 6 月出版。共 64 頁。",
  },
  "hpa-child-2026-06": {
    name: "兒童健康手冊（中文版）",
    publisher: "衛生福利部國民健康署",
    edition: "2026 年 6 月，第 21 版",
    url: "https://www.hpa.gov.tw/Pages/ashx/GetFile.ashx?lang=c&type=1&sid=fa4a5fb2ccf0444ca1a6dbfbee7bdf5a",
    portal: "https://www.hpa.gov.tw/Pages/TopicList.aspx?nodeid=1140",
    status: "verified",
    checkedOn: "2026-11-23",
    note: "版權頁「出版年月：2026年6月；版（刷）次：第21版」。共 103 頁。",
  },
  "cdc-vax-11509": {
    name: "我國現行兒童預防接種時程",
    publisher: "衛生福利部疾病管制署",
    edition: "115.09 版，自 115 年 10 月 1 日（2026-10-01）起實施",
    url: "https://www.cdc.gov.tw/Category/Page/TxRW-x3WzvPhvEtxM628GA",
    portal: "https://www.cdc.gov.tw/Category/Page/TxRW-x3WzvPhvEtxM628GA",
    status: "verified",
    checkedOn: "2026-11-23",
    note: "附件「現行兒童預防接種時程表_(11509版)_中文.pdf」；頁面最後更新 2026/7/15。",
  },
  "hpa-edu-postpartum": {
    name: "孕媽咪衛教手冊：產後挑戰－身心恢復＆育兒生活",
    publisher: "衛生福利部國民健康署",
    edition: "出版年月未標示（待確認）",
    url: "https://www.hpa.gov.tw/Pages/ashx/GetFile.ashx?lang=c&type=1&sid=406d5fba2b7c435082ce543e0a0b337e",
    portal: "https://www.hpa.gov.tw/Pages/List.aspx?nodeid=4839",
    status: "pending",
    checkedOn: "2026-11-23",
    note: "檔案與官網列表都沒有印出版年月，依規定不以檔案日期推測版次；相關卡片保留草稿，不顯示給爸媽。",
  },
};

export function sourceOf(id) {
  return SOURCES[id] ?? null;
}
