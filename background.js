chrome.runtime.onInstalled.addListener(() => {
    console.log('Background script running.');

    chrome.webNavigation.onCompleted.addListener(details => {
        if (details.url.includes("netsuite.com")) {
            console.log('Navigated to a NetSuite page.');

            chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                files: ['content.js']
            });
        }
    }, { url: [{ urlMatches: 'https://*.netsuite.com/*' }] });
});
