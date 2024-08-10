function getSettings(callback) {
    chrome.storage.sync.get(['dynamicFields'], function(data) {
      const dynamicFields = data.dynamicFields ? JSON.parse(data.dynamicFields) : [];
      callback(dynamicFields);
    });
  }
  
  // Main initialization function
  function init() {
    getSettings(function(dynamicFields) {
      let targetSelector = '';
  
      // Loop through dynamic fields and match against the current URL
      for (const field of dynamicFields) {
        if (window.location.href.includes(field.url)) {
          targetSelector = field.selector;
          break;
        }
      }
  
      const targetElement = targetSelector ? document.querySelector(targetSelector) : undefined;
      const content = targetElement ? targetElement.textContent : '';
      const title = document.title;
      const url = window.location.href;
  
      chrome.runtime.sendMessage({ setTabValue: { content, title, url } });
      
    });
  }
  
  // Run the init function on script load
  init();