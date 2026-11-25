import { useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, CalendarClock, Keyboard, Mic, PencilLine, Repeat, Settings, Square } from "lucide-react";
import { toast } from "sonner";
import ReviewPanel, { money } from "@/components/ReviewPanel";
import TransactionSheet from "@/components/TransactionSheet";
import InstallTip from "@/components/InstallTip";
import { Button } from "@/components/ui/button";
import useSpeech from "@/hooks/useSpeech";
import { useLedger } from "@/lib/ledger";
import { draftBlockers, parseExpenseText } from "@/lib/parser";
import { dueStatus, nextDue, usePlanned, useRecurring } from "@/lib/schedules";
import { zonedParts } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "一句話記帳｜說一句話就記好帳" }] }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { addMany, remove, prefs, mode, ready } = useLedger();
  const [drafts, setDrafts] = useState(null);
  const [heard, setHeard] = useState("");
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const saveLock = useRef(false);
  const recurring = useRecurring();
  const planned = usePlanned();
  const todayStr = zonedParts(new Date(), prefs.timezone).date;
  const recurringDue = recurring.items.filter((i) => dueStatus(nextDue(i, todayStr), todayStr) !== "later").length;
  const plannedDue = planned.items.filter((i) => !i.done && dueStatus(i.date, todayStr) !== "later").length;

  const saveDrafts = async (list, { auto = false } = {}) => {
    if (saveLock.current) return; // 防止連點重複儲存
    saveLock.current = true;
    setSaving(true);
    try {
      const saved = await addMany(list);
      setDrafts(null);
      setHeard("");
      setText("");
      const total = saved.reduce((sum, r) => sum + (r.type === "expense" ? r.amount : 0), 0);
      const label = saved.length > 1 ? `已記帳 ${saved.length} 筆` : "已記帳";
      toast.success(`${label}${total ? `，支出 ${money(total)}` : ""}`, {
        duration: auto ? 6000 : 4000,
        action: auto
          ? { label: "撤銷", onClick: () => remove(saved.map((r) => r.id)).then(() => toast("已撤銷這次記帳")) }
          : { label: "看帳本", onClick: () => navigate({ to: "/ledger" }) },
      });
    } catch (error) {
      toast.error(error?.message || "儲存失敗，請再試一次");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const handleText = (input, inputMethod) => {
    const result = parseExpenseText(input, { timeZone: prefs.timezone, inputMethod });
    if (result.error || !result.drafts.length) {
      toast.error(result.error || "聽不出記帳內容，請再說一次。");
      return;
    }
    setHeard(input);
    const ready =
      prefs.autoSave &&
      result.drafts.every((d) => d.confidence >= 0.8 && !draftBlockers(d).length && !(d.issues || []).length);
    if (ready) saveDrafts(result.drafts, { auto: true });
    else setDrafts(result.drafts);
  };

  const speech = useSpeech({ lang: prefs.voiceLanguage || "zh-TW", onResult: (t) => handleText(t, "voice") });
  const listening = speech.status === "listening";

  const handleMic = () => {
    if (listening) speech.stop();
    else {
      setDrafts(null);
      speech.start();
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between">
        <div className="w-10" />
        <div className="text-center">
          <h1 className="text-[28px] font-bold tracking-tight text-primary">一句話記帳</h1>
          <p className="mt-1 text-lg text-muted-foreground">今天花了多少錢？</p>
        </div>
        <Link
          to="/settings"
          aria-label="設定"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      {ready && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          紀錄存在這支手機・換手機前請先到設定匯出備份
        </p>
      )}

      {drafts ? (
        <div className="mt-6">
          <ReviewPanel
            drafts={drafts}
            heard={heard}
            onChange={setDrafts}
            saving={saving}
            onConfirm={() => saveDrafts(drafts)}
            onRetry={() => {
              setDrafts(null);
              speech.start();
            }}
            onCancel={() => {
              setDrafts(null);
              setHeard("");
            }}
          />
        </div>
      ) : (
        <>
          <section className="mt-10 flex flex-col items-center" aria-live="polite">
            {speech.supported !== false && (
              <>
                <button
                  type="button"
                  onClick={handleMic}
                  disabled={speech.supported === null || saving}
                  aria-label={listening ? "結束語音記帳" : "開始語音記帳"}
                  className={cn(
                    "flex h-[120px] w-[120px] items-center justify-center rounded-full text-white shadow-lg transition-colors",
                    listening ? "yj-recording bg-red-600" : "bg-primary hover:bg-primary/90"
                  )}
                >
                  {listening ? <Square className="h-12 w-12 fill-current" /> : <Mic className="h-14 w-14" strokeWidth={2.2} />}
                </button>
                <div className="mt-5 min-h-[88px] text-center">
                  {listening ? (
                    <>
                      <div className="yj-wave flex h-8 items-center justify-center" aria-hidden="true">
                        {[0, 0.15, 0.3, 0.45, 0.6].map((delay) => (
                          <span key={delay} style={{ animationDelay: `${delay}s` }} />
                        ))}
                      </div>
                      <p className="mt-2 text-lg font-semibold text-red-600">正在聆聽，請說出消費內容</p>
                      <p className="mt-1 min-h-[1.5rem] break-all text-base text-foreground/80">{speech.transcript}</p>
                      <p className="text-sm text-muted-foreground">說完再點一次，或停頓一下會自動結束</p>
                    </>
                  ) : saving ? (
                    <p className="text-lg font-semibold text-primary">正在整理你的記帳內容…</p>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">點擊開始語音記帳</p>
                      <p className="mt-1 text-sm text-muted-foreground">例如：「今天午餐 150 元，加油 500 元」</p>
                    </>
                  )}
                  {speech.error && !listening && (
                    <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-left text-base text-red-700">
                      {speech.error}
                      <button type="button" onClick={speech.start} className="ml-2 font-semibold underline">
                        再試一次
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {speech.supported === false && (
              <div className="w-full rounded-2xl bg-amber-50 p-4 text-base leading-relaxed text-amber-900">
                目前瀏覽器不支援直接語音記帳，請改用手機鍵盤的語音輸入功能。
                <span className="mt-1 block text-sm text-amber-800">點下方輸入框，再按鍵盤上的 🎤 麥克風說話即可。</span>
              </div>
            )}
          </section>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualOpen(true)}
              className="h-14 rounded-2xl border-2 border-primary/30 text-base font-semibold"
            >
              <PencilLine className="mr-1.5 h-5 w-5" />
              手動記帳
            </Button>
            <Button asChild variant="outline" className="h-14 rounded-2xl border-2 border-primary/30 text-base font-semibold">
              <Link to="/ledger">
                <BookOpen className="mr-1.5 h-5 w-5" />
                查看記帳
              </Link>
            </Button>
            <Button asChild variant="outline" className="relative h-14 rounded-2xl border-2 border-primary/30 text-base font-semibold">
              <Link to="/recurring">
                <Repeat className="mr-1.5 h-5 w-5" />
                固定繳費
                {recurringDue > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                    {recurringDue}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline" className="relative h-14 rounded-2xl border-2 border-primary/30 text-base font-semibold">
              <Link to="/planned">
                <CalendarClock className="mr-1.5 h-5 w-5" />
                預定花費
                {plannedDue > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                    {plannedDue}
                  </span>
                )}
              </Link>
            </Button>
          </div>
          {(recurringDue > 0 || plannedDue > 0) && (
            <p className="mt-2 text-center text-sm text-red-700">紅色數字：7 天內到期或已到期、還沒記入帳本的筆數</p>
          )}

          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim()) handleText(text.trim(), "text");
            }}
          >
            <label htmlFor="quick-text" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Keyboard className="h-4 w-4" />
              也可以打字，或用鍵盤上的麥克風說
            </label>
            <div className="flex gap-2">
              <input
                id="quick-text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 200))}
                placeholder="例如：昨天加油 800 元"
                enterKeyHint="done"
                className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button type="submit" disabled={!text.trim()} className="h-12 shrink-0 rounded-xl px-4 text-base">
                整理
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <InstallTip mode={mode} />
          </div>
        </>
      )}

      <TransactionSheet open={manualOpen} onOpenChange={setManualOpen} />
    </main>
  );
}
