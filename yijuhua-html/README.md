# 一句話記帳：單一 HTML 版

把 Base44 上線版的「一句話記帳」打包成**一個 HTML 檔**，可以嵌入 AI 數位森林平台，也可以下載到平板或電腦離線使用。
**這個資料夾和 Base44 上線版互不影響**：程式碼是讀取出來另外打包的，上線版沒有任何改動。

## 成品（release/）
| 檔案 | 用途 |
|---|---|
| `yijuhua-app.html` | App 本體，所有程式、樣式、圖示都在這個檔案裡。點兩下就能用，不需要網路。 |
| `platform-embed-demo.html` | 平台嵌入範例：用 `<iframe>` 把 App 放在平台頁面裡，旁邊有「下載 App」按鈕。 |

## 放上平台的方式
把兩個檔案放在同一個資料夾，平台頁面加入：
```html
<a href="yijuhua-app.html" download="yijuhua-app.html">下載 App</a>
<iframe src="yijuhua-app.html" title="一句話記帳" allow="microphone"
        style="width:100%;height:80vh;border:0"></iframe>
```
`allow="microphone"` 讓嵌入的 App 可以用語音記帳。

## 與上線版的差異
- 換頁改用網址 `#`（例如 `yijuhua-app.html#/ledger`），直接開檔或嵌入時都能正常換頁。
- 拿掉 Base44 登入、雲端同步與伺服器端程式；記帳資料只存在該裝置的瀏覽器（和上線版的「純手機版」相同）。
- 換裝置時，用「設定 → 匯出備份／匯入備份」搬移資料。上線版與 HTML 版的備份 CSV 格式相同，可以互相匯入。
- 語音記帳使用瀏覽器內建的語音辨識；Safari 或 Chrome 需要連網才能辨識語音，打字記帳完全離線可用。

## 重新打包
```bash
npm install
npm run build   # 產出 release/yijuhua-app.html
```
上線版程式更新後，要把 `src/` 裡對應的檔案同步過來再重新打包。
