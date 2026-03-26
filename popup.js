let suiteScriptEditor = null;
let queryEditor = null;
let queryInputEl = null;
let querySuggestionsEl = null;
let autocompleteState = {
    items: [],
    selectedIndex: 0,
    from: null,
    to: null,
    visible: false
};
let queryAutocompleteState = {
    items: [],
    selectedIndex: 0,
    from: null,
    to: null,
    visible: false
};

const suiteScriptCompletions = [
    { label: 'record', insertText: 'record', detail: 'NetSuite record module' },
    { label: 'search', insertText: 'search', detail: 'NetSuite search module' },
    { label: 'runtime', insertText: 'runtime', detail: 'NetSuite runtime module' },
    { label: 'https', insertText: 'https', detail: 'NetSuite HTTPS module' },
    { label: 'email', insertText: 'email', detail: 'NetSuite email module' },
    { label: 'log', insertText: 'log', detail: 'NetSuite logging module' },
    { label: 'error', insertText: 'error', detail: 'NetSuite error module' },
    { label: 'record.load', insertText: "record.load({\n  type: '',\n  id: ''\n})", detail: 'Load an existing record' },
    { label: 'record.create', insertText: "record.create({\n  type: '',\n  isDynamic: true\n})", detail: 'Create a record' },
    { label: 'record.submitFields', insertText: "record.submitFields({\n  type: '',\n  id: '',\n  values: {}\n})", detail: 'Update fields without loading' },
    { label: 'search.create', insertText: "search.create({\n  type: '',\n  filters: [],\n  columns: []\n})", detail: 'Build a saved-search style query' },
    { label: 'runtime.getCurrentUser', insertText: 'runtime.getCurrentUser()', detail: 'Get current NetSuite user' },
    { label: 'log.debug', insertText: "log.debug({ title: '', details: '' })", detail: 'Debug logging helper' },
    { label: 'log.audit', insertText: "log.audit({ title: '', details: '' })", detail: 'Audit logging helper' },
    { label: 'log.error', insertText: "log.error({ title: '', details: '' })", detail: 'Error logging helper' },
    { label: 'var', insertText: 'var ', detail: 'Declare a function-scoped variable' },
    { label: 'const', insertText: 'const ', detail: 'Declare a constant' },
    { label: 'let', insertText: 'let ', detail: 'Declare a block variable' },
    { label: 'async function', insertText: "async function name() {\n  \n}", detail: 'Async function snippet' },
    { label: 'function', insertText: "function name() {\n  \n}", detail: 'Function snippet' },
    { label: 'if', insertText: "if () {\n  \n}", detail: 'Conditional block' },
    { label: 'else', insertText: "else {\n  \n}", detail: 'Else block' },
    { label: 'for', insertText: "for (let i = 0; i < items.length; i += 1) {\n  \n}", detail: 'Loop snippet' },
    { label: 'forEach', insertText: ".forEach((item) => {\n  \n})", detail: 'Array iteration helper' },
    { label: 'await', insertText: 'await ', detail: 'Await an async operation' },
    { label: 'return', insertText: 'return ', detail: 'Return statement' },
    { label: 'try/catch', insertText: "try {\n  \n} catch (error) {\n  log.error({ title: 'Script Error', details: error });\n}", detail: 'Exception handling snippet' },
    { label: 'query.runSuiteQL', insertText: "query.runSuiteQL({ query: '' })", detail: 'Run SuiteQL if query module is available' }
];

const suiteQlKeywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'LEFT JOIN', 'INNER JOIN', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS'];
const suiteQlFields = ['id', 'entity', 'trandate', 'amount', 'status', 'location'];
const bundledAutocompleteTables = {
    transaction: [
        'abbrevtype', 'accountbasednumber', 'actionitem', 'actualproductionenddate', 'actualproductionstartdate', 'actualshipdate',
        'altsalestotal', 'approvalstatus', 'autocalculatelag', 'balsegstatus', 'billingaddress', 'billingstatus', 'buyingreason',
        'buyingtimeframe', 'closedate', 'committed', 'createdby', 'createddate', 'currency', 'customform', 'customtype',
        'daysopen', 'daysoverduesearch', 'duedate', 'email', 'employee', 'enddate', 'entity', 'entitystatus', 'estgrossprofit',
        'estgrossprofitpercent', 'estimatedbudget', 'exchangerate', 'expectedclosedate', 'externalid', 'fax', 'firmed',
        'forecasttype', 'foreignamountpaid', 'foreignamountunpaid', 'foreignpaymentamountunused', 'foreignpaymentamountused',
        'foreigntotal', 'fulfillmenttype', 'fxaltsalestotal', 'fxnetaltsalestotal', 'id', 'incoterm',
        'isactualprodenddateenteredmanually', 'isactualprodstartdateenteredmanually', 'isbudgetapproved', 'isfinchrg',
        'isreversal', 'iswip', 'journaltype', 'lastmodifiedby', 'lastmodifieddate', 'leadsource', 'linkedtrackingnumberlist',
        'manufacturingrouting', 'memdoc', 'memo', 'message', 'netaltsalestotal', 'nextapprover', 'nextbilldate', 'nexus',
        'number', 'opportunity', 'ordpicked', 'ordreceived', 'otherrefnum', 'partner', 'paymenthold', 'paymentmethod',
        'paymentoption', 'posting', 'postingperiod', 'printedpickingticket', 'probability', 'projectedtotal', 'rangehigh',
        'rangelow', 'recordtype', 'reversal', 'reversaldate', 'reversaldefer', 'revision', 'salesreadiness',
        'schedulingmethod', 'shipcarrier', 'shipcomplete', 'shipdate', 'shippingaddress', 'source', 'sourcetransaction',
        'startdate', 'status', 'terms', 'title', 'tobeprinted', 'tosubsidiary', 'totalcostestimate', 'trackingnumberlist',
        'trandate', 'trandisplayname', 'tranid', 'transactionnumber', 'transferlocation', 'type', 'typebaseddocumentnumber',
        'useitemcostastransfercost', 'userevenuearrangement', 'visibletocustomer', 'void', 'voided', 'website', 'weightedtotal',
        'winlossreason'
    ],
    transactionLine: [
        'accountinglinetype', 'actualshipdate', 'amortizationenddate', 'amortizationresidual', 'amortizationsched',
        'amortizstartdate', 'assemblycomponent', 'billeddate', 'billingschedule', 'billvariancestatus', 'blandedcost',
        'bomquantity', 'buildvariance', 'category', 'class', 'cleared', 'cleareddate', 'closedate', 'commitinventory',
        'commitmentfirm', 'componentyield', 'costestimate', 'costestimaterate', 'costestimatetype', 'createdfrom', 'createdpo',
        'creditforeignamount', 'debitforeignamount', 'department', 'documentnumber', 'donotdisplayline', 'dropship', 'entity',
        'estgrossprofit', 'estgrossprofitpercent', 'estimatedamount', 'expectedreceiptdate', 'expectedshipdate',
        'expenseaccount', 'foreignamount', 'foreignamountpaid', 'foreignamountunpaid', 'foreignpaymentamountunused',
        'foreignpaymentamountused', 'fulfillable', 'fxamountlinked', 'hasfulfillableitems', 'id', 'inventoryreportinglocation',
        'isbillable', 'isclosed', 'iscogs', 'isfullyshipped', 'isfxvariance', 'isinventoryaffecting', 'isrevrectransaction',
        'isscrap', 'item', 'itemsource', 'itemtype', 'kitcomponent', 'kitmemberof', 'landedcostcategory', 'landedcostperline',
        'linelastmodifieddate', 'linesequencenumber', 'location', 'mainline', 'matchbilltoreceipt', 'memo', 'netamount',
        'oldcommitmentfirm', 'operationdisplaytext', 'orderpriority', 'paymentmethod', 'price', 'processedbyrevcommit',
        'quantity', 'quantitybackordered', 'quantitybilled', 'quantitycommitted', 'quantitypacked', 'quantitypicked',
        'quantityrejected', 'quantityshiprecv', 'rate', 'rateamount', 'ratepercent', 'requestnote', 'revenueelement',
        'settlementamount', 'shipmethod', 'specialorder', 'subsidiary', 'taxline', 'transaction', 'transactiondiscount',
        'transactionlinetype', 'transferorderitemlineid', 'uniquekey', 'units', 'vsoeisestimate'
    ],
    nextTransactionLineLink: [
        'foreignamount', 'lastmodifieddate', 'linktype', 'nextdoc', 'nextline', 'nexttype', 'previousdoc', 'previousline',
        'previoustype'
    ],
    previousTransactionLineLink: [
        'foreignamount', 'lastmodifieddate', 'linktype', 'nextdoc', 'nextline', 'nexttype', 'previousdoc', 'previousline',
        'previoustype'
    ],
    nextTransactionLink: ['linktype', 'nextdoc', 'previousdoc'],
    previousTransactionLink: ['linktype', 'nextdoc', 'previousdoc'],
    customer: [
        'accountnumber', 'alcoholrecipienttype', 'altemail', 'altname', 'altphone', 'assignedwebsite', 'balancesearch',
        'billingratecard', 'buyingreason', 'buyingtimeframe', 'campaignevent', 'category', 'clickstream', 'comments',
        'companyname', 'consolbalancesearch', 'consoldaysoverduesearch', 'consoloverduebalancesearch',
        'consolunbilledorderssearch', 'contact', 'contactlist', 'creditholdoverride', 'creditlimit', 'currency',
        'custentity1', 'dateclosed', 'datecreated', 'defaultbankaccount', 'defaultbillingaddress', 'defaultorderpriority',
        'defaultshippingaddress', 'duplicate', 'email', 'emailpreference', 'emailtransactions', 'enddate', 'entityid',
        'entitynumber', 'entitystatus', 'entitytitle', 'estimatedbudget', 'externalid', 'fax', 'faxtransactions', 'firstname',
        'firstorderdate', 'firstsaledate', 'firstvisit', 'giveaccess', 'globalsubscriptionstatus', 'homephone', 'id',
        'isbudgetapproved', 'isinactive', 'isperson', 'keywords', 'language', 'lastmodifieddate', 'lastname', 'lastorderdate',
        'lastpagevisited', 'lastsaledate', 'lastvisit', 'leadsource', 'middlename', 'mobilephone', 'negativenumberformat',
        'numberformat', 'oncredithold', 'overduebalancesearch', 'parent', 'partner', 'phone', 'prefccprocessor', 'pricelevel',
        'printoncheckas', 'printtransactions', 'probability', 'receivablesaccount', 'referrer', 'reminderdays',
        'resalenumber', 'salesreadiness', 'salesrep', 'salutation', 'searchstage', 'shipcomplete', 'shippingcarrier',
        'shippingitem', 'sourcewebsite', 'startdate', 'terms', 'territory', 'thirdpartyacct', 'thirdpartycarrier',
        'thirdpartycountry', 'thirdpartyzipcode', 'title', 'unbilledorderssearch', 'url', 'visits', 'weblead'
    ],
    entity: [
        'altemail', 'altname', 'altphone', 'comments', 'contact', 'customer', 'datecreated', 'email', 'employee', 'entityid',
        'entitynumber', 'entitytitle', 'externalid', 'fax', 'firstname', 'genericresource', 'group', 'homephone', 'id',
        'isinactive', 'isperson', 'laborcost', 'lastmodifieddate', 'lastname', 'middlename', 'mobilephone', 'othername',
        'parent', 'partner', 'phone', 'project', 'projecttemplate', 'salutation', 'title', 'toplevelparent', 'type', 'vendor'
    ]
};
const recordsCatalog = [
    {
        name: 'transaction',
        description: 'Header-level transaction records such as sales orders, invoices, bills, and journals.',
        commonFields: ['id', 'tranid', 'type', 'entity', 'trandate', 'status'],
        fields: ['id', 'tranid', 'type', 'entity', 'trandate', 'status', 'memo', 'currency', 'foreigntotal', 'location', 'subsidiary', 'createddate']
    },
    {
        name: 'transactionLine',
        description: 'Line-level records tied to transactions, useful for item, amount, tax, and quantity analysis.',
        commonFields: ['transaction', 'item', 'quantity', 'amount', 'memo', 'taxline'],
        fields: ['transaction', 'line', 'item', 'quantity', 'amount', 'memo', 'taxline', 'department', 'class', 'location']
    },
    {
        name: 'transactionAccountingLine',
        description: 'General-ledger impact rows for posted transactions.',
        commonFields: ['transaction', 'account', 'debit', 'credit', 'amount', 'posting']
    },
    {
        name: 'customer',
        description: 'Customer master data including status, balances, terms, and subsidiary relationships.',
        commonFields: ['id', 'entityid', 'email', 'salesrep', 'terms', 'subsidiary'],
        fields: ['id', 'entityid', 'companyname', 'comments', 'email', 'phone', 'contact', 'contactlist', 'salesrep', 'terms', 'subsidiary', 'datecreated', 'isinactive']
    },
    {
        name: 'vendor',
        description: 'Vendor master data used for purchases, bills, and payable analytics.',
        commonFields: ['id', 'entityid', 'email', 'currency', 'subsidiary', 'isinactive'],
        fields: ['id', 'entityid', 'companyname', 'comments', 'email', 'phone', 'currency', 'subsidiary', 'terms', 'isinactive']
    },
    {
        name: 'item',
        description: 'Item master table for inventory, assembly, service, and non-inventory records.',
        commonFields: ['id', 'itemid', 'type', 'displayname', 'subsidiary', 'isinactive'],
        fields: ['id', 'itemid', 'displayname', 'type', 'salesdescription', 'incomeaccount', 'assetaccount', 'expenseaccount', 'subsidiary', 'isinactive']
    },
    {
        name: 'employee',
        description: 'Employee records with supervisor, department, class, and status metadata.',
        commonFields: ['id', 'entityid', 'email', 'supervisor', 'department', 'isinactive'],
        fields: ['id', 'entityid', 'firstname', 'lastname', 'email', 'supervisor', 'department', 'location', 'class', 'isinactive']
    },
    {
        name: 'entity',
        description: 'Shared entity-style table spanning customers, vendors, contacts, and related record families.',
        commonFields: ['id', 'entityid', 'email', 'phone', 'isinactive', 'datecreated']
    },
    {
        name: 'location',
        description: 'Location master data used for fulfillment, inventory, and transaction filtering.',
        commonFields: ['id', 'name', 'subsidiary', 'isinactive']
    },
    {
        name: 'subsidiary',
        description: 'Subsidiary master records for OneWorld accounts.',
        commonFields: ['id', 'name', 'fullname', 'currency', 'isinactive']
    },
    {
        name: 'account',
        description: 'Chart of accounts records including hierarchy and account type.',
        commonFields: ['id', 'acctnumber', 'displaynamewithhierarchy', 'accttype', 'isinactive']
    },
    {
        name: 'customField',
        description: 'Custom body, line, entity, and other field definitions in the account.',
        commonFields: ['scriptid', 'name', 'fieldtype', 'owner', 'lastmodifieddate']
    },
    {
        name: 'customRecordType',
        description: 'Custom record type definitions and metadata.',
        commonFields: ['scriptid', 'name', 'description', 'owner']
    },
    {
        name: 'nextTransactionLink',
        description: 'Transaction-to-transaction links such as sales order to fulfillment or invoice.',
        commonFields: ['previousdoc', 'nextdoc', 'linktype']
    },
    {
        name: 'systemNote',
        description: 'System note history for changes, field updates, and audit trails.',
        commonFields: ['recordid', 'recordtypeid', 'field', 'oldvalue', 'newvalue', 'date']
    },
    {
        name: 'mediaItemFolder',
        description: 'File cabinet folder metadata for browsing and reporting.',
        commonFields: ['id', 'name', 'parent', 'istoplevel']
    }
];
const suiteQlTables = Array.from(new Set([
    ...recordsCatalog.map((record) => record.name),
    ...Object.keys(bundledAutocompleteTables)
]));
const suiteQlFunctions = ['COUNT(*)', 'SUM()', 'MAX()', 'MIN()', 'BUILTIN.DF()', 'BUILTIN.CF()'];
const suiteQlCompletions = [
    ...suiteQlKeywords.map((keyword) => ({
        label: keyword,
        insertText: `${keyword} `,
        detail: 'SuiteQL keyword',
        type: 'keyword'
    })),
    ...suiteQlTables.map((table) => ({
        label: table,
        insertText: table,
        detail: 'NetSuite table',
        type: 'table'
    })),
    ...suiteQlFields.map((field) => ({
        label: field,
        insertText: field,
        detail: 'Common field',
        type: 'field'
    })),
    ...suiteQlFunctions.map((fn) => ({
        label: fn,
        insertText: fn,
        detail: 'SuiteQL function',
        type: 'function'
    }))
];

