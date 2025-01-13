let lastCheckedTime = {};
let redirecting = {};
let skipNextCheck = new Set();

// 监听导航事件
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {  // 只检查主框架
    const tabId = details.tabId;
    const url = details.url;
    checkAndRedirectIfNeeded(tabId, url);
  }
});

// 检查是否需要重定向
function checkAndRedirectIfNeeded(tabId, url) {
  const currentTime = Date.now();
  
  // 检查是否最近已经检查过
  if (lastCheckedTime[url] && (currentTime - lastCheckedTime[url] < 10000)) {
    console.log('跳过检查，最近已检查过:', url);
    return;
  }
  
  // 检查是否需要跳过（刚刚重定向过）
  if (skipNextCheck.has(tabId)) {
    console.log('跳过重定向后的检查，标签页:', tabId);
    skipNextCheck.delete(tabId);
    return;
  }
  
  // 检查是否正在重定向
  if (redirecting[tabId]) {
    console.log('标签页正在重定向中:', tabId);
    return;
  }
  
  lastCheckedTime[url] = currentTime;
  
  // 获取配置并检查
  chrome.storage.sync.get(['siteConfigs', 'globalSwitchEnabled'], function(data) {
    if (data.globalSwitchEnabled === false) {
      console.log('全局开关已关闭，跳过重定向');
      return;
    }

    const configs = (data.siteConfigs || []).filter(config => 
      config.name && config.intranet && config.internet
    );
    
    console.log('已加载配置:', configs);
    
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      console.log('当前标签页 URL:', parsedUrl.href);
    } catch (error) {
      console.error('解析标签页 URL 出错:', error, url);
      return;
    }
    
    // 查找匹配的配置
    let matchedConfig = configs.find(config => {
      try {
        return parsedUrl.hostname === new URL(config.internet).hostname;
      } catch (error) {
        console.error('解析配置 URL 出错:', error, config);
        return false;
      }
    });
    
    if (matchedConfig) {
      console.log('找到匹配配置:', matchedConfig);
      checkAndRedirect(tabId, matchedConfig.intranet, matchedConfig.internet, url);
    } else {
      console.log('未找到匹配配置');
    }
  });
}

// 检查可访问性并重定向
function checkAndRedirect(tabId, primaryUrl, fallbackUrl, originalUrl) {
  console.log('检查主要URL:', primaryUrl);
  redirecting[tabId] = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时

  fetch(primaryUrl, { 
    mode: 'no-cors', 
    cache: 'no-store',
    signal: controller.signal
  })
    .then(() => {
      clearTimeout(timeoutId);
      console.log('内网地址可访问:', primaryUrl);
      if (originalUrl !== primaryUrl) {
        chrome.tabs.update(tabId, { url: primaryUrl });
        skipNextCheck.add(tabId);
        
        // 显示通知
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: chrome.i18n.getMessage('extensionName'),
          message: chrome.i18n.getMessage('redirectNotification')
        });
      } else {
        console.log('已经在内网地址，无需重定向');
      }
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      console.log('访问内网地址出错:', primaryUrl, error);
      console.log('保持在当前地址:', originalUrl);
    })
    .finally(() => {
      redirecting[tabId] = false;
    });
}

// 清理无效配置
function cleanConfigs() {
  chrome.storage.sync.get('siteConfigs', function(data) {
    const configs = data.siteConfigs || [];
    const validConfigs = configs.filter(config => 
      config && config.name && config.intranet && config.internet
    );
    
    if (validConfigs.length !== configs.length) {
      chrome.storage.sync.set({ siteConfigs: validConfigs });
    }
  });
}

// 插件启动时运行配置清理
chrome.runtime.onStartup.addListener(cleanConfigs);

// 监听标签页关闭事件，清理数据
chrome.tabs.onRemoved.addListener((tabId) => {
  skipNextCheck.delete(tabId);
  delete redirecting[tabId];
});
