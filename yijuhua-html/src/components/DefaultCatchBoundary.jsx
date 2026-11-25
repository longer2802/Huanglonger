import { ErrorComponent, Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function DefaultCatchBoundary({ error }) {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-5 py-24">
      <ErrorComponent error={error} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.invalidate()}>
          再試一次
        </Button>
        <Button asChild>
          <Link to="/">回首頁</Link>
        </Button>
      </div>
    </div>
  );
}
