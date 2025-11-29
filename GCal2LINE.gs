/**
 * LINE Bot for Google Calendar Reminder (GCal2LINE)
 * Version: 1.0.0
 * Last Updated: 2024-03-19
 * 
 * 功能說明：
 * - 自動檢查 Google Calendar 活動並透過 LINE 發送通知
 * - 支援多個群組和日曆的對應關係
 * - 支援單日和多日活動的不同顯示格式
 * - 提供完整的管理者指令介面
 * 
 * 設定說明：
 * 1. 在「專案設定」下的「指令碼屬性」中設定：
 *    - CHANNEL_ACCESS_TOKEN（LINE Bot 的頻道存取權杖）
 *    - ADMIN_USER_ID（管理者的 LINE User ID）
 *    - NOTIFICATION_HOUR_MORNING（早上檢查時間，預設為 9）
 *    - NOTIFICATION_HOUR_EVENING（晚上檢查時間，預設為 21）
 * 
 * 2. 設定觸發條件：
 *    - 時間驅動：每小時執行一次 checkAndNotify 函式
 * 
 * 管理者指令：
 * - /help：顯示指令說明
 * - /set [群組ID] [行事曆ID]：設定群組對應的行事曆
 * - /list：列出所有群組設定
 * - /remove [群組ID]：移除群組設定
 * - /pending：查看待設定的群組
 */

// ============================
// 常數設定
// ============================
const CONSTANTS = {
  // API 端點
  LINE_API: {
    ENDPOINT: "https://api.line.me/v2/bot/message/push",
    GROUP_SUMMARY: "https://api.line.me/v2/bot/group/%s/summary",
    REPLY: "https://api.line.me/v2/bot/message/reply"
  },
  
  // 儲存鍵值
  STORAGE_KEYS: {
    GROUP_MAPPINGS: "GROUP_CALENDAR_MAPPINGS",
    PENDING_GROUPS: "PENDING_GROUPS"
  },
  
  // 管理者指令
  ADMIN_COMMANDS: {
    HELP: "/help",
    SET: "/set",
    LIST: "/list",
    REMOVE: "/remove",
    PENDING: "/pending"
  },
  
  // HTTP 標頭
  HEADERS: {
    CORS: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  }
};

/**
 * 群組管理器：處理群組與行事曆的對應關係
 */
const GroupManager = {
  // 取得所有群組對應
  getAllMappings() {
    const mappingsStr = PropertiesService.getScriptProperties()
      .getProperty(CONSTANTS.STORAGE_KEYS.GROUP_MAPPINGS);
    return mappingsStr ? JSON.parse(mappingsStr) : {};
  },

  // 儲存所有群組對應
  saveMappings(mappings) {
    PropertiesService.getScriptProperties()
      .setProperty(CONSTANTS.STORAGE_KEYS.GROUP_MAPPINGS, JSON.stringify(mappings));
  },

  // 新增群組對應
  addMapping(groupId, calendarId) {
    const mappings = this.getAllMappings();
    mappings[groupId] = calendarId;
    this.saveMappings(mappings);
    this.removePendingGroup(groupId); // 從待處理清單中移除
  },

  // 移除群組對應
  removeMapping(groupId) {
    const mappings = this.getAllMappings();
    delete mappings[groupId];
    this.saveMappings(mappings);
  },

  // 取得特定群組的行事曆 ID
  getCalendarId(groupId) {
    return this.getAllMappings()[groupId];
  },

  // 取得所有待設定的群組
  getPendingGroups() {
    const pendingStr = PropertiesService.getScriptProperties()
      .getProperty(CONSTANTS.STORAGE_KEYS.PENDING_GROUPS);
    return pendingStr ? JSON.parse(pendingStr) : [];
  },

  // 儲存待設定的群組
  savePendingGroups(groups) {
    PropertiesService.getScriptProperties()
      .setProperty(CONSTANTS.STORAGE_KEYS.PENDING_GROUPS, JSON.stringify(groups));
  },

  // 新增待設定群組
  addPendingGroup(groupId) {
    const groups = this.getPendingGroups();
    if (!groups.includes(groupId)) {
      groups.push(groupId);
      this.savePendingGroups(groups);
    }
  },

  // 移除待設定群組
  removePendingGroup(groupId) {
    const groups = this.getPendingGroups();
    const index = groups.indexOf(groupId);
    if (index > -1) {
      groups.splice(index, 1);
      this.savePendingGroups(groups);
    }
  },

  /**
   * 驗證行事曆 ID 是否有效
   */
  validateCalendarId: function(calendarId) {
    try {
      const calendar = CalendarApp.getCalendarById(calendarId);
      return calendar !== null;
    } catch (error) {
      Logger.log(`行事曆驗證失敗：${error.message}`);
      return false;
    }
  }
};