document.addEventListener('DOMContentLoaded', () => {
    loadQueryHistory();
    queryInputEl = document.getElementById('query');
    querySuggestionsEl = document.getElementById('suggestions');
    rememberSidePanelTab();
    initializeQueryEditor();
    initializeSuiteScriptEditor();

    document.getElementById('runSuiteScript').addEventListener('click', () => {
        const userScript = getSuiteScriptValue().trim();
        if (!userScript) {
            alert('Please enter a script to run.');
            return;
        }
        showLoader();
        sendMessageToActiveTab({ type: 'RUN_CUSTOM_SCRIPT', script: userScript }, 'Error running custom script.');
    });

    console.log('Popup loaded, ready to handle inputs.');
// const taskSelect = document.getElementById('scriptSelect');
//     const emailContainer = document.getElementById('emailContainer');
//     const runTaskButton = document.getElementById('runScript');
    
   
//     taskSelect.addEventListener('change', function () {
//         if (taskSelect.value === 'checkUnappliedPayments') {
//             emailContainer.style.display = 'block'; 
//         } else {
//             emailContainer.style.display = 'none';
//         }
//     });


document.addEventListener('click', function (event) {
    if (querySuggestionsEl && !event.target.closest('#suggestions') && !event.target.closest('#query')) {
        querySuggestionsEl.style.display = 'none';
    }
});

// document.getElementById('fetchHierarchy').addEventListener('click', () => {
//     const recordId = document.getElementById('recordId').value;
//     if (recordId) {
//       // Send a message to the content script to fetch the hierarchy
//       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         const activeTab = tabs[0];
//         chrome.scripting.executeScript({
//           target: { tabId: activeTab.id },
//           func: (recordId) => {
//             window.postMessage({ type: 'FETCH_HIERARCHY', recordId: recordId }, '*');
//           },
//           args: [recordId]
//         });
//       });
//     }
//   });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'OPEN_RESULTS_TAB') {
            chrome.tabs.create({ url: chrome.runtime.getURL('hresults.html') }, function (tab) {
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.sendMessage(tabId, { type: 'DISPLAY_HIERARCHY', hierarchy: message.hierarchy });
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                });
            });
        }
    });

    document.getElementById('runQuery').addEventListener('click', async () => {
    const query = getQueryValue().trim();
    if (query) {
        saveQueryToHistory(query);
        showLoader();

        const isNaturalLanguage = !query.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i);

        if (isNaturalLanguage) {
            
            try {
                const suiteQLQuery = await convertNaturalLanguageToSuiteQL(query);
                console.log('Converted SuiteQL Query:', suiteQLQuery);
                setQueryValue(suiteQLQuery);
                runQuery(suiteQLQuery);
            } catch (error) {
                console.error('Error converting natural language to SuiteQL:', error);
                showError('Failed to convert natural language to SuiteQL.');
                hideLoader();
            }
        } else {
            
            runQuery(query);
        }
        
    }
    });

    document.getElementById('queryHistory').addEventListener('change', (event) => {
        const selectedQuery = event.target.value;
        if (selectedQuery) {
            setQueryValue(selectedQuery);
        }
    });

// document.getElementById('runScript').addEventListener('click', () => {
//     const script = document.getElementById('scriptSelect').value;
//     if (script) {
//         if (script === 'checkUnappliedPayments') {
//             showLoader(); 
//             const email = document.getElementById('emailInput').value;
            
//             if (!email) {
//                 alert('Please enter a valid email address.');
//                 return;
//             }
//             chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//                 chrome.scripting.executeScript({
//                     target: { tabId: tabs[0].id },
//                     func: (email) => {
//                         window.postMessage({ type: 'RUN_UNAPPLIED_PAYMENTS_CHECK', email: email }, '*');
//                     },
//                     args: [email] 
//                 });
//             });
//             runUnappliedPaymentsCheck();
//         }
//     }
// });

// Salesforce integration event listener for syncing customer to as an account in Salesforce, 
// document.getElementById('sendToSalesforce').addEventListener('click', () => {
//     const customerId = document.getElementById('customerId').value;
//     if (!customerId) {
//         showError('Please enter a valid Customer ID.');
//         return;
//     }

//     showLoader();
//     sendCustomerToSalesforce(customerId);
// });

// Event listener to fetch all fields from the current record
    document.getElementById('fetchFields').addEventListener('click', () => {
        showLoader();
        fetchAllFieldsFromCurrentRecord();
    });

    
    document.getElementById('openQueryLibrary').addEventListener('click', openQueryLibraryModal);
    document.getElementById('openRecordsCatalog').addEventListener('click', openRecordsCatalogModal);

    
    window.addEventListener('message', (event) => {
        if (event.origin === window.location.origin && event.data.type === 'SELECT_QUERY') {
            setQueryValue(event.data.query);
            return;
        }

        if (event.origin === window.location.origin && event.data.type === 'INSERT_QUERY_TABLE') {
            insertTableIntoQuery(event.data.tableName);
        }
    });
});

function initializeQueryEditor() {
    const editorTextarea = document.getElementById('query');
    const editorMount = document.getElementById('queryEditorMount');
    if (!editorTextarea || !editorMount || typeof CodeMirror === 'undefined') {
        updateQueryCursorStatusForTextarea(editorTextarea);
        if (editorTextarea) {
            editorTextarea.addEventListener('input', syncQueryFallbackSuggestions);
            editorTextarea.addEventListener('click', syncQueryFallbackSuggestions);
            editorTextarea.addEventListener('keyup', syncQueryFallbackSuggestions);
        }
        return;
    }

    editorMount.closest('.editor-shell')?.classList.add('is-enhanced');
    queryEditor = CodeMirror(editorMount, {
        value: editorTextarea.value || '',
        mode: 'text/x-sql',
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: false,
        autofocus: false,
        viewportMargin: Infinity,
        extraKeys: {
            Tab: (cm) => {
                if (queryAutocompleteState.visible) {
                    applyQueryAutocompleteSelection(cm);
                    return;
                }
                cm.replaceSelection('  ', 'end');
            },
            'Ctrl-Space': (cm) => {
                openQueryAutocomplete(cm, true);
            },
            Down: () => {
                if (queryAutocompleteState.visible) {
                    moveQueryAutocompleteSelection(1);
                }
            },
            Up: () => {
                if (queryAutocompleteState.visible) {
                    moveQueryAutocompleteSelection(-1);
                }
            },
            Enter: (cm) => {
                if (queryAutocompleteState.visible) {
                    applyQueryAutocompleteSelection(cm);
                    return;
                }
                cm.execCommand('newlineAndIndent');
            },
            Esc: () => {
                hideQueryAutocomplete();
            }
        }
    });

    queryEditor.on('change', (cm) => {
        editorTextarea.value = cm.getValue();
    });

    queryEditor.on('cursorActivity', () => {
        updateQueryCursorStatus();
    });

    queryEditor.on('inputRead', (cm, change) => {
        const text = Array.isArray(change.text) ? change.text.join('') : '';
        if (/[A-Za-z_.]/.test(text) || text === ' ') {
            openQueryAutocomplete(cm, false);
            return;
        }

        if (!text) {
            openQueryAutocomplete(cm, false);
            return;
        }

        hideQueryAutocomplete();
    });

    queryEditor.on('blur', () => {
        window.setTimeout(() => {
            hideQueryAutocomplete();
        }, 150);
    });

    window.setTimeout(() => {
        editorTextarea.value = queryEditor.getValue();
        queryEditor.refresh();
        updateQueryCursorStatus();
    }, 0);

    document.addEventListener('click', (event) => {
        const autocomplete = document.getElementById('queryAutocomplete');
        if (autocomplete && !autocomplete.contains(event.target)) {
            hideQueryAutocomplete();
        }
    });
}

