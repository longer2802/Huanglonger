import { useCallback, useEffect, useRef, useState } from "react";

// 瀏覽器內建語音辨識（Web Speech API）：免費、免金鑰，App 不儲存音訊
const MAX_MS = 15000; // 最長聆聽時間
const SILENCE_MS = 2200; // 說完停頓這麼久就自動結束

const ERROR_TEXT = {
  "not-allowed": "麥克風權限被關閉了。請到手機的「設定」允許這個網站使用麥克風，或改用下方文字輸入。",
  "service-not-allowed": "這個瀏覽器目前不允許語音辨識。請改用下方文字輸入（可按鍵盤上的麥克風說話）。",
  "no-speech": "沒有聽到聲音，請靠近手機再說一次。",
  network: "語音服務連不上，請檢查網路，或改用下方文字輸入。",
  "audio-capture": "找不到麥克風，請確認麥克風沒有被其他 App 使用。",
  "language-not-supported": "這個瀏覽器不支援中文語音辨識，請改用下方文字輸入。",
};

function getRecognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function useSpeech({ lang = "zh-TW", onResult } = {}) {
  const [supported, setSupported] = useState(null); // null = 尚未偵測
  const [status, setStatus] = useState("idle"); // idle | listening | processing
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const textRef = useRef("");
  const timers = useRef({});
  const abortedRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setSupported(Boolean(getRecognitionClass()));
  }, []);

  const clearTimers = () => {
    clearTimeout(timers.current.max);
    clearTimeout(timers.current.silence);
  };

  const stop = useCallback(() => {
    clearTimers();
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* 已經停止 */
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortedRef.current = true;
    clearTimers();
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* 已經停止 */
      }
    }
    recRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    const Recognition = getRecognitionClass();
    if (!Recognition) {
      setSupported(false);
      return;
    }
    if (recRef.current) return; // 不允許同時有兩個錄音
    setError(null);
    setTranscript("");
    textRef.current = "";
    abortedRef.current = false;

    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    let errored = false;

    rec.onstart = () => {
      setStatus("listening");
      timers.current.max = setTimeout(() => stop(), MAX_MS);
    };
    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      textRef.current = (finalText + interim).trim();
      setTranscript(textRef.current);
      clearTimeout(timers.current.silence);
      timers.current.silence = setTimeout(() => stop(), SILENCE_MS);
    };
    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      errored = true;
      setError(ERROR_TEXT[event.error] || "語音辨識失敗，請再試一次或改用文字輸入。");
    };
    rec.onend = () => {
      clearTimers();
      recRef.current = null;
      if (abortedRef.current) {
        setStatus("idle");
        return;
      }
      const text = textRef.current.trim();
      if (text) {
        setStatus("processing");
        onResultRef.current?.(text);
        setStatus("idle");
        return;
      }
      if (!errored) setError(ERROR_TEXT["no-speech"]);
      setStatus("idle");
    };

    try {
      rec.start();
      setStatus("listening");
    } catch {
      recRef.current = null;
      setError("無法啟動語音辨識，請再試一次。");
      setStatus("idle");
    }
  }, [lang, stop]);

  // 頁面切到背景或離開時自動停止
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", handleHide);
    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      cancel();
    };
  }, [cancel]);

  return { supported, status, transcript, error, start, stop, cancel, clearError: () => setError(null) };
}
