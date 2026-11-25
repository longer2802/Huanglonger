# 媽媽手冊E版：單一 HTML 版

把 Base44 上線版的「媽媽手冊E版」打包成**一個 HTML 檔**，可以嵌入 AI 數位森林平台，也可以下載到平板或電腦使用。
**和 Base44 上線版互不影響**：原始碼取自 `../sprout-app/`（已確認與 Base44 上的版本一致），另外打包，上線版沒有任何改動。

## 成品（release/）
| 檔案 | 用途 |
|---|---|
| `mama-handbook.html` | App 本體。程式、樣式、Logo、WHO 生長曲線資料都在這個檔案裡，完全不需要網路。 |
| `platform-embed-demo.html` | 平台嵌入範例：用 `<iframe>` 把 App 放在平台頁面裡，旁邊有「下載 App」按鈕。 |

## 放上平台的方式
把兩個檔案放在同一個資料夾，平台頁面加入：
```html
<a href="mama-handbook.html" download="mama-handbook.html">下載 App</a>
<iframe src="mama-handbook.html" title="媽媽手冊E版" style="width:100%;height:80vh;border:0"></iframe>
```

## 與上線版的差異
- 換頁改用網址 `#`（例如 `mama-handbook.html#/handbook`），直接開檔或嵌入時都能正常換頁。
- Logo 和 WHO 0–5 歲生長曲線資料直接包進檔案，不再從 Base44 下載。
- 拿掉 Base44 的伺服器端程式。資料存在該裝置的瀏覽器（IndexedDB），和上線版一樣免登入。
- 換裝置時，用「我的」頁面的備份功能搬移資料。

## 重新打包
```bash
npm install
npm run build   # 產出 release/mama-handbook.html
```
上線版更新後，先把 `../sprout-app/src` 同步成最新版本，再把改動套用到這裡的 `src/`，然後重新打包。
這裡和上線版不同的檔案有：`main.jsx`、`routes/__root.jsx`、`lib/icons.js`、`lib/growth.js`（WHO 資料改為直接載入）、`routes/me.jsx`（`#birth` 判斷）。
