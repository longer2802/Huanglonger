import { useEffect, useState } from "react";
import Home from "./components/Home";
import OrderEditor, { STEPS, type StepKey } from "./components/OrderEditor";
import { ToastProvider } from "./components/ui";

// 用網址 hash 記住目前畫面，重新整理後回到同一張訂單、同一個步驟
type Route = { page: "home" } | { page: "order"; id: string; step: StepKey };

function parseHash(): Route {
  const m = window.location.hash.match(/^#\/order\/([^/]+)(?:\/(\w+))?/);
  if (m) {
    const step = (STEPS.find((s) => s.key === m[2])?.key ?? "menu") as StepKey;
    return { page: "order", id: decodeURIComponent(m[1]), step };
  }
  return { page: "home" };
}

export function go(route: Route) {
  window.location.hash = route.page === "home" ? "#/" : `#/order/${encodeURIComponent(route.id)}/${route.step}`;
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const fn = () => setRoute(parseHash());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return (
    <ToastProvider>
      <div className="app">
        {route.page === "home" ? (
          <Home onOpen={(id, step = "menu") => go({ page: "order", id, step })} />
        ) : (
          <OrderEditor key={route.id} orderId={route.id} step={route.step} onStep={(step) => go({ page: "order", id: route.id, step })} onHome={() => go({ page: "home" })} />
        )}
      </div>
    </ToastProvider>
  );
}
