(function() {
    // Check if running in Firefox (has browser namespace)
    const isFirefox = typeof browser !== 'undefined';
    
    // Create a namespace for our compatibility layer
    window.browserAPI = {};
    
    // Runtime API
    browserAPI.runtime = {
        sendMessage: function(message) {
            if (isFirefox) {
                return browser.runtime.sendMessage(message);
            } else {
                return chrome.runtime.sendMessage(message);
            }
        },
        onMessage: {
            addListener: function(callback) {
                if (isFirefox) {
                    browser.runtime.onMessage.addListener((message, sender) => {
                        callback(message, sender, (response) => {
                            return Promise.resolve(response);
                        });
                        return true;
                    });
                } else {
                    chrome.runtime.onMessage.addListener(callback);
                }
            }
        }
    };
    
    // Tabs API
    browserAPI.tabs = {
        query: function(queryInfo) {
            if (isFirefox) {
                return browser.tabs.query(queryInfo);
            } else {
                return chrome.tabs.query(queryInfo);
            }
        },
        sendMessage: function(tabId, message) {
            if (isFirefox) {
                return browser.tabs.sendMessage(tabId, message);
            } else {
                return chrome.tabs.sendMessage(tabId, message);
            }
        }
    };
    
    // Alarms API
    browserAPI.alarms = {
        create: function(name, alarmInfo) {
            if (isFirefox) {
                return browser.alarms.create(name, alarmInfo);
            } else {
                return chrome.alarms.create(name, alarmInfo);
            }
        },
        clear: function(name) {
            if (isFirefox) {
                return browser.alarms.clear(name);
            } else {
                return chrome.alarms.clear(name);
            }
        },
        onAlarm: {
            addListener: function(callback) {
                if (isFirefox) {
                    browser.alarms.onAlarm.addListener(callback);
                } else {
                    chrome.alarms.onAlarm.addListener(callback);
                }
            }
        }
    };
    
    // Local Storage API
    browserAPI.storage = {
        local: {
            get: function(keys) {
                if (isFirefox) {
                    return browser.storage.local.get(keys);
                } else {
                    return new Promise((resolve) => {
                        chrome.storage.local.get(keys, (result) => {
                            resolve(result);
                        });
                    });
                }
            },
            set: function(items) {
                if (isFirefox) {
                    return browser.storage.local.set(items);
                } else {
                    return new Promise((resolve) => {
                        chrome.storage.local.set(items, () => {
                            resolve();
                        });
                    });
                }
            }
        }
    };
})(); 