function getQueryValue() {
    if (queryEditor) {
        return queryEditor.getValue();
    }

    return queryInputEl ? queryInputEl.value : '';
}

function setQueryValue(value) {
    const nextValue = value || '';
    if (queryEditor) {
        queryEditor.setValue(nextValue);
        queryEditor.focus();
        updateQueryCursorStatus();
    }

    if (queryInputEl) {
        queryInputEl.value = nextValue;
        syncQueryFallbackSuggestions();
    }
}

function insertTextIntoQueryAtCursor(text) {
    if (!text) {
        return;
    }

    if (queryEditor) {
        const doc = queryEditor.getDoc();
        const cursor = doc.getCursor();
        doc.replaceRange(text, cursor);
        queryEditor.focus();
        updateQueryCursorStatus();
        return;
    }

    if (!queryInputEl) {
        return;
    }

    const value = queryInputEl.value || '';
    const start = queryInputEl.selectionStart || value.length;
    const end = queryInputEl.selectionEnd || start;
    const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
    const nextCaret = start + text.length;

    queryInputEl.value = nextValue;
    queryInputEl.focus();
    queryInputEl.selectionStart = nextCaret;
    queryInputEl.selectionEnd = nextCaret;
    syncQueryFallbackSuggestions();
}

function insertTableIntoQuery(tableName) {
    const table = String(tableName || '').trim();
    if (!table) {
        return;
    }

    const currentQuery = getQueryValue();
    if (!currentQuery.trim()) {
        setQueryValue(`SELECT \nFROM ${table}`);
        return;
    }

    const normalized = currentQuery.trimEnd();
    if (/\b(FROM|JOIN)\s*$/i.test(normalized)) {
        insertTextIntoQueryAtCursor(table);
        return;
    }

    if (!/\bFROM\b/i.test(currentQuery)) {
        setQueryValue(`${normalized}\nFROM ${table}`);
        return;
    }

    insertTextIntoQueryAtCursor(table);
}

function updateQueryCursorStatus() {
    const status = document.getElementById('queryCursorStatus');
    if (!status || !queryEditor) {
        return;
    }

    const cursor = queryEditor.getCursor();
    status.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
}

function updateQueryCursorStatusForTextarea(textarea) {
    const status = document.getElementById('queryCursorStatus');
    if (!status || !textarea) {
        return;
    }

    const value = textarea.value || '';
    const caret = textarea.selectionStart || 0;
    const beforeCaret = value.slice(0, caret);
    const lines = beforeCaret.split('\n');
    const line = lines.length;
    const col = (lines[lines.length - 1] || '').length + 1;
    status.textContent = `Ln ${line}, Col ${col}`;
}

function syncQueryFallbackSuggestions() {
    if (!queryInputEl) {
        return;
    }

    updateQueryCursorStatusForTextarea(queryInputEl);

    if (queryEditor) {
        return;
    }

    const caret = queryInputEl.selectionStart || queryInputEl.value.length;
    const beforeCaret = queryInputEl.value.slice(0, caret);
    const suggestions = getQueryMatches(beforeCaret, queryInputEl.value).slice(0, 8);
    showSuggestions(suggestions);
}

function getQueryTokenInfoFromText(beforeCursor) {
    const match = (beforeCursor || '').match(/[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)?\.?$/);
    return {
        word: match ? match[0] : '',
        length: match ? match[0].length : 0
    };
}

function getRecordCatalogEntry(tableName) {
    const normalized = String(tableName || '').toLowerCase();
    return recordsCatalog.find((record) => record.name.toLowerCase() === normalized) || null;
}

function getAutocompleteTableMap() {
    const runtimeTables = globalThis.autocompleteData && globalThis.autocompleteData.tables
        ? globalThis.autocompleteData.tables
        : null;

    return runtimeTables || bundledAutocompleteTables;
}

function getRecordFieldList(tableName) {
    const autocompleteTables = getAutocompleteTableMap();
    const runtimeFields = autocompleteTables[tableName] || autocompleteTables[String(tableName || '').toLowerCase()];
    const record = getRecordCatalogEntry(tableName);
    return Array.from(new Set([
        ...(runtimeFields || []),
        ...((record && record.fields) || []),
        ...((record && record.commonFields) || [])
    ]));
}

function getQueryAliasMap(queryText) {
    const aliases = {};
    const aliasPattern = /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\s+([A-Za-z_][\w$]*)\s+(?:AS\s+)?([A-Za-z_][\w$]*)/gi;
    let match = aliasPattern.exec(queryText || '');

    while (match) {
        aliases[String(match[2]).toLowerCase()] = match[1];
        match = aliasPattern.exec(queryText || '');
    }

    return aliases;
}

function getAliasFieldCompletions(token, queryText) {
    const rawToken = String(token || '');
    const aliasMap = getQueryAliasMap(queryText);
    const aliasEntries = Object.entries(aliasMap);
    if (!aliasEntries.length) {
        return [];
    }

    if (rawToken.includes('.')) {
        const [aliasName, partialField = ''] = rawToken.split('.', 2);
        const tableName = aliasMap[aliasName.toLowerCase()];
        if (!tableName) {
            return [];
        }

        return getRecordFieldList(tableName)
            .filter((field) => field.toLowerCase().startsWith(partialField.toLowerCase()))
            .map((field) => ({
                label: `${aliasName}.${field}`,
                insertText: `${aliasName}.${field}`,
                detail: `${tableName} field via alias ${aliasName}`,
                type: 'alias-field'
            }));
    }

    return aliasEntries.flatMap(([aliasName, tableName]) => {
        return getRecordFieldList(tableName).map((field) => ({
            label: `${aliasName}.${field}`,
            insertText: `${aliasName}.${field}`,
            detail: `${tableName} field via alias ${aliasName}`,
            type: 'alias-field'
        }));
    });
}

function getQueryCompletionContext(beforeCursor) {
    const compact = String(beforeCursor || '').replace(/\s+/g, ' ').trim();
    if (!compact) {
        return 'all';
    }

    if (/\b(SELECT)\s*$/i.test(compact) || /\bSELECT\s+[^]*$/i.test(compact) && !/\bFROM\b/i.test(compact)) {
        return 'field';
    }

    if (/\b(FROM|JOIN)\s*[A-Za-z_]*$/i.test(compact)) {
        return 'table';
    }

    if (/\b(WHERE|AND|OR|ON|GROUP BY|ORDER BY|HAVING)\s*[A-Za-z_]*$/i.test(compact)) {
        return 'field';
    }

    return 'all';
}

function getQueryMatches(beforeCursor, fullQueryText = beforeCursor) {
    const tokenInfo = getQueryTokenInfoFromText(beforeCursor);
    const context = getQueryCompletionContext(beforeCursor);
    const aliasFieldCompletions = getAliasFieldCompletions(tokenInfo.word, fullQueryText);
    let pool = suiteQlCompletions;

    if (context === 'table') {
        pool = suiteQlCompletions.filter((item) => item.type === 'table' || item.type === 'keyword');
    } else if (context === 'field') {
        pool = [
            ...aliasFieldCompletions,
            ...suiteQlCompletions.filter((item) => item.type === 'field' || item.type === 'function' || item.type === 'keyword')
        ];
    } else if (aliasFieldCompletions.length) {
        pool = [...aliasFieldCompletions, ...suiteQlCompletions];
    }

    const normalized = tokenInfo.word.toLowerCase();
    if (!normalized) {
        return pool;
    }

    return pool.filter((item) => {
        const lowerLabel = item.label.toLowerCase();
        return lowerLabel.startsWith(normalized) || lowerLabel.includes(`.${normalized}`);
    });
}

function showSuggestions(suggestions) {
    if (!querySuggestionsEl || !queryInputEl) {
        return;
    }

    if (!suggestions.length) {
        querySuggestionsEl.style.display = 'none';
        querySuggestionsEl.innerHTML = '';
        return;
    }

    querySuggestionsEl.innerHTML = '';
    suggestions.forEach((suggestion) => {
        const div = document.createElement('div');
        div.textContent = suggestion.label;
        div.addEventListener('mousedown', (event) => {
            event.preventDefault();
            applyQuerySuggestionToTextarea(suggestion);
        });
        querySuggestionsEl.appendChild(div);
    });

    querySuggestionsEl.style.display = 'block';
}