/**
 * 主函式：檢查當前時間並觸發相應的通知
 */
function checkAndNotify() {
  const now = new Date();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  try {
    Logger.log('=== 開始檢查通知 ===');
    Logger.log(`執行時間：${now.toISOString()}`);
    
    // 讀取設定
    const settings = {
      morningHour: parseInt(scriptProperties.getProperty('NOTIFICATION_HOUR_MORNING') || '9'),
      eveningHour: parseInt(scriptProperties.getProperty('NOTIFICATION_HOUR_EVENING') || '21'),
      isTestMode: scriptProperties.getProperty('TEST_MODE') === 'true'
    };
    
    Logger.log(`設定資訊：${JSON.stringify(settings)}`);
    
    // 測試模式處理
    if (settings.isTestMode) {
      Logger.log('測試模式已啟用，強制執行通知');
      return notifyAllGroups(now, "今天");
    }
    
    // 正常模式處理
    const currentHour = now.getHours();
    if (DateUtils.isInTimeRange(now, settings.eveningHour)) {
      Logger.log('執行晚上通知（明天的活動）');
      notifyAllGroups(DateUtils.getTomorrow(now), "明天");
    } else if (DateUtils.isInTimeRange(now, settings.morningHour)) {
      Logger.log('執行早上通知（今天的活動）');
      notifyAllGroups(now, "今天");
    } else {
      Logger.log(`現在不是通知時間 (${currentHour}:${now.getMinutes()})`);
    }
    
  } catch (error) {
    const errorDetail = ErrorHandler.logDetailed(error, { functionName: 'checkAndNotify' });
    notifyAdmin('執行通知時發生錯誤', errorDetail);
  }
}

/**
 * 設置測試模式
 */
function setTestMode(enabled) {
  PropertiesService.getScriptProperties()
    .setProperty('TEST_MODE', enabled.toString());
  Logger.log(`測試模式已${enabled ? '啟用' : '停用'}`);
}

/**
 * 通知所有已設定的群組
 */
function notifyAllGroups(date, dayDescription) {
  const groupMappings = GroupManager.getAllMappings();
  Logger.log(`開始處理 ${Object.keys(groupMappings).length} 個群組的通知`);
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  Object.entries(groupMappings).forEach(([groupId, calendarId]) => {
    try {
      const notificationResult = notifyGroupEvents(groupId, calendarId, date, dayDescription);
      if (notificationResult.sent) {
        results.success++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        groupId,
        error: error.message
      });
      ErrorHandler.handle(error, `notifyGroupEvents for group ${groupId}`);
    }
  });
  
  // 記錄執行結果
  Logger.log(`通知執行結果：
成功：${results.success}
跳過：${results.skipped}
失敗：${results.failed}
${results.errors.length > 0 ? '\n錯誤詳情：\n' + JSON.stringify(results.errors, null, 2) : ''}`);
  
  return results;
}

/**
 * 通知特定群組的事件
 */
