/**
 * LINE Notify for Google Calendar Reminder (GCal2LINE)
 * 
 * 使用說明：
 * 1. 在「專案設定」下的「指令碼屬性」中設定 CALENDAR_ID（Google Calendar ID） 和 ACCESS_TOKEN（LINE Notify 存取權杖）
 * 2. 設定「觸發條件」為「時間驅動」每小時執行 checkAndNotify 函式
 * 3. 程式將在早上 9 點檢查當天事件，晚上 9 點檢查明天事件
 */

// 常數設定
const CONSTANTS = {
  NOTIFICATION_HOUR_EVENING: 21, // 晚上檢查時間
  NOTIFICATION_HOUR_MORNING: 9,  // 早上檢查時間
  LINE_NOTIFY_ENDPOINT: "https://notify-api.LINE.me/api/notify"
};

/**
 * 主函式：檢查當前時間並觸發相應的通知
 * 設定觸發條件每小時執行此函式
 */
function checkAndNotify() {
  const now = new Date();
  const currentHour = now.getHours();
  
  if (currentHour === CONSTANTS.NOTIFICATION_HOUR_EVENING) {
    notifyEvents(DateUtils.getTomorrow(now), "明天");
  } else if (currentHour === CONSTANTS.NOTIFICATION_HOUR_MORNING) {
    notifyEvents(now, "今天");
  }
}

/**
 * 通知事件
 * @param {Date} date - 日期
 * @param {string} dayDescription - 日期描述（今天/明天）
 */
function notifyEvents(date, dayDescription) {
  try {
    const { start, end } = DateUtils.getDayRange(date);
    const calendarId = ConfigManager.get('CALENDAR_ID');
    const events = CalendarApp.getCalendarById(calendarId).getEvents(start, end);
    const notificationTag = `${dayDescription}_${DateUtils.formatDate(date, "yyyy-MM-dd")}`;
    
    const unnotifiedEvents = events.filter(event => event.getTag(notificationTag) !== "Notified");
    
    if (unnotifiedEvents.length > 0) {
      const message = unnotifiedEvents.map(formatEventMessage).join("\n\n");
      sendMessage(`\n\n${message}\n\n請家人們留意${dayDescription}活動時間哦！\n`);
      unnotifiedEvents.forEach(event => event.setTag(notificationTag, "Notified"));
    } else {
      Logger.log(`${dayDescription}的活動已經全部通知過，不再重複發送。`);
    }
  } catch (error) {
    ErrorHandler.handle(error, "notifyEvents");
  }
}

/**
 * 發送訊息
 * @param {string} message - 要發送的訊息
 */
function sendMessage(message) {
  if (message.trim() === "") return;
  
  const accessToken = ConfigManager.get('ACCESS_TOKEN');
  const options = {
    method: 'post',
    headers: { "Authorization": `Bearer ${accessToken}` },
    payload: { message }
  };
  
  try {
    const response = UrlFetchApp.fetch(CONSTANTS.LINE_NOTIFY_ENDPOINT, options);
    if (response.getResponseCode() === 200) {
      Logger.log("通知發送成功");
    } else {
      throw new Error(`發送失敗：${response.getContentText()}`);
    }
  } catch (error) {
    ErrorHandler.handle(error, "sendMessage");
  }
}

/**
 * 格式化事件訊息
 * @param {GoogleAppsScript.Calendar.CalendarEvent} event - 日曆事件
 * @returns {string} 格式化後的事件訊息
 */
function formatEventMessage(event) {
  const { dateString, timeString } = DateUtils.formatDateWithTime(event);
  let message = `活動：${event.getTitle()}\n日期：${dateString}`;
  if (timeString) {
    message += `\n時間：${timeString}`;
  }
  return message;
}

/**
 * 設定管理器
 * 使用說明：
 * 1. 在指令碼屬性中設定 CALENDAR_ID 和 ACCESS_TOKEN
 * 2. 使用 ConfigManager.get('CALENDAR_ID') 和 ConfigManager.get('ACCESS_TOKEN') 來取得值
 */
const ConfigManager = {
  get: function(key, defaultValue) {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return value !== null ? value : defaultValue;
  },
  set: function(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }
};

// 日期工具
const DateUtils = {
  formatDate: function(date, format) {
    return Utilities.formatDate(date, "Asia/Taipei", format);
  },
  formatTime: function(date) {
    return this.formatDate(date, "HH:mm");
  },
  getTomorrow: function(date) {
    return new Date(date.getTime() + (24 * 60 * 60 * 1000));
  },
  getDayRange: function(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return { start, end };
  },
  getChineseWeekday: function(day) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[day];
  },
  formatDateWithTime: function(event) {
    const startDate = event.getStartTime();
    const endDate = event.getEndTime();
    const dateString = this.formatDate(startDate, "yyyy 年 MM 月 dd 日");
    const weekday = this.getChineseWeekday(startDate.getDay());
    const formattedDate = `${dateString}（${weekday}）`;
    
    if (event.isAllDayEvent()) {
      return { dateString: formattedDate, timeString: null };
    }
    
    const timeString = `${this.formatTime(startDate)} ~ ${this.formatTime(endDate)}`;
    return { dateString: formattedDate, timeString: timeString };
  }
};

// 錯誤處理器
const ErrorHandler = {
  handle: function(error, functionName) {
    Logger.log(`錯誤發生在 ${functionName}: ${error.name} - ${error.message}`);
    // 這裡可以增加更多的錯誤處理邏輯，比如發送錯誤通知等
  }
};

/**
 * 使用說明：
 * 1. 確保已設定正確的 CALENDAR_ID 和 ACCESS_TOKEN
 * 2. 設定觸發條件每小時執行 checkAndNotify 函式
 * 3. 程式會自動檢查並發送通知
 * 4. 如遇問題，請查看「執行項目」中的錯誤訊息
 */