import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { LedgerProvider } from "@/lib/ledger";

export const Route = createRootRoute({
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <LedgerProvider>
      <HeadContent />
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </LedgerProvider>
  );
}
