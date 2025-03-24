let accountId = '';

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


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ACCOUNT_ID') {
        accountId = message.accountId;
        console.log("Account ID stored in background script:", accountId);
        sendResponse({ status: 'Account ID saved' });
    }
    else if (message.type === 'GET_ACCOUNT_ID') {
        sendResponse({ accountId });
    }else if (message.type === 'SCRIPT_RESULT') {
        console.log('Script result received in background:', message.result);

        // Optionally, send the result back to the popup to display it
        chrome.runtime.sendMessage({ type: 'DISPLAY_RESULT', result: message.result });
    }
});