function notifyGroupEvents(groupId, calendarId, date, dayDescription) {
  const result = {
    sent: false,
    eventCount: 0,
    notifiedCount: 0,
    error: null
  };
  
  try {
    Logger.log(`檢查群組 ${groupId} 的 ${dayDescription} 活動通知狀態`);
    
    const { start, end } = DateUtils.getDayRange(date);
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      throw new Error(`找不到行事曆：${calendarId}`);
    }
    
    const events = calendar.getEvents(start, end);
    result.eventCount = events.length;
    Logger.log(`找到 ${events.length} 個活動`);
    
    const notificationTag = `${groupId}_${dayDescription}_${DateUtils.formatDate(date, "yyyy-MM-dd")}`;
    const unnotifiedEvents = filterUnnotifiedEvents(events, notificationTag, date);
    result.notifiedCount = result.eventCount - unnotifiedEvents.length;
    
    if (unnotifiedEvents.length > 0) {
      const message = formatGroupNotification(groupId, unnotifiedEvents, dayDescription);
      sendMessage(groupId, message);
      
      // 標記已通知的事件
      markEventsAsNotified(unnotifiedEvents, notificationTag);
      
      result.sent = true;
      Logger.log(`成功發送 ${unnotifiedEvents.length} 個活動的通知`);
    } else {
      Logger.log(`群組 ${groupId} 的${dayDescription}活動已經全部通知過，不再重複發送。`);
    }
    
  } catch (error) {
    result.error = error.message;
    ErrorHandler.handle(error, "notifyGroupEvents");
  }
  
  return result;
}

/**
 * 過濾未通知的事件
 */
function filterUnnotifiedEvents(events, notificationTag, currentDate) {
  return events.filter(event => {
    const allTags = event.getAllTagKeys();
    Logger.log(`檢查活動：${event.getTitle()}`);
    Logger.log(`所有標記：${JSON.stringify(allTags)}`);
    
    // 檢查是否為多日活動
    const startDate = event.getStartTime();
    const endDate = event.getEndTime();
    const isMultiDayEvent = !DateUtils.isSameDay(startDate, endDate);
    
    // 如果是多日活動，檢查當前日期是否為開始日期
    if (isMultiDayEvent && !DateUtils.isSameDay(startDate, currentDate)) {
      Logger.log(`多日活動非第一天，跳過通知`);
      return false;
    }
    
    // 檢查通知狀態
    return !isEventNotified(event, notificationTag);
  });
}

/**
 * 檢查事件是否已通知
 */
function isEventNotified(event, notificationTag) {
  // 1. 檢查事件標記
  if (event.getAllTagKeys().includes(notificationTag)) {
    const tagValue = event.getTag(notificationTag);
    Logger.log(`通知標記值：${tagValue}`);
    if (tagValue === "Notified") {
      return true;
    }
  }
  
  // 2. 檢查描述
  const description = event.getDescription() || "";
  const tagMarker = `[${notificationTag}=Notified]`;
  const isNotifiedInDescription = description.includes(tagMarker);
  Logger.log(`檢查描述中的標記：${isNotifiedInDescription ? "找到標記" : "未找到標記"}`);
  
  return isNotifiedInDescription;
}

/**
 * 標記事件為已通知
 */
function markEventsAsNotified(events, notificationTag) {
  events.forEach(event => {
    try {
      Logger.log(`準備設置標記 ${notificationTag} 為 Notified`);
      
      // 使用 try-catch 分別處理每個步驟
      try {
        // 先嘗試刪除現有標記
        if (event.getAllTagKeys().includes(notificationTag)) {
          event.deleteTag(notificationTag);
          Logger.log(`已清除舊標記`);
        }
        
        // 設置新標記
        event.setTag(notificationTag, "Notified");
        Logger.log(`已設置新標記`);
        
        // 等待一下確保標記已被設置
        Utilities.sleep(500);
        
        // 驗證標記
        const verifyTag = event.getTag(notificationTag);
        Logger.log(`驗證標記 - 活動：${event.getTitle()}，標記值：${verifyTag}`);
        
        if (verifyTag !== "Notified") {
          // 如果驗證失敗，使用替代方法
          const description = event.getDescription() || "";
          const tagMarker = `[${notificationTag}=Notified]`;
          
          if (!description.includes(tagMarker)) {
            event.setDescription(description + "\n" + tagMarker);
            Logger.log(`已使用替代方法設置標記（通過描述）`);
          }
        }
      } catch (tagError) {
        Logger.log(`標記操作失敗：${tagError.message}`);
        // 使用替代方法
        const description = event.getDescription() || "";
        const tagMarker = `[${notificationTag}=Notified]`;
        
        if (!description.includes(tagMarker)) {
          event.setDescription(description + "\n" + tagMarker);
          Logger.log(`已使用替代方法設置標記（通過描述）`);
        }
      }
    } catch (error) {
      Logger.log(`設置標記時發生錯誤：${error.message}`);
      ErrorHandler.handle(error, `設置活動 ${event.getTitle()} 的標記`);
    }
  });
}

