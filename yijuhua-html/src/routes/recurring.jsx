import { createFileRoute } from "@tanstack/react-router";
import SchedulePage from "@/components/SchedulePage";

export const Route = createFileRoute("/recurring")({
  head: () => ({ meta: [{ title: "固定繳費｜一句話記帳" }] }),
  component: () => <SchedulePage mode="recurring" />,
});
