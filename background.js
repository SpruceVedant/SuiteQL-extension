let accountId = '';
const rememberedPanelTabs = new Set();

function isNetSuiteUrl(url = '') {
    return /^https:\/\/([^.]+\.)*(app\.)?netsuite\.com\//i.test(url);
}

async function configureSidePanelBehavior() {
    try {
        await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: true
        });
    } catch (error) {
        console.error('Failed to configure side panel behavior.', error);
    }
}

configureSidePanelBehavior();

chrome.runtime.onInstalled.addListener(() => {
    configureSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
    configureSidePanelBehavior();
});

async function syncTabSidePanel(tabId, url) {
    if (!tabId) {
        return;
    }

    try {
        await chrome.sidePanel.setOptions({
            tabId,
            path: 'popup.html',
            enabled: isNetSuiteUrl(url || '')
        });
    } catch (error) {
        console.error('Failed to sync side panel for tab.', error);
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.url || '';
    if (!url) {
        return;
    }

    syncTabSidePanel(tabId, url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        await syncTabSidePanel(tabId, tab.url || '');

        if (!tab.windowId) {
            return;
        }

        if (!isNetSuiteUrl(tab.url || '')) {
            await chrome.sidePanel.close({ windowId: tab.windowId });
            return;
        }

        if (rememberedPanelTabs.has(tabId)) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        }
    } catch (error) {
        console.error('Failed to update side panel on tab activation.', error);
    }
});

async function initializeExistingTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        await Promise.all(
            tabs
                .filter((tab) => tab.id)
                .map((tab) => syncTabSidePanel(tab.id, tab.url || ''))
        );
    } catch (error) {
        console.error('Failed to initialize side panel state for existing tabs.', error);
    }
}

initializeExistingTabs();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SIDE_PANEL_OPENED') {
        if (message.tabId && isNetSuiteUrl(message.url || '')) {
            rememberedPanelTabs.add(message.tabId);
        }
        sendResponse({ status: 'Side panel tab remembered' });
        return;
    }

    if (message.type === 'ACCOUNT_ID') {
        accountId = message.accountId;
        console.log('Account ID stored in background script:', accountId);
        sendResponse({ status: 'Account ID saved' });
        return;
    }

    if (message.type === 'GET_ACCOUNT_ID') {
        sendResponse({ accountId });
        return;
    }

    if (message.type === 'SCRIPT_RESULT') {
        console.log('Script result received in background:', message.result);
        chrome.runtime.sendMessage({ type: 'DISPLAY_RESULT', result: message.result });
    }
});
