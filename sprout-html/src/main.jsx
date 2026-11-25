import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import { ICON_180 } from "@/lib/icons";

// 主畫面圖示（加入主畫面時使用）
const touch = document.createElement("link");
touch.rel = "apple-touch-icon";
touch.href = ICON_180;
document.head.appendChild(touch);
const fav = document.createElement("link");
fav.rel = "icon";
fav.href = ICON_180;
document.head.appendChild(fav);

// 用網址的 # 切換頁面：直接開檔（file://）、嵌入平台（iframe）都能正常換頁
const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: false });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
