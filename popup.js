document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded');
  try {
    console.log('Loading i18n messages...');
    // 测试国际化 API 是否可用
    console.log('i18n API available:', !!chrome.i18n);
    console.log('Current locale:', chrome.i18n.getUILanguage());
    
    loadI18nMessages();
    loadConfigs();
    setupEventListeners();
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

// 加载国际化消息
function loadI18nMessages() {
  try {
    // 获取所有需要设置文本的元素
    const enableAutoSwitch = document.getElementById('enableAutoSwitch');
    const addConfigBtn = document.getElementById('addConfig');
    const exportConfigBtn = document.getElementById('exportConfig');
    const importConfigBtn = document.getElementById('importConfig');
    
    console.log('Elements found:', {
      enableAutoSwitch: !!enableAutoSwitch,
      addConfigBtn: !!addConfigBtn,
      exportConfigBtn: !!exportConfigBtn,
      importConfigBtn: !!importConfigBtn
    });
    
    // 获取国际化消息
    const messages = {
      enableAutoSwitch: chrome.i18n.getMessage('enableAutoSwitch'),
      addConfig: chrome.i18n.getMessage('addConfig'),
      exportConfig: chrome.i18n.getMessage('exportConfig'),
      importConfig: chrome.i18n.getMessage('importConfig')
    };
    console.log('i18n messages:', messages);
    
    // 设置文本
    if (enableAutoSwitch) enableAutoSwitch.textContent = messages.enableAutoSwitch;
    if (addConfigBtn) addConfigBtn.textContent = messages.addConfig;
    if (exportConfigBtn) exportConfigBtn.textContent = messages.exportConfig;
    if (importConfigBtn) importConfigBtn.textContent = messages.importConfig;
  } catch (error) {
    console.error('Error in loadI18nMessages:', error);
  }
}

// 加载配置
function loadConfigs() {
  chrome.storage.sync.get(['globalSwitchEnabled', 'siteConfigs'], function(data) {
    document.getElementById('globalSwitch').checked = data.globalSwitchEnabled !== false;
    
    const configList = document.getElementById('configList');
    configList.innerHTML = '';
    
    const configs = data.siteConfigs || [];
    configs.forEach((config, index) => {
      configList.appendChild(createConfigElement(config, index));
    });
  });
}

// 创建配置项元素
function createConfigElement(config, index) {
  const configElement = document.createElement('div');
  configElement.className = 'config-item';
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = chrome.i18n.getMessage('configNamePlaceholder');
  nameInput.value = config.name || '';
  nameInput.className = 'name-input';
  
  const intranetInput = document.createElement('input');
  intranetInput.type = 'text';
  intranetInput.placeholder = chrome.i18n.getMessage('intranetUrlPlaceholder');
  intranetInput.value = config.intranetUrl || '';
  intranetInput.className = 'intranet';
  
  const internetInput = document.createElement('input');
  internetInput.type = 'text';
  internetInput.placeholder = chrome.i18n.getMessage('internetUrlPlaceholder');
  internetInput.value = config.internetUrl || '';
  internetInput.className = 'internet';
  
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'config-actions';
  
  const checkButton = document.createElement('button');
  checkButton.className = 'button check-status';
  checkButton.textContent = chrome.i18n.getMessage('checkStatus');
  
  const deleteButton = document.createElement('button');
  deleteButton.className = 'button delete';
  deleteButton.textContent = chrome.i18n.getMessage('delete');
  
  const intranetStatus = document.createElement('span');
  intranetStatus.className = 'status-indicator';
  intranetStatus.dataset.type = 'intranet';
  
  const internetStatus = document.createElement('span');
  internetStatus.className = 'status-indicator';
  internetStatus.dataset.type = 'internet';
  
  const statusContainer = document.createElement('div');
  statusContainer.className = 'status-container';
  statusContainer.appendChild(intranetStatus);
  statusContainer.appendChild(internetStatus);
  
  configElement.appendChild(nameInput);
  configElement.appendChild(intranetInput);
  configElement.appendChild(internetInput);
  configElement.appendChild(actionsDiv);
  configElement.appendChild(statusContainer);
  
  actionsDiv.appendChild(checkButton);
  actionsDiv.appendChild(deleteButton);
  
  setupConfigItemListeners(configElement, index);
  
  return configElement;
}

// URL 自动检测
async function detectUrlPattern(url) {
  try {
    const parsedUrl = new URL(url);
    // 检测常见的内外网对应模式
    const patterns = [
      { from: 'github.com', to: 'github.internal.com' },
      { from: '.com', to: '.internal' },
      { from: '.cn', to: '.internal' },
      { from: 'www.', to: 'internal.' }
    ];

    for (const pattern of patterns) {
      if (parsedUrl.hostname.includes(pattern.from)) {
        const internalUrl = url.replace(pattern.from, pattern.to);
        return { internet: url, intranet: internalUrl };
      }
    }
  } catch (error) {
    console.error('URL parsing error:', error);
  }
  return null;
}

// 设置配置项的事件监听器
function setupConfigItemListeners(configElement, index) {
  const checkButton = configElement.querySelector('.check-status');
  const deleteButton = configElement.querySelector('.delete');
  const intranetInput = configElement.querySelector('.intranet');
  const internetInput = configElement.querySelector('.internet');
  const nameInput = configElement.querySelector('.name-input');

  // 检查状态按钮点击事件
  checkButton.addEventListener('click', async () => {
    const intranetStatus = configElement.querySelector('[data-type="intranet"]');
    const internetStatus = configElement.querySelector('[data-type="internet"]');
    
    // 设置状态为检查中
    intranetStatus.className = 'status-indicator status-loading';
    internetStatus.className = 'status-indicator status-loading';
    
    try {
      // 检查内网地址
      const intranetResult = await checkUrl(intranetInput.value);
      intranetStatus.className = `status-indicator status-${intranetResult ? 'success' : 'error'}`;
      
      // 检查外网地址
      const internetResult = await checkUrl(internetInput.value);
      internetStatus.className = `status-indicator status-${internetResult ? 'success' : 'error'}`;
    } catch (error) {
      console.error('检查URL状态时出错:', error);
      intranetStatus.className = 'status-indicator status-error';
      internetStatus.className = 'status-indicator status-error';
    }
  });

  // 删除按钮点击事件
  deleteButton.addEventListener('click', () => {
    configElement.remove();
    saveConfigs();
  });

  // 输入框变化事件
  [nameInput, intranetInput, internetInput].forEach(input => {
    input.addEventListener('change', saveConfigs);
  });
}

// 检查单个URL
async function checkUrl(url) {
  if (!url) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}

// 保存配置
function saveConfigs() {
  const configs = [];
  document.querySelectorAll('.config-item').forEach(item => {
    configs.push({
      name: item.querySelector('.name-input').value,
      intranetUrl: item.querySelector('.intranet').value,
      internetUrl: item.querySelector('.internet').value
    });
  });

  chrome.storage.sync.set({
    globalSwitchEnabled: document.getElementById('globalSwitch').checked,
    siteConfigs: configs
  });
}

// 设置全局事件监听器
function setupEventListeners() {
  document.getElementById('globalSwitch').addEventListener('change', function(e) {
    chrome.storage.sync.set({globalSwitchEnabled: e.target.checked});
  });
  
  document.getElementById('addConfig').addEventListener('click', function() {
    const configList = document.getElementById('configList');
    const newConfig = { name: '', intranetUrl: '', internetUrl: '' };
    const configElement = createConfigElement(newConfig, configList.children.length);
    configList.appendChild(configElement);
    saveConfigs();
  });

  // Export configuration
  document.getElementById('exportConfig').addEventListener('click', function() {
    chrome.storage.sync.get(['globalSwitchEnabled', 'siteConfigs'], function(data) {
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        globalSwitchEnabled: data.globalSwitchEnabled,
        siteConfigs: data.siteConfigs || []
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'url-switcher-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  // Import configuration
  document.getElementById('importConfig').addEventListener('click', function() {
    document.getElementById('importInput').click();
  });

  document.getElementById('importInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importData = JSON.parse(e.target.result);
        if (!importData.version || !importData.siteConfigs) {
          throw new Error('Invalid configuration file');
        }

        chrome.storage.sync.set({
          globalSwitchEnabled: importData.globalSwitchEnabled,
          siteConfigs: importData.siteConfigs
        }, function() {
          // Reload the popup to show new configurations
          loadConfigs();
          // Reset the file input
          e.target.value = '';
        });
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import configuration. Please check if the file is valid.');
      }
    };
    reader.readAsText(file);
  });
}
