// 語音輸入姓名：只在瀏覽器能「確認」zh-TW 裝置端辨識可用時才提供 App 內建按鈕，
// 並強制 processLocally = true。無法確認就不顯示，絕不退回雲端語音。

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctor = new () => any;

function ctor(): Ctor | null {
  const w = window as any;
  return (w.SpeechRecognition as Ctor) || null;
}

export type OnDeviceStatus = "available" | "unavailable";

export async function onDeviceSpeechStatus(): Promise<OnDeviceStatus> {
  try {
    const C = ctor() as any;
    // 只認標準 SpeechRecognition 的 available()（Chrome 的裝置端辨識 API）。
    // webkitSpeechRecognition 無法保證裝置端處理，不採用。
    if (!C || typeof C.available !== "function") return "unavailable";
    // 自動化測試瀏覽器沒有裝置端語音模型，而且在部分無頭環境呼叫 available() 會讓分頁當掉
    if (navigator.webdriver) return "unavailable";
    const r = await C.available({ langs: ["zh-TW"], processLocally: true });
    return r === "available" ? "available" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export interface SpeechSession {
  stop: () => void;
}

export function startOnDeviceSpeech(onText: (text: string, final: boolean) => void, onEnd: (error?: string) => void): SpeechSession {
  const C = ctor();
  if (!C) throw new Error("這個瀏覽器不支援語音辨識");
  const rec = new C();
  rec.lang = "zh-TW";
  rec.processLocally = true;
  if (rec.processLocally !== true) throw new Error("無法強制裝置端處理，已停用語音按鈕");
  rec.interimResults = true;
  rec.continuous = true;
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      onText(r[0].transcript, r.isFinal);
    }
  };
  rec.onerror = (e: any) => onEnd(e?.error === "not-allowed" ? "沒有麥克風權限" : `語音辨識停止（${e?.error ?? "未知"}）`);
  rec.onend = () => onEnd();
  rec.start();
  return { stop: () => rec.stop() };
}
