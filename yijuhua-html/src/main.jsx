import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// 用網址的 # 切換頁面：直接開檔（file://）、嵌入平台（iframe）都能正常換頁
const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: false });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
