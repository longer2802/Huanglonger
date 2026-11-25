# 損益平衡點試算：單一 HTML App

AI 數位森林平台上的商業小工具。輸入固定成本與毛利率，就能算出：
- **要打平**：固定成本 ÷ 實際毛利率（每月、每天）
- **要賺錢**：（固定成本＋目標淨利）÷ 實際毛利率（每月、每天）
- 實際毛利率＝產品毛利率－營業稅率（簡化算法；可切換「沒開發票」）

另外附有：完整計算過程、營業額與淨利圖、不同淨利目標對照表、「檢查我的營業額」（顯示虧多少／賺多少、安全邊際）、複製結果、列印／存 PDF。
輸入的數字只存在使用者自己的裝置（localStorage），不需要網路、不需要登入。

## 檔案
| 檔案 | 用途 |
|---|---|
| `release/breakeven.html` | App 成品（單一檔案，含圖示），放上平台或下載都用這個 |
| `release/platform-embed-demo.html` | 平台嵌入範例：iframe＋下載按鈕＋自動高度 |
| `icons/icon.svg`、`icon-180/192/512.png` | App 圖示（平台卡片、主畫面圖示用） |
| `src/app.html` | 原始碼（圖示位置以 `{{ICON_192}}`、`{{ICON_180}}` 表示） |

## 放上平台
```html
<a href="breakeven.html" download="breakeven.html">下載 App</a>
<iframe id="app" src="breakeven.html" title="損益平衡點試算" scrolling="no" style="width:100%;height:900px;border:0"></iframe>
<script>
  // App 會回報內容高度，iframe 跟著調整，就不會有兩層捲軸
  addEventListener("message", (e) => {
    if (e.data?.type === "ai-forest-app-height" && e.data.app === "breakeven")
      document.getElementById("app").style.height = Math.ceil(e.data.height) + "px";
  });
</script>
```

## 修改後重新產生
```bash
npm run icons   # 改了 icons/icon.svg 才需要（需要 Playwright）
npm run build   # 產出 release/breakeven.html
```

## 已上架（Claude 網頁）
- 網址：https://claude.ai/artifact/VuCNijZrF1tNk2fZsmBBQr （預設只有擁有者能開，分享請用頁面的「Share」）
- 原始碼：`src/artifact.html`（圖示位置為 `{{ICON_192}}`），發布檔：`release/breakeven-claude.html`
- 與 `src/app.html` 的差異：支援深色模式、拿掉列印按鈕（Claude 網頁不能開列印視窗）、清空改為按兩次確認

> 先前曾放在 Base44（app-0d6e7919），依使用者要求改為 Claude 網頁；這個 App 不使用 Base44。
