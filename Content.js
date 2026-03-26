if (!window.__suitesenseContentInitialized) {
    window.__suitesenseContentInitialized = true;

    console.log('Suitesense content script is running.');

    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MyExtensionDB', 1);
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
            request.onsuccess = function(event) {
                resolve(event.target.result);
            };
            request.onerror = function() {
                reject('Error opening IndexedDB');
            };
        });
    }

    function saveToIndexedDB(key, value) {
        openIndexedDB().then((db) => {
            const transaction = db.transaction('settings', 'readwrite');
            const store = transaction.objectStore('settings');
            store.put({ key, value });
            transaction.oncomplete = () => console.log(`${key} saved to IndexedDB`);
            transaction.onerror = () => console.error(`Error saving ${key} to IndexedDB`);
        });
    }

    function injectPageScript() {
        if (document.querySelector('script[data-suitesense-injected="true"]')) {
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injectedScript.js');
        script.dataset.suitesenseInjected = 'true';
        script.onload = function() {
            console.log('Injected script successfully.');
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);

        console.log('Attempting to inject the script into the page.');
    }

    const accountId = window.location.hostname.split('.')[0];
    console.log('Account ID:', accountId);
    saveToIndexedDB('accountId', accountId);

    chrome.runtime.sendMessage({ type: 'ACCOUNT_ID', accountId }, (response) => {
        if (chrome.runtime.lastError) {
            console.debug('Unable to save account ID:', chrome.runtime.lastError.message);
            return;
        }

        if (response?.status) {
            console.log(response.status);
        }
    });

    injectPageScript();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || !message.type) {
            return;
        }

        if (message.type === 'RUN_QUERY') {
            window.postMessage({ type: 'RUN_QUERY', query: message.query }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'RUN_CUSTOM_SCRIPT') {
            window.postMessage({ type: 'RUN_CUSTOM_SCRIPT', script: message.script }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'FETCH_ALL_FIELDS') {
            window.postMessage({ type: 'FETCH_ALL_FIELDS' }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'RUN_UNAPPLIED_PAYMENTS_CHECK') {
            window.postMessage({ type: 'RUN_UNAPPLIED_PAYMENTS_CHECK' }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'SEND_TO_SALESFORCE') {
            window.postMessage({ type: 'SEND_TO_SALESFORCE', customerId: message.customerId }, '*');
            sendResponse({ ok: true });
        }
    });

    window.addEventListener('message', function(event) {
        if (!event.data || !event.data.type) {
            return;
        }

        if (event.source !== window) {
            return;
        }

        if (event.data.type === 'CUSTOM_SCRIPT_RESULT') {
            console.log('Received results from injected script:', event.data.result);
            chrome.runtime.sendMessage({ type: 'CUSTOM_SCRIPT_RESULT', result: event.data.result });
        }

        if (event.data.type === 'FROM_PAGE') {
            console.log('Received results from injected script:', event.data.text);
            chrome.runtime.sendMessage({ type: 'QUERY_RESULTS', data: event.data.text });
        }

        if (event.data.type === 'HIERARCHY_RESULT') {
            console.log('Received hierarchy result:', event.data.hierarchy);
            chrome.runtime.sendMessage({ type: 'OPEN_RESULTS_TAB', hierarchy: event.data.hierarchy });
        }

        if (event.data.type === 'UNAPPLIED_PAYMENTS_RESULT') {
            console.log('Received unapplied payments result:', event.data.text);
            chrome.runtime.sendMessage({ type: 'UNAPPLIED_PAYMENTS_RESULT', data: event.data.text });
        }

        if (event.data.type === 'SALESFORCE_SUCCESS') {
            console.log('Salesforce Account Created:', event.data.text);
            chrome.runtime.sendMessage({ type: 'SALESFORCE_SUCCESS', data: event.data.text });
            const salesforceUrl = '';
            window.location.href = salesforceUrl;
        }

        if (event.data.type === 'FIELDS_FETCHED') {
            console.log('Received fields fetched:', event.data.text);
            chrome.runtime.sendMessage({ type: 'FIELDS_FETCHED', data: event.data.text });
        }

        if (event.data.type === 'FIELDS_FETCH_ERROR') {
            console.log('Received field fetch error:', event.data.error);
            chrome.runtime.sendMessage({ type: 'FIELDS_FETCH_ERROR', error: event.data.error });
        }
    });

    document.addEventListener('keydown', function(event) {
        const savedShortcuts = JSON.parse(localStorage.getItem('shortcuts')) || {
            salesOrder: 'Alt+S',
            invoices: 'Alt+I',
            purchaseOrder: 'Alt+P',
            customers: 'Alt+C',
            ScriptUpload: 'Alt+U'
        };

        const isKeyPressed = (shortcut, keyboardEvent) => {
            const [modifier, key] = shortcut.split('+');
            return keyboardEvent[`${modifier.toLowerCase()}Key`] && keyboardEvent.key.toUpperCase() === key.toUpperCase();
        };

        if (isKeyPressed(savedShortcuts.salesOrder, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/accounting/transactions/salesord.nl?whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.invoices, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/accounting/transactions/transactionlist.nl?Transaction_TYPE=CustInvc&whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.purchaseOrder, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/accounting/transactions/purchord.nl?whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.customers, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/common/entity/custjob.nl?whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.ScriptUpload, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/common/scripting/uploadScriptFile.nl`, '_blank');
        }
    });
}