/**
 * 格式化群組通知訊息
 */
function formatGroupNotification(groupId, events, dayDescription) {
  // 取得群組名稱
  const groupInfo = getGroupSummary(groupId);
  const groupName = groupInfo ? groupInfo.groupName : "行事曆";
  
  // 組合訊息
  const title = `【${groupName}提醒】\n\n`;
  const message = events.map(formatEventMessage).join("\n\n");
  const footer = `\n\n請家人們留意${dayDescription}活動時間哦！`;
  
  return `${title}${message}${footer}`;
}

/**
 * 發送訊息到特定群組
 */
function sendMessage(to, message) {
  return LineAPI.sendMessage(to, message);
}

/**
 * 格式化事件訊息
 */
function formatEventMessage(event) {
  const startDate = event.getStartTime();
  const endDate = event.getEndTime();
  
  // 檢查是否為多日活動，特別處理全天活動
  // Google Calendar 的全天活動結束時間會設為隔天的 00:00:00，需特別處理
  const isAllDay = event.isAllDayEvent();
  const isEndingAtMidnight = endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0;
  const isSingleDayAllDayEvent = isAllDay && isEndingAtMidnight && 
                                DateUtils.isSameDay(new Date(endDate.getTime() - 1), startDate);
  
  const isMultiDayEvent = !DateUtils.isSameDay(startDate, endDate) && !isSingleDayAllDayEvent;
  
  let message = `活動：${event.getTitle()}\n`;
  
  if (isMultiDayEvent) {
    // 多日活動顯示起訖日期
    const startDateStr = DateUtils.formatDate(startDate, "yyyy 年 MM 月 dd 日");
    const endDateStr = DateUtils.formatDate(endDate, "yyyy 年 MM 月 dd 日");
    const startWeekday = DateUtils.getChineseWeekday(startDate.getDay());
    const endWeekday = DateUtils.getChineseWeekday(endDate.getDay());
    message += `日期：${startDateStr}（${startWeekday}） ~ ${endDateStr}（${endWeekday}）`;
  } else {
    // 單日活動
    const { dateString, timeString } = DateUtils.formatDateWithTime(event);
    message += `日期：${dateString}`;
    if (timeString) {
      message += `\n時間：${timeString}`;
    }
  }
  
  return message;
}

/**
 * 處理 LINE Webhook 事件
 */
function doPost(e) {
  // 設定 CORS 標頭
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 記錄詳細的請求資訊
  Logger.log('=== Webhook 請求開始 ===');
  Logger.log('Content Type: ' + (e.postData ? e.postData.type : 'none'));
  Logger.log('Content Length: ' + (e.postData ? e.postData.length : 0));
  Logger.log('Raw Contents: ' + (e.postData ? e.postData.contents : 'none'));

  try {
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log('無效的請求：缺少必要資料');
      return ContentService.createTextOutput('{}')
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers);
    }

    // 解析事件
    const webhookData = JSON.parse(e.postData.contents);
    Logger.log('解析後的 Webhook 資料：' + JSON.stringify(webhookData));

    if (!webhookData || !webhookData.events || !Array.isArray(webhookData.events)) {
      Logger.log('無效的事件格式');
      return ContentService.createTextOutput('{}')
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers);
    }

    // 處理每個事件
    webhookData.events.forEach(event => {
      Logger.log('處理事件：' + JSON.stringify(event));
      handleEvent(event);
    });

    Logger.log('=== Webhook 請求處理完成 ===');
    
    // 回傳成功響應
    return ContentService.createTextOutput('{}')
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);

  } catch (error) {
    // 記錄詳細錯誤資訊
    Logger.log('=== Webhook 錯誤 ===');
    Logger.log('Error name: ' + error.name);
    Logger.log('Error message: ' + error.message);
    Logger.log('Error stack: ' + error.stack);
    
    // 即使發生錯誤也要回傳 200 狀態碼
    return ContentService.createTextOutput('{}')
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  }
}

