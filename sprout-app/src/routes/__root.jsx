import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { Base44Scripts } from "base44:document";
import appCss from "@/index.css?url";
import { ICON_180 } from "@/lib/icons";

// No sign-in: every family's data stays in its own phone's browser.
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "小芽｜媽媽寶寶手冊" },
      { name: "description", content: "從第一次產檢，到寶寶的每一個第一次。免登入、資料只存在自己的手機。" },
      { name: "theme-color", content: "#FFE3EE" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "小芽" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "format-detection", content: "telephone=no" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: ICON_180 },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster theme="light" position="top-center" richColors closeButton />
    </>
  );
}

function RootDocument({ children }) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <HeadContent />
      </head>
      <body data-react-root="true">
        {children}
        <Base44Scripts />
        <Scripts />
      </body>
    </html>
  );
}