function applyQuerySuggestionToTextarea(suggestion) {
    if (!queryInputEl) {
        return;
    }

    const value = queryInputEl.value || '';
    const caret = queryInputEl.selectionStart || value.length;
    const beforeCaret = value.slice(0, caret);
    const afterCaret = value.slice(caret);
    const tokenInfo = getQueryTokenInfoFromText(beforeCaret);
    const from = caret - tokenInfo.length;
    const nextValue = `${value.slice(0, from)}${suggestion.insertText}${afterCaret}`;
    const nextCaret = from + suggestion.insertText.length;

    queryInputEl.value = nextValue;
    queryInputEl.focus();
    queryInputEl.selectionStart = nextCaret;
    queryInputEl.selectionEnd = nextCaret;
    syncQueryFallbackSuggestions();
}

function getQueryAutocompleteToken(cm) {
    const cursor = cm.getCursor();
    const beforeCursor = cm.getRange(CodeMirror.Pos(0, 0), cursor);
    const tokenInfo = getQueryTokenInfoFromText(beforeCursor);
    return {
        word: tokenInfo.word,
        from: CodeMirror.Pos(cursor.line, cursor.ch - tokenInfo.length),
        to: CodeMirror.Pos(cursor.line, cursor.ch)
    };
}

function openQueryAutocomplete(cm, forceOpen) {
    const cursor = cm.getCursor();
    const beforeCursor = cm.getRange(CodeMirror.Pos(0, 0), cursor);
    const fullQueryText = cm.getValue();
    const tokenInfo = getQueryAutocompleteToken(cm);

    if (!forceOpen && !tokenInfo.word && !/\b(SELECT|FROM|WHERE|JOIN|AND|OR)\s*$/i.test(beforeCursor)) {
        hideQueryAutocomplete();
        return;
    }

    const matches = getQueryMatches(beforeCursor, fullQueryText).slice(0, 12);
    if (!matches.length) {
        hideQueryAutocomplete();
        return;
    }

    queryAutocompleteState.items = matches;
    queryAutocompleteState.selectedIndex = 0;
    queryAutocompleteState.from = tokenInfo.from;
    queryAutocompleteState.to = tokenInfo.to;
    queryAutocompleteState.visible = true;
    renderQueryAutocomplete(cm);
}

function renderQueryAutocomplete(cm) {
    const autocomplete = document.getElementById('queryAutocomplete');
    if (!autocomplete || !queryAutocompleteState.visible) {
        return;
    }

    autocomplete.innerHTML = '';
    queryAutocompleteState.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `editor-autocomplete-item${index === queryAutocompleteState.selectedIndex ? ' is-active' : ''}`;
        row.innerHTML = `
        <div class="editor-autocomplete-label">${item.label}</div>
        <div class="editor-autocomplete-detail">${item.detail}</div>
    `;
        row.addEventListener('mousedown', (event) => {
            event.preventDefault();
            queryAutocompleteState.selectedIndex = index;
            applyQueryAutocompleteSelection(cm);
        });
        autocomplete.appendChild(row);
    });

    const shell = autocomplete.parentElement;
    const coords = cm.cursorCoords(null, 'local');
    const maxLeft = Math.max(12, shell.clientWidth - 250);
    const top = Math.max(58, coords.bottom + 8);
    autocomplete.style.left = `${Math.min(Math.max(12, coords.left + 8), maxLeft)}px`;
    autocomplete.style.top = `${top}px`;
    autocomplete.style.display = 'block';
}

function hideQueryAutocomplete() {
    queryAutocompleteState.visible = false;
    queryAutocompleteState.items = [];
    const autocomplete = document.getElementById('queryAutocomplete');
    if (autocomplete) {
        autocomplete.style.display = 'none';
        autocomplete.innerHTML = '';
    }
}

function applyQueryAutocompleteSelection(cm) {
    if (!queryAutocompleteState.visible || !queryAutocompleteState.items.length) {
        return;
    }

    const selected = queryAutocompleteState.items[queryAutocompleteState.selectedIndex];
    cm.replaceRange(selected.insertText, queryAutocompleteState.from, queryAutocompleteState.to);
    hideQueryAutocomplete();
    updateQueryCursorStatus();
}

function moveQueryAutocompleteSelection(direction) {
    if (!queryAutocompleteState.visible || !queryAutocompleteState.items.length || !queryEditor) {
        return;
    }

    const lastIndex = queryAutocompleteState.items.length - 1;
    queryAutocompleteState.selectedIndex += direction;

    if (queryAutocompleteState.selectedIndex < 0) {
        queryAutocompleteState.selectedIndex = lastIndex;
    }

    if (queryAutocompleteState.selectedIndex > lastIndex) {
        queryAutocompleteState.selectedIndex = 0;
    }

    renderQueryAutocomplete(queryEditor);
}

function rememberSidePanelTab() {
chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
        return;
    }

    const activeTab = tabs && tabs[0];
    if (!activeTab || !activeTab.id) {
        return;
    }

    chrome.runtime.sendMessage({
        type: 'SIDE_PANEL_OPENED',
        tabId: activeTab.id,
        url: activeTab.url || ''
    }, () => {
        if (chrome.runtime.lastError) {
            console.debug('Unable to remember side panel tab:', chrome.runtime.lastError.message);
        }
    });
});
}

function showLoader() {
document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
document.getElementById('loader').style.display = 'none';
}

function showError(message) {
const errorBox = document.getElementById('errorBox');
errorBox.textContent = message;
errorBox.style.display = 'block';

setTimeout(() => {
    errorBox.style.display = 'none';
}, 5000);
}

function sendMessageToActiveTab(message, fallbackError) {
return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || fallbackError));
            return;
        }

        const activeTab = tabs && tabs[0];
        if (!activeTab || !activeTab.id) {
            reject(new Error(fallbackError || 'No active NetSuite tab found.'));
            return;
        }

        chrome.tabs.sendMessage(activeTab.id, message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message || fallbackError));
                return;
            }

            resolve(response);
        });
    });
});
}

function initializeSuiteScriptEditor() {
const editorTextarea = document.getElementById('suiteScriptInput');
const editorMount = document.getElementById('suiteScriptEditorMount');
if (!editorTextarea || !editorMount || typeof CodeMirror === 'undefined') {
    updateEditorCursorStatusForTextarea(editorTextarea);
    if (editorTextarea) {
        editorTextarea.addEventListener('input', () => updateEditorCursorStatusForTextarea(editorTextarea));
        editorTextarea.addEventListener('click', () => updateEditorCursorStatusForTextarea(editorTextarea));
        editorTextarea.addEventListener('keyup', () => updateEditorCursorStatusForTextarea(editorTextarea));
    }
    return;
}

const initialValue = `// Example:
// const currentUser = runtime.getCurrentUser();
// log.debug('Current user', currentUser.name);

return {
  status: 'ready'
};`;
editorTextarea.value = initialValue;
editorMount.closest('.editor-shell')?.classList.add('is-enhanced');

suiteScriptEditor = CodeMirror(editorMount, {
    value: initialValue,
    mode: 'javascript',
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: false,
    autofocus: false,
    viewportMargin: Infinity,
    extraKeys: {
        Tab: (cm) => {
            if (autocompleteState.visible) {
                applyAutocompleteSelection(cm);
                return;
            }
            cm.replaceSelection('  ', 'end');
        },
        'Ctrl-Space': (cm) => {
            openAutocomplete(cm, true);
        },
        Down: () => {
            if (autocompleteState.visible) {
                moveAutocompleteSelection(1);
                return;
            }
        },
        Up: () => {
            if (autocompleteState.visible) {
                moveAutocompleteSelection(-1);
                return;
            }
        },
        Enter: (cm) => {
            if (autocompleteState.visible) {
                applyAutocompleteSelection(cm);
                return;
            }
            cm.execCommand('newlineAndIndent');
        },
        Esc: () => {
            hideAutocomplete();
        }
    }
});

suiteScriptEditor.on('change', (cm) => {
    editorTextarea.value = cm.getValue();
});

suiteScriptEditor.on('cursorActivity', () => {
    updateEditorCursorStatus();
});

suiteScriptEditor.on('inputRead', (cm, change) => {
    const text = Array.isArray(change.text) ? change.text.join('') : '';
    if (/[A-Za-z0-9_.]/.test(text)) {
        openAutocomplete(cm, false);
        return;
    }

    if (!text) {
        openAutocomplete(cm, false);
        return;
    }

    hideAutocomplete();
});

suiteScriptEditor.on('blur', () => {
    window.setTimeout(() => {
        hideAutocomplete();
    }, 150);
});

window.addEventListener('resize', () => {
    if (queryEditor) {
        queryEditor.refresh();
    }

    if (suiteScriptEditor) {
        suiteScriptEditor.refresh();
    }
});

window.setTimeout(() => {
    editorTextarea.value = suiteScriptEditor.getValue();
    suiteScriptEditor.refresh();
    updateEditorCursorStatus();
}, 0);

document.addEventListener('click', (event) => {
    const autocomplete = document.getElementById('suiteScriptAutocomplete');
    if (autocomplete && !autocomplete.contains(event.target)) {
        hideAutocomplete();
    }
});
}