/**
 * 處理 OPTIONS 請求（用於 CORS）
 */
function doOptions(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}

/**
 * 用於測試部署狀態
 */
function doGet(e) {
  return ContentService.createTextOutput('{}')
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 處理各種 LINE 事件
 */
function handleEvent(event) {
  try {
    switch (event.type) {
      case 'join':
        handleJoinEvent(event);
        break;
      case 'leave':
        handleLeaveEvent(event);
        break;
      case 'message':
        if (event.message.type === 'text') {
          handleMessageEvent(event);
        }
        break;
    }
  } catch (error) {
    ErrorHandler.handle(error, "handleEvent");
  }
}

/**
 * 處理機器人被加入群組的事件
 */
function handleJoinEvent(event) {
  if (event.source.type === 'group') {
    const groupId = event.source.groupId;
    Logger.log(`Bot 被加入群組：${groupId}`);
    
    // 將群組加入待設定清單
    GroupManager.addPendingGroup(groupId);
    
    // 通知管理者
    const adminUserId = PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
    if (adminUserId) {
      const groupDisplay = formatGroupDisplay(groupId);
      sendMessage(adminUserId, 
        `🔔 新群組加入通知\n` +
        `群組：${groupDisplay}\n` +
        "請使用 /set 指令設定此群組的行事曆。");
    }
  }
}

/**
 * 處理機器人被移出群組的事件
 */
function handleLeaveEvent(event) {
  if (event.source.type === 'group') {
    const groupId = event.source.groupId;
    const groupDisplay = formatGroupDisplay(groupId);
    
    GroupManager.removeMapping(groupId);
    GroupManager.removePendingGroup(groupId);
    Logger.log(`Bot 被移出群組：${groupId}，已移除相關設定`);
    
    // 通知管理者
    const adminUserId = PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
    if (adminUserId) {
      sendMessage(adminUserId, 
        `⚠️ Bot 已被移出群組\n` +
        `群組：${groupDisplay}\n` +
        "已自動清除相關設定。");
    }
  }
}

/**
 * 處理訊息事件
 */
function handleMessageEvent(event) {
  const adminUserId = PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
  
  // 只處理來自管理者的訊息
  if (event.source.userId === adminUserId) {
    const message = event.message.text.trim();
    const command = message.split(' ')[0].toLowerCase();
    
    switch (command) {
      case CONSTANTS.ADMIN_COMMANDS.HELP:
        handleHelpCommand(event);
        break;
      case CONSTANTS.ADMIN_COMMANDS.SET:
        handleSetCommand(event);
        break;
      case CONSTANTS.ADMIN_COMMANDS.LIST:
        handleListCommand(event);
        break;
      case CONSTANTS.ADMIN_COMMANDS.REMOVE:
        handleRemoveCommand(event);
        break;
      case CONSTANTS.ADMIN_COMMANDS.PENDING:
        handlePendingCommand(event);
        break;
    }
  }
}

/**
 * 處理 /help 指令
 */
function handleHelpCommand(event) {
  const helpMessage = 
    "📝 管理者指令說明：\n\n" +
    "1️⃣ 設定群組行事曆：\n" +
    "/set [群組ID] [行事曆ID]\n\n" +
    "2️⃣ 查看所有設定：\n" +
    "/list\n\n" +
    "3️⃣ 移除群組設定：\n" +
    "/remove [群組ID]\n\n" +
    "4️⃣ 查看待設定群組：\n" +
    "/pending\n\n" +
    "5️⃣ 顯示此說明：\n" +
    "/help";
  
  replyToEvent(event, helpMessage);
}

/**
 * 處理 /set 指令
 */
function handleSetCommand(event) {
  const parts = event.message.text.split(' ');
  if (parts.length !== 3) {
    replyToEvent(event, "❌ 格式錯誤！正確格式：/set [群組ID] [行事曆ID]");
    return;
  }
  
  const [_, groupId, calendarId] = parts;
  
  try {
    // 驗證行事曆 ID
    try {
      CalendarApp.getCalendarById(calendarId);
    } catch (e) {
      throw new Error('無效的行事曆 ID，請確認行事曆存在且您有存取權限。');
    }
    
    GroupManager.addMapping(groupId, calendarId);
    replyToEvent(event, `✅ 設定成功！\n群組：${groupId}\n行事曆：${calendarId}`);
  } catch (error) {
    replyToEvent(event, `❌ 設定失敗：${error.message}`);
  }
}

/**
 * 處理 /list 指令
 */
function handleListCommand(event) {
  const mappings = GroupManager.getAllMappings();
  const count = Object.keys(mappings).length;
  
  if (count === 0) {
    replyToEvent(event, "📝 目前沒有任何群組設定。");
    return;
  }
  
  let message = `📝 目前共有 ${count} 個群組設定：\n\n`;
  for (const [groupId, calendarId] of Object.entries(mappings)) {
    const groupDisplay = formatGroupDisplay(groupId);
    message += `群組：${groupDisplay}\n行事曆：${calendarId}\n\n`;
  }
  
  replyToEvent(event, message.trim());
}

/**
 * 處理 /remove 指令
 */
function handleRemoveCommand(event) {
  const parts = event.message.text.split(' ');
  if (parts.length !== 2) {
    replyToEvent(event, "❌ 格式錯誤！正確格式：/remove [群組ID]");
    return;
  }
  
  const [_, groupId] = parts;
  
  if (!GroupManager.getCalendarId(groupId)) {
    replyToEvent(event, "❌ 找不到此群組的設定！");
    return;
  }
  
  const groupDisplay = formatGroupDisplay(groupId);
  GroupManager.removeMapping(groupId);
  replyToEvent(event, `✅ 已移除群組設定：${groupDisplay}`);
}

/**
 * 處理 /pending 指令
 */
function handlePendingCommand(event) {
  const pendingGroups = GroupManager.getPendingGroups();
  
  if (pendingGroups.length === 0) {
    replyToEvent(event, "📝 目前沒有待設定的群組。");
    return;
  }
  
  let message = `📝 待設定群組清單：\n\n`;
  pendingGroups.forEach((groupId, index) => {
    const groupDisplay = formatGroupDisplay(groupId);
    message += `${index + 1}. ${groupDisplay}\n`;
  });
  
  replyToEvent(event, message.trim());
}

/**
 * 回覆訊息給使用者
 */
function replyToEvent(event, message) {
  return LineAPI.replyMessage(event.replyToken, message);
}

/**
 * 格式化群組顯示
 */
function formatGroupDisplay(groupId) {
  const groupInfo = getGroupSummary(groupId);
  return groupInfo ? groupInfo.groupName : groupId;
}

/**
 * 取得群組摘要
 */
function getGroupSummary(groupId) {
  return LineAPI.getGroupSummary(groupId);
}

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
  },
  
  isSameDay: function(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  },
  
  /**
   * 檢查日期是否在指定的時間範圍內
   */
  isInTimeRange: function(date, targetHour) {
    const hour = date.getHours();
    return hour === targetHour;
  }
};

