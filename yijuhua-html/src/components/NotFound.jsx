import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NotFound({ children }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-semibold tracking-tight">404</p>
      <p className="text-muted-foreground">{children ?? "找不到這個頁面。"}</p>
      <Button asChild>
        <Link to="/">回首頁</Link>
      </Button>
    </div>
  );
}
