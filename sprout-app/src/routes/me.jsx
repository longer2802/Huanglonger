import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby, BellRing, Download, FileLock2, FlaskConical, HeartHandshake, Library, Plus, Smartphone, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { Btn, Card, Confirm, Field, inputClass, SectionTitle, Sheet } from "@/components/kit";
import { BabyForm, PregnancyForm } from "@/components/Forms";
import { personName } from "@/components/CarePrompt";
import {
  addBaby,
  deletePerson,
  recordBirth,
  replaceEverything,
  snapshotForBackup,
  updatePerson,
  updatePregnancy,
  updateSettings,
  useSprout,
  wipeAll,
} from "@/lib/store";
import { formatAge, ageParts, formatDate, todayTW } from "@/lib/dates";
import { backupFileName, createBackup, readBackup, summarize } from "@/lib/backup";
import { demoBorn, demoPregnancy } from "@/lib/demo";

export const Route = createFileRoute("/me")({
  ssr: false,
  head: () => ({ meta: [{ title: "我的・小芽" }] }),
  component: () => (
    <AppShell>
      <MePage />
    </AppShell>
  ),
});

function MePage() {
  const { family, people } = useSprout();
  const today = todayTW();
  const [editPerson, setEditPerson] = useState(null);
  const [addingBaby, setAddingBaby] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#birth") {
      document.getElementById("birth")?.scrollIntoView({ block: "start" });
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">我的</h1>

      <section>
        <SectionTitle
          action={
            <Btn size="sm" variant="soft" onClick={() => setAddingBaby(true)}>
              <Plus className="h-4 w-4" /> 新增寶寶
            </Btn>
          }
        >
          家人
        </SectionTitle>
        <div className="space-y-2">
          {people.map((p) => (
            <button key={p.id} type="button" onClick={() => setEditPerson(p)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left">
              {p.role === "mother" ? <HeartHandshake className="h-7 w-7 text-primary" /> : <Baby className="h-7 w-7 text-[hsl(var(--apricot-strong))]" />}
              <span className="flex-1">
                <span className="block text-[16px] font-bold">{personName(p)}</span>
                <span className="block text-[13px] text-muted-foreground">
                  {p.role === "mother"
                    ? family.stage === "pregnant"
                      ? `預產期 ${formatDate(family.edd)}`
                      : `生產日 ${formatDate(family.deliveryDate)}`
                    : `${formatDate(p.birthDate)}・${formatAge(ageParts(p.birthDate, today))}`}
                  {p.clinic ? `・${p.clinic}` : ""}
                </span>
              </span>
              <span className="text-sm font-semibold text-primary">編輯</span>
            </button>
          ))}
        </div>
      </section>

      {family.stage === "pregnant" ? <PregnancyDates /> : null}
      {family.stage === "pregnant" ? <BirthSwitch /> : null}
      <ReminderSettings />
      <InstallGuide />
      <BackupSection />
      <DemoSection />
      <DangerZone />

      <Link to="/sources" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[15px] font-semibold text-primary">
        <Library className="h-5 w-5" /> 官方資料與版本核對
      </Link>
      <p className="pb-4 text-center text-[12px] leading-relaxed text-muted-foreground">
        小芽不收集身分證字號、健保卡號或與照護無關的資料。資料只存在這支手機的瀏覽器，不上傳、不做分析追蹤。
      </p>

      {editPerson ? <PersonSheet person={editPerson} onClose={() => setEditPerson(null)} /> : null}
      <AddBabySheet open={addingBaby} onClose={() => setAddingBaby(false)} />
    </div>
  );
}

function PersonSheet({ person, onClose }) {
  const [value, setValue] = useState(person);
  const [confirm, setConfirm] = useState(false);
  const save = async () => {
    try {
      const r = await updatePerson(value);
      toast.success(r?.recalculated ? `已更新，重算 ${r.recalculated} 項建議時程（已預約與已完成不變）` : "已更新");
      onClose();
    } catch (e) {
      toast.error(e.message.split("\n")[0]);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`編輯${personName(person)}`} tall footer={<Btn className="w-full" onClick={save}>儲存</Btn>}>
      {person.role === "baby" ? (
        <div className="space-y-4">
          <BabyForm value={value} onChange={setValue} />
          <Btn variant="ghost" className="w-full text-destructive" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" /> 刪除這位寶寶與他的所有紀錄
          </Btn>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="稱呼">
            {(id) => <input id={id} className={inputClass} maxLength={20} value={value.nickname || ""} onChange={(e) => setValue({ ...value, nickname: e.target.value })} />}
          </Field>
          <Field label="產檢／照護院所">
            {(id) => <input id={id} className={inputClass} value={value.clinic || ""} onChange={(e) => setValue({ ...value, clinic: e.target.value })} />}
          </Field>
          <Field label="院所電話" hint="關懷提醒與警訊會顯示一鍵撥打。">
            {(id) => <input id={id} type="tel" inputMode="tel" className={inputClass} value={value.clinicPhone || ""} onChange={(e) => setValue({ ...value, clinicPhone: e.target.value })} />}
          </Field>
        </div>
      )}
      <Confirm
        open={confirm}
        title={`刪除「${personName(person)}」？`}
        body="這位寶寶的紀錄、待辦與關懷回答都會一起刪除，無法復原。其他家人的資料不受影響。"
        danger
        confirmLabel="刪除"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await deletePerson(person.id);
          toast.success("已刪除");
          onClose();
        }}
      />
    </Sheet>
  );
}

