console.log('Content script is running.');

// Injecting the external injectedScript.js into the page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injectedScript.js');
script.onload = function() {
    console.log('Injected script successfully.');
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

console.log('Attempting to inject the script into the page.');

// Listening for messages from the injected script and forwarding them to the popup
window.addEventListener('message', function(event) {
    if (event.data.type) {
        // Handle SuiteQL query results
        if (event.data.type === 'FROM_PAGE') {
            console.log('Received results from injected script:', event.data.text);
            chrome.runtime.sendMessage({ type: 'QUERY_RESULTS', data: event.data.text });
        }
        
        // Handle unapplied payments results
        if (event.data.type === 'UNAPPLIED_PAYMENTS_RESULT') {
            console.log('Received Message', event.data.text);
            chrome.runtime.sendMessage({ type: 'UNAPPLIED_PAYMENTS_RESULT', data: event.data.text });
        }

        // Handle Salesforce success (account creation) and navigate to the account page
        if (event.data.type === 'SALESFORCE_SUCCESS') {
            console.log('Received Message: Salesforce Account Created', event.data.text);

            // Sending the Salesforce account ID back to popup.js or opening Salesforce page
            chrome.runtime.sendMessage({ type: 'SALESFORCE_SUCCESS', data: event.data.text });

            // Open the Salesforce Account page directly in a new tab
            const salesforceAccountId = event.data.salesforceAccountId;  // This ID should come from the injected script
            const salesforceUrl = `https://blueflamelabs-7d-dev-ed.develop.my.salesforce.com/lightning/r/Account/${salesforceAccountId}/view`;
            // window.open(salesforceUrl, '_blank');
            window.location.href = salesforceUrl;
        }

        // Handle field fetching results
        if (event.data.type === 'FIELDS_FETCHED') {
            console.log('Received Message: Fields Fetched', event.data.text);
            chrome.runtime.sendMessage({ type: 'FIELDS_FETCHED', data: event.data.text });
        }
    }
});

// Adding keyboard shortcuts for quick navigation (example shortcuts)
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
        window.open('https://td2929968.app.netsuite.com/app/accounting/transactions/salesord.nl?whence=', '_blank');
    } else if (isKeyPressed(savedShortcuts.invoices, event)) {
        window.open('https://td2929968.app.netsuite.com/app/accounting/transactions/transactionlist.nl?Transaction_TYPE=CustInvc&whence=', '_blank');
    } else if (isKeyPressed(savedShortcuts.purchaseOrder, event)) {
        window.open('https://td2929968.app.netsuite.com/app/accounting/transactions/purchord.nl?whence=', '_blank');
    } else if (isKeyPressed(savedShortcuts.customers, event)) {
        window.open('https://td2929968.app.netsuite.com/app/common/entity/custjob.nl?whence=', '_blank');
    }else if(isKeyPressed(savedShortcuts.ScriptUpload,event)) {
        window.open('https://td2929968.app.netsuite.com/app/common/scripting/uploadScriptFile.nl','_blank');
    }
});