function getSuiteScriptValue() {
if (suiteScriptEditor) {
    return suiteScriptEditor.getValue();
}

return document.getElementById('suiteScriptInput').value;
}

function updateEditorCursorStatus() {
const status = document.getElementById('editorCursorStatus');
if (!status || !suiteScriptEditor) {
    return;
}

const cursor = suiteScriptEditor.getCursor();
status.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
}

function updateEditorCursorStatusForTextarea(textarea) {
const status = document.getElementById('editorCursorStatus');
if (!status || !textarea) {
    return;
}

const value = textarea.value || '';
const caret = textarea.selectionStart || 0;
const beforeCaret = value.slice(0, caret);
const lines = beforeCaret.split('\n');
const line = lines.length;
const col = (lines[lines.length - 1] || '').length + 1;
status.textContent = `Ln ${line}, Col ${col}`;
}

function getAutocompleteToken(cm) {
const cursor = cm.getCursor();
const lineText = cm.getLine(cursor.line).slice(0, cursor.ch);
const match = lineText.match(/[A-Za-z_$][\w.$]*$/);
if (!match) {
    return {
        word: '',
        from: CodeMirror.Pos(cursor.line, cursor.ch),
        to: CodeMirror.Pos(cursor.line, cursor.ch)
    };
}

const word = match[0];
return {
    word,
    from: CodeMirror.Pos(cursor.line, cursor.ch - word.length),
    to: CodeMirror.Pos(cursor.line, cursor.ch)
};
}

function filterCompletions(query) {
const normalizedQuery = (query || '').toLowerCase();
if (!normalizedQuery) {
    return suiteScriptCompletions.slice(0, 8);
}

return suiteScriptCompletions.filter((item) => {
    return item.label.toLowerCase().includes(normalizedQuery) ||
        item.insertText.toLowerCase().includes(normalizedQuery);
    }).slice(0, 8);
}

function openAutocomplete(cm, forceOpen) {
const tokenInfo = getAutocompleteToken(cm);
const query = tokenInfo ? tokenInfo.word : '';

if (!forceOpen && !query) {
    hideAutocomplete();
    return;
}

const matches = filterCompletions(query);
if (!matches.length) {
    hideAutocomplete();
    return;
}

autocompleteState.items = matches;
autocompleteState.selectedIndex = 0;
autocompleteState.from = tokenInfo ? tokenInfo.from : cm.getCursor();
autocompleteState.to = tokenInfo ? tokenInfo.to : cm.getCursor();
autocompleteState.visible = true;

renderAutocomplete(cm);
}

function renderAutocomplete(cm) {
const autocomplete = document.getElementById('suiteScriptAutocomplete');
if (!autocomplete || !autocompleteState.visible) {
    return;
}

autocomplete.innerHTML = '';
autocompleteState.items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `editor-autocomplete-item${index === autocompleteState.selectedIndex ? ' is-active' : ''}`;
    row.innerHTML = `
        <div class="editor-autocomplete-label">${item.label}</div>
        <div class="editor-autocomplete-detail">${item.detail}</div>
    `;
    row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        autocompleteState.selectedIndex = index;
        applyAutocompleteSelection(cm);
    });
    autocomplete.appendChild(row);
});

const shell = autocomplete.parentElement;
const coords = cm.cursorCoords(null, 'local');
const maxLeft = Math.max(12, shell.clientWidth - 250);
const top = Math.max(58, coords.bottom + 8);
autocomplete.style.left = `${Math.min(Math.max(12, coords.left + 8), maxLeft)}px`;
autocomplete.style.top = `${top}px`;
autocomplete.style.display = 'block';
}

function hideAutocomplete() {
autocompleteState.visible = false;
autocompleteState.items = [];
const autocomplete = document.getElementById('suiteScriptAutocomplete');
if (autocomplete) {
    autocomplete.style.display = 'none';
    autocomplete.innerHTML = '';
}
}

function applyAutocompleteSelection(cm) {
if (!autocompleteState.visible || !autocompleteState.items.length) {
    return;
}

const selected = autocompleteState.items[autocompleteState.selectedIndex];
cm.replaceRange(selected.insertText, autocompleteState.from, autocompleteState.to);
hideAutocomplete();
updateEditorCursorStatus();
}

function moveAutocompleteSelection(direction) {
if (!autocompleteState.visible || !autocompleteState.items.length || !suiteScriptEditor) {
    return;
}

const lastIndex = autocompleteState.items.length - 1;
autocompleteState.selectedIndex = autocompleteState.selectedIndex + direction;

if (autocompleteState.selectedIndex < 0) {
    autocompleteState.selectedIndex = lastIndex;
}

if (autocompleteState.selectedIndex > lastIndex) {
    autocompleteState.selectedIndex = 0;
}

renderAutocomplete(suiteScriptEditor);
}

//SuiteQL ENtry point main function
function runQuery(query) {
console.log('Sending query:', query);

sendMessageToActiveTab(
    { type: 'RUN_QUERY', query: query },
    'Error executing the query. Please check the syntax.'
).catch(() => {
    hideLoader();
    showError('Error executing the query. Please check the syntax.');
});
}

async function convertNaturalLanguageToSuiteQL(naturalLanguageQuery) {
const openAiApiKey = ''; 

try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert in writing SuiteQL queries for NetSuite. Always return only the SQL query without any additional explanation or code block markers.'
                },
                {
                    role: 'user',
                    content: `Convert the following natural language into a SuiteQL query: ${naturalLanguageQuery}. Only return the SQL query without any explanation.`
                }
            ],
            max_tokens: 100, 
            temperature: 0.0, 
        }),
    });

    const data = await response.json();
    console.log('OpenAI Response:', data);

    if (!response.ok) {
        throw new Error('Failed to communicate with OpenAI API.');
    }

    return data.choices[0].message.content.trim();
} catch (error) {
    console.error('Error:', error); 
    throw new Error('Failed to convert natural language to SuiteQL.');
}
}

