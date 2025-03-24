console.log('Content script is running.');

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
        request.onerror = function(event) {
            reject('Error opening IndexedDB');
        };
    });
}

function saveToIndexedDB(key, value) {
    openIndexedDB().then((db) => {
        const transaction = db.transaction('settings', 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ key: key, value: value });
        transaction.oncomplete = () => console.log(`${key} saved to IndexedDB`);
        transaction.onerror = () => console.error(`Error saving ${key} to IndexedDB`);
    });
}

const accountId = window.location.hostname.split('.')[0];
console.log('Account ID:', accountId);
saveToIndexedDB('accountId', accountId);

// Send the account ID to other extension scripts, such as popup.js
chrome.runtime.sendMessage({ type: 'ACCOUNT_ID', accountId: accountId });
chrome.runtime.sendMessage({ type: 'ACCOUNT_ID', accountId: accountId }, response => {
    console.log(response.status);
});

// Injecting the external injectedScript.js into the page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injectedScript.js');
script.onload = function() {
    console.log('Injected script successfully.');
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

console.log('Attempting to inject the script into the page.');

// Listen for messages from the popup to run custom scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'runCustomScript') {
        // Forward the user's custom script to the injected script
        window.postMessage({ type: 'RUN_CUSTOM_SCRIPT', script: request.script }, '*');
        console.log('Forwarded user script to injected script.');
    }
});

// Listening for messages from the injected script and forwarding them to the popup
window.addEventListener('message', function(event) {
    if (event.data.type) {
        // Handle custom script results
        if (event.data.type === 'CUSTOM_SCRIPT_RESULT') {
            console.log('Received results from injected script:', event.data.result);
            chrome.runtime.sendMessage({ type: 'SCRIPT_RESULT', result: event.data.result });
        }

        // Handle other existing events
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
            const salesforceAccountId = event.data.salesforceAccountId;
            const salesforceUrl = `https://blueflamelabs-7d-dev-ed.develop.my.salesforce.com/lightning/r/Account/${salesforceAccountId}/view`;
            window.location.href = salesforceUrl;
        }

        if (event.data.type === 'FIELDS_FETCHED') {
            console.log('Received fields fetched:', event.data.text);
            chrome.runtime.sendMessage({ type: 'FIELDS_FETCHED', data: event.data.text });
        }
    }
});

// Adding keyboard shortcuts for quick navigation
document.addEventListener('keydown', function(event) {
    const savedShortcuts = JSON.parse(localStorage.getItem('shortcuts')) || {
        salesOrder: 'Alt+S',
        invoices: 'Alt+I',
        purchaseOrder: 'Shift+P',
        customers: 'Alt+C',
        ScriptUpload: 'Alt+U'
    };

    const isKeyPressed = (shortcut, event) => {
        const [modifier, key] = shortcut.split('+');
        return event[`${modifier.toLowerCase()}Key`] && event.key.toUpperCase() === key.toUpperCase();
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
