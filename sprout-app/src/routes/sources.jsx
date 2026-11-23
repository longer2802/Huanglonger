import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card, Pill, SectionTitle } from "@/components/kit";
import { SOURCES } from "@/lib/sources";
import { CARDS, CONTENT_VERSION, isShowable } from "@/lib/content";
import { RULES } from "@/lib/rules";

export const Route = createFileRoute("/sources")({
  ssr: false,
  head: () => ({ meta: [{ title: "官方資料核對・媽媽手冊E版" }] }),
  component: () => (
    <AppShell allowWithoutFamily>
      <SourcesPage />
    </AppShell>
  ),
});

function SourcesPage() {
  const drafts = CARDS.filter((c) => !isShowable(c));
  return (
    <div className="space-y-5">
      <Link to="/me" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-primary">
        <ArrowLeft className="h-5 w-5" /> 返回
      </Link>
      <h1 className="text-xl font-extrabold">官方資料與版本核對</h1>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        內容資料版本 {CONTENT_VERSION}。每張衛教卡都是媽媽手冊E版自行摘要，保留來源名稱、章節頁碼與版本；尚未經醫療專業審閱，公開版本僅供展示測試。
      </p>
      <section className="space-y-3">
        <SectionTitle>來源版本</SectionTitle>
        {Object.entries(SOURCES).map(([id, s]) => {
          const used = CARDS.filter((c) => c.source.id === id).length + RULES.filter((r) => r.source.id === id).length;
          return (
            <Card key={id} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-bold">{s.name}</h2>
                <Pill tone={s.status === "verified" ? "done" : "apricot"}>{s.status === "verified" ? "已核對原文" : "版次待確認・草稿"}</Pill>
              </div>
              <p className="text-[14px]">{s.publisher}</p>
              <p className="text-[14px]">版本：{s.edition}</p>
              <p className="text-[13px] text-muted-foreground">{s.note}</p>
              <p className="text-[13px] text-muted-foreground">
                核對日：{s.checkedOn}・引用於 {used} 張卡片／時程規則
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-[14px] font-semibold">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                  原文 <ExternalLink className="h-4 w-4" />
                </a>
                <a href={s.portal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                  官方入口 <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </Card>
          );
        })}
      </section>
      <section className="space-y-2">
        <SectionTitle>草稿（不顯示給爸媽）</SectionTitle>
        {drafts.map((c) => (
          <Card key={c.id} className="space-y-1 border-dashed">
            <p className="font-bold">{c.title}</p>
            <p className="text-[13px] text-muted-foreground">
              {SOURCES[c.source.id]?.name}・{c.source.section}・{c.source.page}：{SOURCES[c.source.id]?.edition}
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
