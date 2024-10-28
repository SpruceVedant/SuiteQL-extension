chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRIPT_RESULT') {
        const result = message.result;
        chrome.windows.create({
            url: chrome.runtime.getURL('results.html'),
            type: 'popup',
            width: 600,
            height: 400
        }, function(window) {
            const newTabId = window.tabs[0].id;
            resultsinnewTab(newTabId);

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === newTabId && info.status === 'complete') {
                    console.log('Sending message to the results window'); 
                    chrome.tabs.sendMessage(newTabId, { type: 'DISPLAY_RESULT', result: result });
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
            function resultsinnewTab() {
                 url: chrome.runtime.getURL('results.html'),
            }
        });
    }
});