// 錯誤處理器
const ErrorHandler = {
  handle: function(error, functionName) {
    const errorMessage = `錯誤發生在 ${functionName}: ${error.name} - ${error.message}`;
    Logger.log(errorMessage);
    
    // 如果設定了管理者 ID，發送錯誤通知
    const adminUserId = PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
    if (adminUserId) {
      try {
        sendMessage(adminUserId, `⚠️ 系統錯誤通知：\n${errorMessage}`);
      } catch (e) {
        Logger.log(`無法發送錯誤通知給管理者：${e.message}`);
      }
    }
  },
  
  /**
   * 記錄詳細的錯誤資訊
   */
  logDetailed: function(error, context = {}) {
    const errorDetail = {
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: context
    };
    
    Logger.log('詳細錯誤資訊：' + JSON.stringify(errorDetail, null, 2));
    return errorDetail;
  }
};

// 添加管理者通知輔助函數
function notifyAdmin(title, detail) {
  const adminUserId = PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
  if (!adminUserId) return;
  
  const message = `⚠️ ${title}\n${JSON.stringify(detail, null, 2)}`;
  sendMessage(adminUserId, message);
}

/**
 * LINE API 相關功能
 */
const LineAPI = {
  /**
   * 發送訊息到特定群組或用戶
   */
  sendMessage: function(to, message) {
    if (message.trim() === "") return;
    
    const channelAccessToken = PropertiesService.getScriptProperties()
      .getProperty('CHANNEL_ACCESS_TOKEN');
      
    const payload = {
      to: to,
      messages: [{
        type: "text",
        text: message
      }]
    };
    
    const options = {
      method: 'post',
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken}`
      },
      payload: JSON.stringify(payload)
    };
    
    try {
      const response = UrlFetchApp.fetch(CONSTANTS.LINE_API.ENDPOINT, options);
      if (response.getResponseCode() === 200) {
        Logger.log(`訊息發送成功到 ${to}`);
        return true;
      } else {
        throw new Error(`發送失敗：${response.getContentText()}`);
      }
    } catch (error) {
      ErrorHandler.handle(error, "sendMessage");
      return false;
    }
  },
  
  /**
   * 回覆訊息
   */
  replyMessage: function(replyToken, message) {
    const channelAccessToken = PropertiesService.getScriptProperties()
      .getProperty('CHANNEL_ACCESS_TOKEN');
      
    const payload = {
      replyToken: replyToken,
      messages: [{
        type: "text",
        text: message
      }]
    };
    
    const options = {
      method: 'post',
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken}`
      },
      payload: JSON.stringify(payload)
    };
    
    try {
      const response = UrlFetchApp.fetch(CONSTANTS.LINE_API.REPLY, options);
      if (response.getResponseCode() === 200) {
        Logger.log('回覆訊息發送成功');
        return true;
      } else {
        throw new Error(`回覆失敗：${response.getContentText()}`);
      }
    } catch (error) {
      ErrorHandler.handle(error, "replyMessage");
      return false;
    }
  },
  
  /**
   * 取得群組摘要
   */
  getGroupSummary: function(groupId) {
    const channelAccessToken = PropertiesService.getScriptProperties()
      .getProperty('CHANNEL_ACCESS_TOKEN');
      
    const url = Utilities.formatString(CONSTANTS.LINE_API.GROUP_SUMMARY, groupId);
    const options = {
      method: 'get',
      headers: { 
        "Authorization": `Bearer ${channelAccessToken}`
      }
    };
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        return JSON.parse(response.getContentText());
      }
    } catch (error) {
      ErrorHandler.handle(error, "getGroupSummary");
    }
    
    return null;
  }
};

