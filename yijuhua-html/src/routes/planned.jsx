import { createFileRoute } from "@tanstack/react-router";
import SchedulePage from "@/components/SchedulePage";

export const Route = createFileRoute("/planned")({
  head: () => ({ meta: [{ title: "預定花費｜一句話記帳" }] }),
  component: () => <SchedulePage mode="planned" />,
});
