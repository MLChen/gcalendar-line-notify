var GoogleCalendarID = "YOUR_CALENDAR_ID@gmail.com"; // 請替換為您的日曆 ID
var LineNotifyEndPoint = "https://notify-api.line.me/api/notify";
var AccessToken = "YOUR_LINE_NOTIFY_ACCESS_TOKEN"; // 請替換為您的 LINE Notify 存取權杖

function checkAndNotify() {
  var now = new Date();
  var currentHour = now.getHours();
  
  if (currentHour === 21) {
    // 晚上 9 點：檢查並通知明天的活動
    var tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    notifyEvents(tomorrow, "明天");
  } else if (currentHour === 9) {
    // 早上 9 點：檢查並通知今天的活動
    notifyEvents(now, "今天");
  }
}

function notifyEvents(date, dayDescription) {
  var start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  var end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  var events = CalendarApp.getCalendarById(GoogleCalendarID).getEvents(start, end);
  
  var message = "";
  var hasUnnotifiedEvents = false;
  var notificationTag = dayDescription + "_" + Utilities.formatDate(date, "GMT", "yyyy-MM-dd");

  events.forEach(function(event) {
    if (event.getTag(notificationTag) !== "Notified") {
      hasUnnotifiedEvents = true;
      message += "\n活動：" + event.getTitle();
      message += "\n日期：" + formatDateWithTime(event);
      message += "\n";
      event.setTag(notificationTag, "Notified");
    }
  });
  
  if (hasUnnotifiedEvents) {
    sendMessage( "\n" + message + "\n請各位家人留意" + dayDescription + "的活動時間哦！\n"); // 客製化訊息，可以自訂
  } else {
    Logger.log(dayDescription + "的活動已經全部通知過，不再重複發送。");
  }
}

function formatDateWithTime(event) {
  var date = event.getStartTime();
  var year = date.getFullYear();
  var month = date.getMonth() + 1; // getMonth() 返回 0-11
  var day = date.getDate();
  var dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  
  var formattedDate = year + ' 年 ' + month + ' 月 ' + day + ' 日（' + dayOfWeek + '）';
  
  if (!event.isAllDayEvent()) {
    var hours = date.getHours().toString().padStart(2, '0');
    var minutes = date.getMinutes().toString().padStart(2, '0');
    formattedDate += ' ' + hours + ':' + minutes;
  }
  
  return formattedDate;
}

function sendMessage(message) {
  if (message.trim() === "") return; // 如果沒有訊息內容，就不發送

  var formData = {
    "message": message
  };
  var options = {
    "headers" : {"Authorization" : "Bearer " + AccessToken},
    "method" : 'post',
    "payload" : formData
  };
  
  try {
    var response = UrlFetchApp.fetch(LineNotifyEndPoint, options);
    if (response.getResponseCode() !== 200) {
      Logger.log("發送失敗：" + response.getContentText());
    } else {
      Logger.log("通知發送成功");
    }
  } catch (error) {
    Logger.log(error.name + "：" + error.message);
  }
}

/**
 * 設置說明：
 * 1. 請確保替換以下內容：
 *    - YOUR_CALENDAR_ID@gmail.com：用您的 Google 日曆 ID 替換
 *    - YOUR_LINE_NOTIFY_ACCESS_TOKEN：用您的 LINE Notify 存取權杖替換
 * 
 * 2. 在 Google Apps Script 界面上：
 *    - 轉到「觸發器」頁面
 *    - 點擊「添加觸發器」
 *    - 選擇運行的函數：checkAndNotify
 *    - 選擇部署時：發生變化時
 *    - 選擇事件來源：時間驅動
 *    - 選擇時間型觸發器：分鐘定時器
 *    - 選擇時間間隔：每5分鐘
 * 
 **/