function openQueryLibraryModal() {
const queryLibrary = [
    {
        name: 'Account Subsidiary Map',
        description: 'A list of general ledger accounts and the subsidiaries that they are mapped to.',
        query: `SELECT
        Account,
        BUILTIN.DF( Account ) AS AccountName,
        Subsidiary,
        BUILTIN.DF( Subsidiary ) AS SubsidiaryName
        FROM 
        AccountSubsidiaryMap`
    },
    {
        name: 'Custom Field',
        description: 'Lists all custom fields in the account',
        query: `SELECT
        scriptid,
        name,
        fieldtype,
        fieldvaluetype,
        BUILTIN.DF( owner ) AS owner,
        lastmodifieddate
    FROM
        CustomField
    ORDER BY
        scriptid`
    },
    {
        name: 'Custom Lists',
        description: 'Lists all custom lists in the account. ',
        query: `SELECT
        Name,
        Description,
        ScriptID,
        BUILTIN.DF( Owner ) AS Owner,
        IsOrdered
    FROM 
        CustomList
    WHERE
        ( IsInactive = 'F' )
    ORDER BY
        Name`
    },
    {
        name: 'Custom Record Types',
        description: 'Lists all custom record types in the account',
        query: `SELECT
        Name,
        ScriptID,
        Description,
        BUILTIN.DF( Owner ) AS Owner
    FROM
        CustomRecordType
    ORDER BY
        Name`
    },
    {
        name: 'Custom Lists',
        description: 'Lists all custom lists in the account.',
        query: `SELECT
        Account,
        BUILTIN.DF( Account ) AS AccountName,
        Subsidiary,
        BUILTIN.DF( Subsidiary ) AS SubsidiaryName
        FROM 
        AccountSubsidiaryMap`
    },
    {
        name: 'File Cabinet - Top Level Folders',
        description: 'Returns a list of folders in the root of the File Cabinet.',
        query: `SELECT 	
        *
    FROM 
        MediaItemFolder
    WHERE
        ( IsTopLevel = 'T' )`
    },
    {
        name: 'Item Fulfillments - for Specified Sales Order',
        description: 'Lists all item fulfillments for a specified Sales Order ID.',
        query: `SELECT
        SalesOrder.ID AS SalesOrder,
        SalesOrder.TranID As SalesOrderID,
        BUILTIN.DF( SalesOrder.Status ) AS SalesOrderStatus,
        Fulfillment.ID AS Fulfillment,
        Fulfillment.TranID As FulfillmentID,
        BUILTIN.DF( Fulfillment.Status ) AS FulfillmentStatus
    FROM
        NextTransactionLink AS NTL
        INNER JOIN Transaction AS SalesOrder ON
            ( SalesOrder.ID = NTL.PreviousDoc )
        INNER JOIN Transaction AS Fulfillment ON
            ( Fulfillment.ID = NTL.NextDoc )
    WHERE
        ( NTL.LinkType IN ( 'PickPack', 'ShipRcpt' ) )
        -- This is the internal ID of the SalesOrder.
        AND ( NTL.PreviousDoc = 	1111)`
    },
    {
        name: 'Transaction Statuses',
        description: 'Lists status codes for all transaction types.',
        query: `SELECT DISTINCT
        Transaction.Type AS TransactionType,
        Status,
        BUILTIN.DF( Status ) AS DFStatus,
        BUILTIN.CF( Status ) AS CFStatus
    FROM
        Transaction
    ORDER BY
        TransactionType,
        Status`
    },
    {
        name: 'General Ledger Impact by Transaction Type',
        description: 'Lists all transaction types and the general ledger accounts that they post to.',
        query: `SELECT
        BUILTIN.DF( Transaction.Type ) AS TransactionType,
        BUILTIN.DF( Account.AcctType ) AS AccountType,
        Account.DisplayNameWithHierarchy AS AccountHierarchy,
        TransactionAccountingLine.Posting,
        SUM( TransactionAccountingLine.Debit ) AS Debits,
        SUM( TransactionAccountingLine.Credit ) AS Credits,
        SUM( TransactionAccountingLine.Amount ) AS Amount
    FROM 
        Transaction
        INNER JOIN TransactionAccountingLine ON
            ( TransactionAccountingLine.Transaction = Transaction.ID )
        INNER JOIN Account ON
            ( Account.ID = TransactionAccountingLine.Account )
    WHERE
        ( Transaction.TranDate >= BUILTIN.RELATIVE_RANGES( 'DAGO30', 'START' ) )
    GROUP BY
        BUILTIN.DF( Transaction.Type ),
        BUILTIN.DF( Account.AcctType ),
        Account.DisplayNameWithHierarchy,
        TransactionAccountingLine.Posting
    ORDER BY
        TransactionType,
        AccountType,
        DisplayNameWithHierarchy,
        TransactionAccountingLine.Posting
    `
    },
    {
        name: 'Journal Entries - In Date Range',
        description: 'Returns journal entry transactions in a given date range.',
        query: `SELECT
        Transaction.ID,
        Transaction.TranID,
        Transaction.TranDate,
        BUILTIN.DF( Transaction.PostingPeriod ) AS PostingPeriod,
        Transaction.Memo,
        Transaction.Posting,
        BUILTIN.DF( Transaction.Status ) AS Status,
        BUILTIN.DF( Transaction.CreatedBy ) AS CreatedBy
    FROM
        Transaction
    WHERE
        ( Transaction.Type = 'Journal' )
        AND ( Transaction.TranDate BETWEEN TO_DATE( '2024-10-24', 'YYYY-MM-DD' ) AND TO_DATE( '2024-10-31', 'YYYY-MM-DD' ) )
    ORDER BY
        Transaction.ID DESC`
    },
    {
        name: 'Sales Order - With Sales Tax',
        description: 'Returns header-level values for a specified Sales Order, including the Tax Total value sourced from the related TransactionLine records.',
        query: `SELECT
        Transaction.TranID,
        Transaction.TranDate,
        Transaction.Entity AS CustomerID,
        BUILTIN.DF( Transaction.Entity ) AS CustomerName,
        BUILTIN.DF( Transaction.Status ) AS Status,
        Transaction.ForeignTotal AS Total,
        ( 
            SELECT 
                SUM( TransactionLine.ForeignAmount * -1 ) AS SalesTax 
            FROM
                TransactionLine 
            WHERE
                ( TransactionLine.Transaction = Transaction.ID )
                AND ( TransactionLine.TaxLine = 'T' )
        ) AS SalesTax
    FROM 
        Transaction
    WHERE 
        ( Transaction.Type = 'SalesOrd' )
        AND ( Transaction.ID = 22021)`
    },


];

const modal = window.open('', '_blank', 'width=600,height=400');
    
// Write basic HTML structure and insert the thank-you message at the top right
modal.document.write('<html><head><title>Query Library</title></head><body>');
modal.document.write('<div style="position: absolute; top: 10px; right: 10px; font-size: 12px; color: #888;">Credits to Tim Dietrich for the excellent queries used in this extension.</div>');
modal.document.write('<h2>Select a Query</h2>');

// Create the container for the query library list
const libraryContainer = modal.document.createElement('div');
libraryContainer.id = 'libraryContainer';
modal.document.body.appendChild(libraryContainer);

// Populate the library with queries
queryLibrary.forEach((queryObj, index) => {
    const queryDiv = modal.document.createElement('div');
    queryDiv.style.border = '1px solid #ccc';
    queryDiv.style.padding = '10px';
    queryDiv.style.marginBottom = '10px';

    queryDiv.innerHTML = `
        <strong>Query Name:</strong> ${queryObj.name} <br/>
        <strong>Description:</strong> ${queryObj.description} <br/>
    `;

    const selectButton = modal.document.createElement('button');
    selectButton.textContent = 'Select';
    selectButton.dataset.queryIndex = index;
    
    selectButton.style.backgroundColor = '#007bff';  
    selectButton.style.color = '#fff';  
    selectButton.style.border = 'none';  
    selectButton.style.padding = '5px 10px';  
    selectButton.style.cursor = 'pointer';  

    selectButton.addEventListener('click', function () {
        const query = queryLibrary[this.dataset.queryIndex].query;
        modal.opener.postMessage({ type: 'SELECT_QUERY', query: query }, modal.location.origin);
        modal.close();
    });

    queryDiv.appendChild(selectButton);
    libraryContainer.appendChild(queryDiv);
});

modal.document.write('</body></html>');
modal.document.close();
}

