let accountId = '';
const rememberedPanelTabs = new Set();
const REMEMBERED_PANEL_TABS_KEY = 'rememberedSidePanelTabs';

function getPanelTabStorageArea() {
    return chrome.storage.session || chrome.storage.local;
}

async function persistRememberedPanelTabs() {
    try {
        await getPanelTabStorageArea().set({
            [REMEMBERED_PANEL_TABS_KEY]: Array.from(rememberedPanelTabs)
        });
    } catch (error) {
        console.error('Failed to persist remembered side panel tabs.', error);
    }
}

async function loadRememberedPanelTabs() {
    try {
        const stored = await getPanelTabStorageArea().get(REMEMBERED_PANEL_TABS_KEY);
        const tabIds = stored?.[REMEMBERED_PANEL_TABS_KEY];
        if (!Array.isArray(tabIds)) {
            return;
        }

        rememberedPanelTabs.clear();
        tabIds.forEach((tabId) => {
            if (Number.isInteger(tabId)) {
                rememberedPanelTabs.add(tabId);
            }
        });
    } catch (error) {
        console.error('Failed to load remembered side panel tabs.', error);
    }
}

async function rememberPanelTab(tabId) {
    if (!Number.isInteger(tabId)) {
        return;
    }

    rememberedPanelTabs.add(tabId);
    await persistRememberedPanelTabs();
}

async function forgetPanelTab(tabId) {
    if (!Number.isInteger(tabId)) {
        return;
    }

    if (rememberedPanelTabs.delete(tabId)) {
        await persistRememberedPanelTabs();
    }
}

async function isRememberedPanelTab(tabId) {
    if (!Number.isInteger(tabId)) {
        return false;
    }

    if (rememberedPanelTabs.has(tabId)) {
        return true;
    }

    await loadRememberedPanelTabs();
    return rememberedPanelTabs.has(tabId);
}

function isNetSuiteUrl(url = '') {
    return /^https:\/\/([^.]+\.)*(app\.)?netsuite\.com\//i.test(url);
}

function isSuitesenseResultsUrl(url = '') {
    return new RegExp(`^chrome-extension://${chrome.runtime.id}/(?:results|hresults)\\.html(?:\\?|#|$)`, 'i').test(url);
}

function isSupportedSidePanelUrl(url = '') {
    return isNetSuiteUrl(url) || isSuitesenseResultsUrl(url);
}

async function configureSidePanelBehavior() {
    try {
        await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: false
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

async function openSuitesenseForTab(tab) {
    try {
        if (!tab || !tab.id || !tab.windowId) {
            return;
        }

        const url = tab.url || '';

        if (!isSupportedSidePanelUrl(url)) {
            await chrome.sidePanel.close({ windowId: tab.windowId });
            return;
        }

        if (rememberedPanelTabs.has(tab.id)) {
            await forgetPanelTab(tab.id);
            await syncTabSidePanelState(tab.id, false);
            await chrome.sidePanel.close({ windowId: tab.windowId });
            return;
        }

        await chrome.sidePanel.open({ windowId: tab.windowId });
        syncTabSidePanelState(tab.id, true);
        rememberedPanelTabs.clear();
        rememberedPanelTabs.add(tab.id);
        await persistRememberedPanelTabs();
    } catch (error) {
        console.error('Failed to open Suitesense side panel.', error);
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    await openSuitesenseForTab(tab);
});

async function syncTabSidePanel(tabId, url) {
    return syncTabSidePanelState(tabId, isSupportedSidePanelUrl(url || ''));
}

async function syncTabSidePanelState(tabId, enabled) {
    if (!tabId) {
        return;
    }

    try {
        await chrome.sidePanel.setOptions({
            tabId,
            enabled
        });
    } catch (error) {
        console.error('Failed to sync side panel for tab.', error);
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url && changeInfo.status !== 'complete') {
        return;
    }

    const url = changeInfo.url || tab.url || '';
    if (!url) {
        return;
    }

    syncTabSidePanel(tabId, url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        const supported = isSupportedSidePanelUrl(tab.url || '');
        const remembered = supported && (await isRememberedPanelTab(tabId));
        await syncTabSidePanelState(tabId, remembered);

        if (!tab.windowId) {
            return;
        }

        if (remembered) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            return;
        }

        await chrome.sidePanel.close({ windowId: tab.windowId });
    } catch (error) {
        console.error('Failed to update side panel on tab activation.', error);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    forgetPanelTab(tabId);
});

async function initializeExistingTabs() {
    try {
        await loadRememberedPanelTabs();
        const tabs = await chrome.tabs.query({});
        const existingTabIds = new Set(tabs.map((tab) => tab.id).filter((tabId) => Number.isInteger(tabId)));

        Array.from(rememberedPanelTabs).forEach((tabId) => {
            if (!existingTabIds.has(tabId)) {
                rememberedPanelTabs.delete(tabId);
            }
        });

        await persistRememberedPanelTabs();

        await Promise.all(
            tabs
                .filter((tab) => tab.id)
                .map(async (tab) => {
                    const supported = isSupportedSidePanelUrl(tab.url || '');
                    const remembered = supported && rememberedPanelTabs.has(tab.id);
                    await syncTabSidePanelState(tab.id, remembered);
                })
        );
    } catch (error) {
        console.error('Failed to initialize side panel state for existing tabs.', error);
    }
}

initializeExistingTabs();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab && sender.tab.id && sender.tab.url) {
        syncTabSidePanel(sender.tab.id, sender.tab.url);
    }

    if (message.type === 'SIDE_PANEL_OPENED') {
        if (message.tabId && isSupportedSidePanelUrl(message.url || '')) {
            rememberPanelTab(message.tabId);
        }
        sendResponse({ status: 'Side panel tab remembered' });
        return;
    }

    if (message.type === 'REMEMBER_SIDE_PANEL_TAB') {
        if (message.tabId && isSupportedSidePanelUrl(message.url || '')) {
            syncTabSidePanel(message.tabId, message.url || '');
        }
        sendResponse({ status: 'Remembered side panel tab' });
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

    if (message.type === 'OPEN_SIDE_PANEL_FOR_SENDER') {
        if (sender.tab) {
            openSuitesenseForTab(sender.tab);
            sendResponse({ ok: true });
            return;
        }

        sendResponse({ ok: false });
        return;
    }

    if (message.type === 'SCRIPT_RESULT') {
        console.log('Script result received in background:', message.result);
        chrome.runtime.sendMessage({ type: 'DISPLAY_RESULT', result: message.result });
    }
});