/**
 * 測試功能
 */
const TestUtils = {
  /**
   * 測試設定和權限
   */
  testWebhookSetup: function() {
    Logger.log('=== 開始測試設定 ===');
    
    // 1. 測試腳本屬性
    const scriptProperties = PropertiesService.getScriptProperties();
    const requiredProps = {
      'CHANNEL_ACCESS_TOKEN': '頻道存取權杖',
      'ADMIN_USER_ID': '管理者 ID',
      'NOTIFICATION_HOUR_MORNING': '早上通知時間',
      'NOTIFICATION_HOUR_EVENING': '晚上通知時間'
    };
    
    Logger.log('檢查必要的腳本屬性：');
    Object.entries(requiredProps).forEach(([key, description]) => {
      const value = scriptProperties.getProperty(key);
      Logger.log(`- ${description}：${value ? '已設定' : '未設定'}`);
    });
    
    // 2. 測試 LINE API 連線
    try {
      const testUrl = 'https://api.line.me/v2/bot/info';
      const options = {
        method: 'get',
        headers: {
          'Authorization': `Bearer ${scriptProperties.getProperty('CHANNEL_ACCESS_TOKEN')}`
        }
      };
      
      Logger.log('\n測試 LINE API 連線：');
      const response = UrlFetchApp.fetch(testUrl, options);
      Logger.log(`- API 回應狀態：${response.getResponseCode()}`);
      Logger.log(`- API 回應內容：${response.getContentText()}`);
      
    } catch (error) {
      Logger.log(`- LINE API 錯誤：${error.message}`);
    }
    
    // 3. 測試部署資訊
    const deploymentId = ScriptApp.getService().getUrl();
    Logger.log('\n部署資訊：');
    Logger.log(`- 部署 URL：${deploymentId}`);
    
    Logger.log('\n=== 測試完成 ===');
  },
  
  /**
   * 測試通知功能
   */
  testNotification: function() {
    Logger.log('=== 開始測試通知功能 ===');
    
    // 1. 檢查群組設定
    const groupMappings = GroupManager.getAllMappings();
    Logger.log('群組設定：' + JSON.stringify(groupMappings, null, 2));
    
    if (Object.keys(groupMappings).length === 0) {
      Logger.log('錯誤：沒有設定任何群組！');
      return;
    }
    
    // 2. 測試時間設定
    const now = new Date();
    Logger.log('當前時間：' + now.toISOString());
    Logger.log('時區：' + now.getTimezoneOffset());
    
    // 3. 強制執行今天的通知
    Logger.log('開始執行今天的通知...');
    try {
      const results = notifyAllGroups(now, "今天");
      Logger.log('通知結果：' + JSON.stringify(results, null, 2));
    } catch (error) {
      Logger.log('通知執行錯誤：' + error.message);
      Logger.log('錯誤堆疊：' + error.stack);
    }
    
    Logger.log('=== 測試完成 ===');
  },
  
  /**
   * 測試特定群組的通知
   */
  testGroupNotification: function(groupId) {
    Logger.log('=== 開始測試特定群組通知 ===');
    
    // 1. 檢查群組設定
    const calendarId = GroupManager.getCalendarId(groupId);
    Logger.log(`群組 ID：${groupId}`);
    Logger.log(`行事曆 ID：${calendarId}`);
    
    if (!calendarId) {
      Logger.log('錯誤：找不到此群組的行事曆設定！');
      return;
    }
    
    // 2. 測試時間設定
    const now = new Date();
    
    // 3. 執行通知
    Logger.log('開始執行群組通知...');
    try {
      const result = notifyGroupEvents(groupId, calendarId, now, "今天");
      Logger.log('通知結果：' + JSON.stringify(result, null, 2));
    } catch (error) {
      Logger.log('通知執行錯誤：' + error.message);
      Logger.log('錯誤堆疊：' + error.stack);
    }
    
    Logger.log('=== 測試完成 ===');
  }
};

// 更新全域函數以使用新的物件
function sendMessage(to, message) {
  return LineAPI.sendMessage(to, message);
}

function replyToEvent(event, message) {
  return LineAPI.replyMessage(event.replyToken, message);
}

function getGroupSummary(groupId) {
  return LineAPI.getGroupSummary(groupId);
}

function testWebhookSetup() {
  return TestUtils.testWebhookSetup();
}

function testNotification() {
  return TestUtils.testNotification();
}

function testGroupNotification(groupId) {
  return TestUtils.testGroupNotification(groupId);
}