function openRecordsCatalogModal() {
const modal = window.open('', '_blank', 'width=860,height=680');
if (!modal) {
    showError('Unable to open the records catalog window.');
    return;
}

modal.document.write(`
    <html>
        <head>
            <title>Records Catalog</title>
            <style>
                body {
                    margin: 0;
                    padding: 24px;
                    background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
                    color: #14233b;
                    font-family: "Segoe UI", Arial, sans-serif;
                }

                h1 {
                    margin: 0 0 8px;
                    font-size: 24px;
                }

                p {
                    margin: 0;
                    color: #60718c;
                    line-height: 1.5;
                }

                .toolbar {
                    margin: 18px 0 20px;
                }

                .search {
                    width: 100%;
                    padding: 14px 16px;
                    border: 1px solid rgba(0, 123, 255, 0.14);
                    border-radius: 14px;
                    background: #ffffff;
                    color: #14233b;
                    font-size: 14px;
                    outline: none;
                }

                .search:focus {
                    border-color: rgba(0, 123, 255, 0.45);
                    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.12);
                }

                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }

                .card {
                    padding: 18px;
                    border: 1px solid rgba(0, 123, 255, 0.12);
                    border-radius: 18px;
                    background: rgba(255, 255, 255, 0.96);
                    box-shadow: 0 12px 24px rgba(16, 43, 84, 0.10);
                }

                .name {
                    margin: 0 0 10px;
                    color: #0056b3;
                    font-size: 18px;
                    font-weight: 700;
                    font-family: Consolas, "SFMono-Regular", monospace;
                }

                .fields {
                    margin: 14px 0 0;
                    color: #41536f;
                    font-size: 13px;
                    line-height: 1.5;
                }

                .fields strong {
                    color: #21314e;
                }

                .actions {
                    margin-top: 16px;
                    display: flex;
                    gap: 10px;
                }

                button {
                    border: 0;
                    border-radius: 999px;
                    padding: 10px 14px;
                    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                    color: #ffffff;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                }

                .secondary {
                    background: #eaf3ff;
                    color: #0056b3;
                }

                .empty {
                    display: none;
                    margin-top: 20px;
                    padding: 18px;
                    border-radius: 16px;
                    background: #ffffff;
                    color: #60718c;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <h1>NetSuite Records Catalog</h1>
            <p>Browse common SuiteQL tables, understand what they are used for, and insert a table name into the Query editor.</p>
            <div class="toolbar">
                <input id="recordSearch" class="search" type="search" placeholder="Search by table name, description, or field..." />
            </div>
            <div id="catalogGrid" class="grid"></div>
            <div id="catalogEmpty" class="empty">No matching tables found.</div>
        </body>
    </html>
`);
modal.document.close();

const { document: doc } = modal;
const grid = doc.getElementById('catalogGrid');
const empty = doc.getElementById('catalogEmpty');
const search = doc.getElementById('recordSearch');

const renderCatalog = (items) => {
    grid.innerHTML = '';
    empty.style.display = items.length ? 'none' : 'block';

    items.forEach((record) => {
        const card = doc.createElement('section');
        card.className = 'card';

        const name = doc.createElement('h2');
        name.className = 'name';
        name.textContent = record.name;

        const description = doc.createElement('p');
        description.textContent = record.description;

        const fields = doc.createElement('div');
        fields.className = 'fields';
        fields.innerHTML = `<strong>Common fields:</strong> ${record.commonFields.join(', ')}`;

        const actions = doc.createElement('div');
        actions.className = 'actions';

        const insertButton = doc.createElement('button');
        insertButton.textContent = 'Insert Table';
        insertButton.addEventListener('click', () => {
            modal.opener.postMessage({ type: 'INSERT_QUERY_TABLE', tableName: record.name }, window.location.origin);
            modal.focus();
        });

        const starterButton = doc.createElement('button');
        starterButton.className = 'secondary';
        starterButton.textContent = 'Starter Query';
        starterButton.addEventListener('click', () => {
            const starterQuery = `SELECT \nFROM ${record.name}`;
            modal.opener.postMessage({ type: 'SELECT_QUERY', query: starterQuery }, window.location.origin);
            modal.focus();
        });

        actions.appendChild(insertButton);
        actions.appendChild(starterButton);

        card.appendChild(name);
        card.appendChild(description);
        card.appendChild(fields);
        card.appendChild(actions);
        grid.appendChild(card);
    });
};

search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase();
    const filtered = recordsCatalog.filter((record) => {
        return record.name.toLowerCase().includes(term) ||
            record.description.toLowerCase().includes(term) ||
            record.commonFields.some((field) => field.toLowerCase().includes(term));
    });
    renderCatalog(filtered);
});

renderCatalog(recordsCatalog);
}

// Function to run unapplied payments check, it sends mail after the check is successfull
function runUnappliedPaymentsCheck() {
console.log('Running unapplied payments check...');

sendMessageToActiveTab(
    { type: 'RUN_UNAPPLIED_PAYMENTS_CHECK' },
    'Error running the script.'
).then(() => {
    setTimeout(() => {
        alert('Successful!');
    }, 4000);
}).catch(() => {
    hideLoader();
    showError('Error running the script.');
});
}

function cleanSuiteQLQuery(query) {
return query.replace(/```sql|```/g, '').trim();
}

// Function to send a customer record to Salesforce, when the record is synced it will open the account page consisting of that account ID which is created.
function sendCustomerToSalesforce(customerId) {
sendMessageToActiveTab(
    { type: 'SEND_TO_SALESFORCE', customerId: customerId },
    'Error sending customer to Salesforce.'
).catch(() => {
    hideLoader();
    showError('Error sending customer to Salesforce.');
});
}

// Function to fetch all fields from the current record, currently works for main transaction records
function fetchAllFieldsFromCurrentRecord() {
sendMessageToActiveTab(
    { type: 'FETCH_ALL_FIELDS' },
    'Error fetching fields from the current record.'
).catch(() => {
    hideLoader();
    showError('Error fetching fields from the current record.');
});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message.type === 'ACCOUNT_ID') {
        const accountId = message.accountId;
        console.log('Account ID received in popup:', accountId);
    }
if (message.type === 'QUERY_RESULTS') {
    console.log('Received query results:', message.data);
    try {
        const results = JSON.parse(message.data);
        openResultsInNewTab(results);
    } catch (error) {
        document.getElementById('output').textContent = message.data;
        showError('Query execution returned an error.');
    }
    hideLoader(); 
} else if (message.type === 'FIELDS_FETCHED') {
    const fields = message.data;
    document.getElementById('output').textContent = JSON.stringify(fields, null, 2);
    hideLoader();
} else if (message.type === 'FIELDS_FETCH_ERROR') {
    showError('Error fetching fields: ' + message.error);
    hideLoader();
}  else if (message.type === 'CUSTOM_SCRIPT_RESULT') {
    hideLoader();
    const { success, value, error } = message.result;
    if (success) {
      // show whatever the script returned
      document.getElementById('output').textContent = JSON.stringify(value, null, 2);
    } else {
      showError('Script error: ' + error);
    }
  }
});

// Function to save the query to history
function saveQueryToHistory(query) {
const history = JSON.parse(localStorage.getItem('queryHistory')) || [];
if (!history.includes(query)) {
    history.unshift(query);
    if (history.length > 10) {
        history.pop();
    }
    localStorage.setItem('queryHistory', JSON.stringify(history));
    loadQueryHistory();
}
}

// Loading query history 
function loadQueryHistory() {
const history = JSON.parse(localStorage.getItem('queryHistory')) || [];
const historyDropdown = document.getElementById('queryHistory');
historyDropdown.innerHTML = '<option value="" disabled selected>Select a previous query...</option>'; // Reset options

history.forEach(query => {
    const option = document.createElement('option');
    option.value = query;
    option.textContent = query.length > 50 ? query.substring(0, 47) + '...' : query;
    historyDropdown.appendChild(option);
});
}

const clickableColumns = {
entity: (id) => `https://${accountId}.app.netsuite.com/app/common/entity/custjob.nl?id=${id}`,
id: (id, recordType) => {
    switch (recordType) {
        case 'CustomField':
            return `https://${accountId}.app.netsuite.com/app/common/custom/bodycustfield.nl?id=${id}`;
        case 'SalesOrd':
            return `https://${accountId}.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}&whence=`;
        case 'RtnAuth':
            return `https://${accountId}.app.netsuite.com/app/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
        case 'employee':
            return `https://${accountId}.app.netsuite.com/app/common/entity/employee.nl?id=${id}`;
        default:
            return `https://${accountId}.app.netsuite.com/app/common/custom/${recordType}.nl?id=${id}`;
    }
},
transaction: (id, type) => {
    if (type === 'SalesOrd') {
        return `https://${accountId}.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}&whence=`;
    } else if (type === 'RtnAuth') {
        return `https://${accountId}.app.netsuite.com/app/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
    }
    return null;
}
};

function openResultsInNewTab(results) {

chrome.tabs.create({ url: 'results.html' }, function (tab) {
 
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tabInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.sendMessage(tab.id, { type: 'QUERY_RESULTS', data: results });
            chrome.tabs.sendMessage(tab.id, { type: 'ACCOUNT_ID', data: accountId})
        }
    });
});
}