function AddBabySheet({ open, onClose }) {
  const [baby, setBaby] = useState({ nickname: "", birthDate: "" });
  const save = async () => {
    try {
      await addBaby(baby);
      toast.success("已新增寶寶，疫苗與健兒門診時程已建立");
      setBaby({ nickname: "", birthDate: "" });
      onClose();
    } catch (e) {
      toast.error(e.message.split("\n")[0]);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="新增寶寶" tall footer={<Btn className="w-full" onClick={save}>新增</Btn>}>
      <BabyForm value={baby} onChange={setBaby} />
    </Sheet>
  );
}

function PregnancyDates() {
  const { family } = useSprout();
  const [value, setValue] = useState(family.pregnancy || { basis: "edd", edd: family.edd });
  const [tried, setTried] = useState(false);
  const save = async () => {
    setTried(true);
    try {
      const r = await updatePregnancy(value);
      toast.success(`已更新預產期。重算 ${r.recalculated} 項建議時程，保留 ${r.kept} 項已預約／已完成／已取消。已匯出的手機行事曆不受影響。`);
    } catch (e) {
      toast.error(e.message.split("\n")[0]);
    }
  };
  return (
    <section>
      <SectionTitle>孕期日期</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm text-muted-foreground">目前預產期 {formatDate(family.edd, { weekday: true })}。修改後，只會重算尚未預約、尚未完成的建議時程。</p>
        <PregnancyForm value={value} onChange={setValue} showErrors={tried} />
        <Btn className="w-full" onClick={save}>
          更新日期
        </Btn>
      </Card>
    </section>
  );
}

function BirthSwitch() {
  const today = todayTW();
  const [baby, setBaby] = useState({ nickname: "", birthDate: today });
  const [delivery, setDelivery] = useState("");
  const [confirm, setConfirm] = useState(false);
  const go = async () => {
    try {
      await recordBirth({ baby, deliveryDate: delivery || baby.birthDate });
      toast.success("恭喜！已開啟產後照護與寶寶照護，孕期紀錄都保留著。");
      setConfirm(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setConfirm(false);
      toast.error(e.message.split("\n")[0]);
    }
  };
  return (
    <section id="birth" className="scroll-mt-20">
      <SectionTitle>寶寶出生了</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">會新增寶寶檔案、開啟媽媽的產後追蹤；孕期時間軸與紀錄全部保留。雙胞胎可在完成後到「家人」再新增一位寶寶。</p>
        <BabyForm value={baby} onChange={setBaby} full={false} />
        <Field label="生產日期" hint="不填就用寶寶的出生日期。">
          {(id) => <input id={id} type="date" max={today} className={inputClass} value={delivery} onChange={(e) => setDelivery(e.target.value)} />}
        </Field>
        <Btn variant="apricot" className="w-full" onClick={() => setConfirm(true)}>
          <Baby className="h-5 w-5" /> 切換為出生後
        </Btn>
      </Card>
      <Confirm open={confirm} title="切換為出生後？" body="未完成的產檢建議會標示為「已取消（寶寶已出生）」，已完成的紀錄不變。" confirmLabel="確定切換" onCancel={() => setConfirm(false)} onConfirm={go} />
    </section>
  );
}

function ReminderSettings() {
  const { settings } = useSprout();
  const [support, setSupport] = useState({ badge: false, push: false, share: false });
  useEffect(() => {
    setSupport({
      badge: "setAppBadge" in navigator,
      push: "PushManager" in window && "serviceWorker" in navigator,
      share: !!navigator.canShare,
    });
  }, []);
  return (
    <section>
      <SectionTitle>提醒與行事曆</SectionTitle>
      <Card className="space-y-3">
        <label className="flex min-h-[48px] items-center justify-between gap-3">
          <span>
            <span className="block text-[15px] font-semibold">匯出時顯示項目名稱</span>
            <span className="block text-xs text-muted-foreground">預設關閉：標題只寫「家庭健康提醒」，鎖定畫面不露出細節。</span>
          </span>
          <input type="checkbox" className="h-6 w-6 accent-[hsl(var(--primary))]" checked={settings.icsDetail} onChange={(e) => updateSettings({ icsDetail: e.target.checked })} />
        </label>
        <label className="flex min-h-[44px] items-center justify-between">
          <span className="text-[15px] font-semibold">預設前一天提醒</span>
          <input type="checkbox" className="h-6 w-6 accent-[hsl(var(--primary))]" checked={settings.alarmDay} onChange={(e) => updateSettings({ alarmDay: e.target.checked })} />
        </label>
        <label className="flex min-h-[44px] items-center justify-between">
          <span className="text-[15px] font-semibold">預設前 2 小時提醒</span>
          <input type="checkbox" className="h-6 w-6 accent-[hsl(var(--primary))]" checked={settings.alarmHours} onChange={(e) => updateSettings({ alarmHours: e.target.checked })} />
        </label>
        <div className="rounded-2xl bg-secondary px-3 py-2 text-[13px] leading-relaxed">
          <p className="flex items-center gap-1.5 font-bold">
            <BellRing className="h-4 w-4" /> 這支手機的支援狀態
          </p>
          <p>App 圖示數字角標：{support.badge ? "瀏覽器支援（加入主畫面後才會顯示，依系統設定）" : "不支援，只在 App 內顯示數字"}</p>
          <p>分享檔案到行事曆：{support.share ? "支援" : "不支援，請用「下載 .ics」或「複製資訊」"}</p>
          <p>背景推播：第一版未啟用（需要排程伺服器與真機驗證）。App 關閉時的提醒請用手機行事曆。</p>
        </div>
      </Card>
    </section>
  );
}

function InstallGuide() {
  return (
    <section>
      <SectionTitle>加入手機主畫面</SectionTitle>
      <Card className="space-y-2 text-[15px] leading-relaxed">
        <p className="flex items-center gap-1.5 font-bold">
          <Smartphone className="h-5 w-5 text-primary" /> iPhone（Safari）
        </p>
        <p>按下方「分享」→「加入主畫面」→「新增」。</p>
        <p className="flex items-center gap-1.5 pt-1 font-bold">
          <Smartphone className="h-5 w-5 text-primary" /> Android（Chrome）
        </p>
        <p>按右上「⋮」→「加到主畫面」或「安裝應用程式」。</p>
        <p className="text-[13px] text-muted-foreground">加入主畫面後，資料仍存在同一個瀏覽器裡；用其他瀏覽器開啟會看不到。</p>
      </Card>
    </section>
  );
}

function BackupSection() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [importPw, setImportPw] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const doBackup = async () => {
    setBusy(true);
    try {
      const text = await createBackup(snapshotForBackup(), pw);
      const blob = new Blob([text], { type: "application/octet-stream" });
      const name = backupFileName(todayTW());
      const f = typeof File !== "undefined" ? new File([blob], name, { type: "application/octet-stream" }) : null;
      if (f && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
      toast.success("已產生加密備份。請把檔案存到雲端硬碟或電腦，並記住密碼。");
      setPw("");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setError("");
    setBusy(true);
    try {
      const text = await file.text();
      setPreview(await readBackup(text, importPw));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await replaceEverything(preview.snapshot);
      toast.success("已還原備份");
      setPreview(null);
      setFile(null);
      setImportPw("");
    } catch (e) {
      toast.error(`還原失敗，原本的資料沒有變動：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const current = summarize(snapshotForBackup());

  return (
    <section>
      <SectionTitle>備份與還原</SectionTitle>
      <Card className="space-y-4">
        <p className="rounded-2xl bg-accent px-3 py-2 text-[14px] font-semibold leading-relaxed text-accent-foreground">
          ⚠ 資料只存在這支手機的瀏覽器。換手機、清除瀏覽器資料或移除主畫面圖示前，請先備份。
        </p>
        <Field label="設定備份密碼" required hint="至少 6 個字。忘記密碼就無法還原，小芽也無法幫忙找回。">
          {(id) => <input id={id} type="password" autoComplete="new-password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        <Btn className="w-full" disabled={busy || pw.length < 6} onClick={doBackup}>
          <Download className="h-5 w-5" /> 產生加密備份
        </Btn>
        <hr className="border-border" />
        <p className="flex items-center gap-1.5 text-[15px] font-bold">
          <FileLock2 className="h-5 w-5 text-primary" /> 從備份還原
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".sproutbackup,application/octet-stream,application/json"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setError("");
          }}
        />
        <Btn variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
          <Upload className="h-5 w-5" /> {file ? `已選：${file.name}` : "選擇備份檔"}
        </Btn>
        {file ? (
          <>
            <Field label="備份密碼" required>
              {(id) => <input id={id} type="password" autoComplete="off" className={inputClass} value={importPw} onChange={(e) => setImportPw(e.target.value)} />}
            </Field>
            <Btn variant="soft" className="w-full" disabled={busy || !importPw} onClick={check}>
              檢查備份內容
            </Btn>
          </>
        ) : null}
        {error ? <p role="alert" className="rounded-2xl border-2 border-destructive bg-[hsl(var(--alert-bg))] px-3 py-2 text-[14px] font-semibold text-[hsl(var(--alert-fg))]">⚠ {error}</p> : null}
      </Card>
      <Confirm
        open={!!preview}
        title="用這份備份取代目前資料？"
        busy={busy}
        confirmLabel="確認還原"
        danger
        onCancel={() => setPreview(null)}
        onConfirm={restore}
        body={
          preview ? (
            <div className="space-y-2">
              <p>備份時間：{new Date(preview.createdAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</p>
              <p>
                備份內容：{preview.summary.stage}；寶寶 {preview.summary.babies.length} 位{preview.summary.babies.length ? `（${preview.summary.babies.join("、")}）` : ""}；紀錄 {preview.summary.records} 筆；待辦 {preview.summary.todos} 項
              </p>
              <p className="text-muted-foreground">
                目前手機上：{current.stage}；寶寶 {current.babies.length} 位；紀錄 {current.records} 筆。還原後會被取代。
              </p>
            </div>
          ) : null
        }
      />
    </section>
  );
}

function DemoSection() {
  const { family } = useSprout();
  const [which, setWhich] = useState(null);
  const load = async () => {
    await replaceEverything(which === "preg" ? demoPregnancy() : demoBorn());
    toast.success("已載入虛構範例資料");
    setWhich(null);
  };
  return (
    <section>
      <SectionTitle>範例資料</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted-foreground">用虛構家庭試用所有功能。{family?.demo ? "目前顯示的是範例資料。" : ""}</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="md" variant="outline" onClick={() => setWhich("preg")}>
            <FlaskConical className="h-4 w-4" /> 孕期範例
          </Btn>
          <Btn size="md" variant="outline" onClick={() => setWhich("born")}>
            <FlaskConical className="h-4 w-4" /> 兩個寶寶範例
          </Btn>
        </div>
        {family?.demo ? (
          <Btn
            variant="soft"
            className="w-full"
            onClick={async () => {
              await wipeAll();
              toast.success("已清除範例資料");
            }}
          >
            清除範例資料
          </Btn>
        ) : null}
      </Card>
      <Confirm open={!!which} title="載入範例資料？" body={family && !family.demo ? "目前的家庭資料會被範例取代。請先備份。" : "會取代目前的範例資料。"} danger={!!family && !family.demo} confirmLabel="載入" onCancel={() => setWhich(null)} onConfirm={load} />
    </section>
  );
}

function DangerZone() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  return (
    <section>
      <SectionTitle>刪除全部資料</SectionTitle>
      <Card className="space-y-3 border-destructive/40">
        <p className="text-sm text-muted-foreground">刪除這支手機上小芽的所有家人、紀錄、待辦與回答。已匯出到手機行事曆的事件不會被刪除。</p>
        <Btn variant="danger" className="w-full" onClick={() => setStep(1)}>
          <Trash2 className="h-5 w-5" /> 刪除全部資料
        </Btn>
      </Card>
      <Confirm open={step === 1} title="確定要刪除全部資料嗎？" body="建議先做加密備份。刪除後無法復原。" danger confirmLabel="下一步" onCancel={() => setStep(0)} onConfirm={() => setStep(2)} />
      <Sheet
        open={step === 2}
        onClose={() => setStep(0)}
        title="最後確認"
        footer={
          <Btn
            variant="danger"
            className="w-full"
            disabled={typed !== "刪除"}
            onClick={async () => {
              await wipeAll();
              setStep(0);
              toast.success("已刪除全部資料");
            }}
          >
            永久刪除
          </Btn>
        }
      >
        <Field label="請輸入「刪除」兩個字" required>
          {(id) => <input id={id} className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} />}
        </Field>
      </Sheet>
    </section>
  );
}
