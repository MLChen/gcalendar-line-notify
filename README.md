# GCal2LINE - Google Calendar LINE Bot 通知

這個 Google Apps Script 程式用於自動檢查 Google Calendar 中的活動事件，並透過 LINE Bot 發送通知到指定群組。

> **Note**: 原本使用 LINE Notify 的版本 (`main.gs`) 已棄用，因 LINE Notify 服務已於 2025 年 3 月 31 日終止。目前使用 LINE Messaging API 的版本 (`GCal2LINE.gs`)。

## 功能

- 每天早上 9 點檢查當天的活動事件
- 每天晚上 9 點檢查明天的活動事件
- 支援多個 LINE 群組與 Google 日曆的對應關係
- 支援單日與多日活動的不同顯示格式
- 自動標記已通知事件，避免重複發送
- 管理者指令介面

## 設定說明

### 1. 建立 LINE Bot

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 建立 Provider 和 Messaging API Channel
3. 取得 **Channel Access Token**
4. 在 Bot 設定中啟用 Webhook

### 2. 設定 Google Apps Script

1. 在 Google Apps Script 中建立新專案
2. 複製 `GCal2LINE.gs` 的內容貼上
3. 在「專案設定」→「指令碼屬性」中設定：

| 屬性名稱 | 說明 |
|---------|------|
| `CHANNEL_ACCESS_TOKEN` | LINE Bot 的頻道存取權杖 |
| `ADMIN_USER_ID` | 管理者的 LINE User ID |
| `NOTIFICATION_HOUR_MORNING` | 早上通知時間（預設 9） |
| `NOTIFICATION_HOUR_EVENING` | 晚上通知時間（預設 21） |

### 3. 部署為網路應用程式

1. 點擊「部署」→「新增部署」
2. 選擇類型為「網頁應用程式」
3. 設定：
   - 執行身分：我
   - 存取權限：所有人
4. 複製部署後的 URL

### 4. 設定 LINE Webhook

1. 回到 LINE Developers Console
2. 在 Messaging API 設定中，將部署 URL 填入 Webhook URL
3. 啟用 Use webhook

### 5. 設定觸發條件

1. 在 Apps Script 編輯器中，點擊「觸發條件」
2. 新增觸發條件：
   - 執行的函式：`checkAndNotify`
   - 事件來源：時間驅動
   - 時間類型：小時計時器
   - 間隔：每小時

## 管理者指令

將 Bot 加入群組後，管理者可透過私訊 Bot 執行以下指令：

| 指令 | 說明 |
|-----|------|
| `/help` | 顯示指令說明 |
| `/set [群組ID] [行事曆ID]` | 設定群組對應的行事曆 |
| `/list` | 列出所有群組設定 |
| `/remove [群組ID]` | 移除群組設定 |
| `/pending` | 查看待設定的群組 |

## 使用流程

1. 將 Bot 加入 LINE 群組
2. Bot 會自動通知管理者有新群組待設定
3. 管理者使用 `/set` 指令設定群組對應的 Google 日曆
4. 設定完成後，Bot 會在指定時間自動發送活動通知

## 檔案說明

| 檔案 | 說明 |
|-----|------|
| `GCal2LINE.gs` | 主程式（LINE Messaging API 版本） |
| `main.gs` | 舊版程式（LINE Notify 版本，已棄用） |

## 故障排除

1. **Bot 沒有發送通知**
   - 確認觸發條件已正確設定
   - 檢查群組是否已設定對應的日曆
   - 查看 Apps Script 的執行記錄

2. **Webhook 無法連線**
   - 確認部署 URL 正確
   - 確認部署存取權限為「所有人」
   - 檢查 LINE Developers Console 的 Webhook 驗證狀態

3. **找不到日曆活動**
   - 確認 Google 日曆 ID 正確
   - 確認 Apps Script 有存取該日曆的權限

## 授權

MIT License
