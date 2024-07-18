# LINE Notify for Google Calendar Reminder (GCal2LINE)

這個 Google Apps Script 程式用於自動檢查 Google Calendar 中的活動事件，並通過 LINE Notify 發送通知。

## 功能

- 每天早上 9 點檢查當天的活動事件
- 每天晚上 9 點檢查明天的活動事件
- 將未通知的事件發送到指定的 LINE Notify 頻道

## 設定說明

1. 在 Google Apps Script 中建立一個新專案。
2. 複製貼上程式碼。
3. 設定指令碼屬性屬性：
   - 在專案編輯器中，點擊左側的「專案設定」。
   - 在「指令碼屬性」部分，增加以下屬性：
     - `CALENDAR_ID`: 您要監控的 Google Calendar ID
     - `ACCESS_TOKEN`: 您的 LINE Notify 存取權杖
4. 設定觸發條件：
   - 在專案編輯器中，點擊左側的「觸發條件」。
   - 點擊「新增觸發條件」。
   - 選擇要執行的函式：`checkAndNotify`
   - 選擇部署方式：「Head」
   - 選擇事件來源：「時間驅動」
   - 選擇時間類型：「小時計時器」
   - 選擇小時間隔：「每小時」

## 使用注意事項

- 確保您有權限瀏覽指定的 Google Calendar。
- 確保您的 LINE Notify 存取權杖有效且未過期。
- 程式會自動標記已通知的事件，以避免重複通知。
- 如果遇到錯誤，程式會記錄錯誤訊息，您可以在 Google Apps Script 的「執行項目」中查看。

## 自定義

- 您可以在 `CONSTANTS` 對象中修改通知時間。
- 如需修改通知消息格式，請調整 `formatEventMessage` 函式。

## 故障排除

如果程式無法正常工作，請檢查：
1. 指令碼屬性是否正確設定。
2. Google Calendar ID 是否有效。
3. LINE Notify 存取權杖是否有效。
4. 檢查執行記錄中是否有錯誤訊息。

如有任何問題，請參考錯誤記錄或聯繫管理員。