document.addEventListener('DOMContentLoaded', () => {
    loadQueryHistory();
    const queryInput = document.getElementById('query');
    const suggestionsBox = document.getElementById('suggestions');
    
    
    const fields = ['id', 'entity', 'trandate', 'amount', 'status', 'location'];
    const tables = ['transaction', 'customer', 'item', 'employee', 'SalesOrd', 'invoice', 'entity'];
    
    console.log("Popup loaded, ready to handle inputs."); 
    
    queryInput.addEventListener('input', function () {
        const queryText = queryInput.value.trim().toUpperCase();
        console.log("Current Query Text:", queryText);
    
        
        const isAfterSelect = queryText.startsWith('SELECT ') || queryText.startsWith('SELECT');
        const isAfterFrom = queryText.includes(' FROM ');
    
        console.log("isAfterSelect:", isAfterSelect, "isAfterFrom:", isAfterFrom); 
    
        let suggestions = [];
        let lastWord = queryText.split(' ').pop();
    
        console.log("Last Word for Matching:", lastWord);
        if (isAfterSelect && !isAfterFrom) {
           
            if (queryText.trim() === 'SELECT') {
              
                suggestions = fields;
            } else if (queryText.startsWith('SELECT ')) {
                lastWord = queryText.replace('SELECT ', '').split(',').pop().trim();
                suggestions = fields.filter(field => field.toUpperCase().startsWith(lastWord));
            }
            console.log("Field Suggestions:", suggestions); 
        } else if (isAfterFrom) {
          
            const tableMatch = queryText.split('FROM').pop().trim().split(' ')[0]; 
            suggestions = tables.filter(table => table.toUpperCase().startsWith(tableMatch));
            console.log("Table Suggestions:", suggestions); 
        }
    
      
        showSuggestions(suggestions);
    });
    
    
    function showSuggestions(suggestions) {
        if (suggestions.length === 0) {
            console.log("No suggestions available."); 
            suggestionsBox.style.display = 'none';
            return;
        }
    
        suggestionsBox.innerHTML = '';
        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.textContent = suggestion;
            div.addEventListener('click', () => {
                let currentQuery = queryInput.value.trim();
                let queryParts = currentQuery.split(' ');
    
                if (queryParts.includes('FROM')) {
                   
                    queryParts = currentQuery.split('FROM');
                    currentQuery = `${queryParts[0]} FROM ${suggestion}`;
                } else {
                  
                    currentQuery += ` ${suggestion}`;
                }
    
                queryInput.value = currentQuery.trim() + ' ';
                suggestionsBox.style.display = 'none';
                queryInput.focus();  
                console.log("Suggestion selected:", suggestion);  
            });
            suggestionsBox.appendChild(div);
        });
    
        console.log("Suggestions shown."); 
        suggestionsBox.style.display = 'block';
    }
    
    // Add hierarchy button functionality
    document.getElementById('fetchHierarchy').addEventListener('click', () => {
        const recordId = prompt("Enter the Record ID to fetch hierarchy:");
        if (recordId) {
            showLoader();
    
            // Send message to fetch hierarchy for the given record ID
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: (recordId) => {
                        window.postMessage({ type: 'FETCH_HIERARCHY', recordId: recordId }, '*');
                    },
                    args: [recordId]
                }, () => {
                    if (chrome.runtime.lastError) {
                        hideLoader();
                        showError('Error initiating the hierarchy fetch.');
                    }
                });
            });
        }
    });
    
    // Listen for hierarchy results from injected script
    window.addEventListener('message', function(event) {
        if (event.data.type === 'HIERARCHY_RESULT') {
            hideLoader();
            const hierarchy = event.data.hierarchy;
    
            if (!hierarchy || hierarchy.children.length === 0) {
                alert('No dependent records found for the specified record.');
            } else {
                // Open new tab to display the hierarchy
                chrome.tabs.create({ url: 'index.html' }, function(tab) {
                    // Send hierarchy data to new tab
                    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
                        if (tabId === tab.id && changeInfo.status === 'complete') {
                            console.log('Sending hierarchy to new tab:', hierarchy);
                            chrome.tabs.sendMessage(tab.id, { type: 'DISPLAY_HIERARCHY', hierarchy: hierarchy });
                        }
                    });
                });
            }
        }
    });
    
    
    // Function to display hierarchy in the UI
    // function displayHierarchyInUI(hierarchy) {
    //     const hierarchyDisplay = document.getElementById('hierarchyDisplay');
    //     hierarchyDisplay.innerHTML = ''; // Clear previous content
    
    //     const ul = document.createElement('ul');
    //     buildHierarchyUI(hierarchy, ul);
    //     hierarchyDisplay.appendChild(ul);
    // }
    
    // // Recursive function to build hierarchy UI
    // function buildHierarchyUI(node, parentElement) {
    //     const li = document.createElement('li');
    //     li.textContent = `Record ID: ${node.id}, Type: ${node.type}`;
    //     li.classList.add('record-details');
    //     li.style.cursor = 'pointer';
    //     li.addEventListener('click', () => {
    //         alert(`Record Details:\nID: ${node.id}\nType: ${node.type}`);
    //     });
    //     parentElement.appendChild(li);
    
    //     if (node.children && node.children.length > 0) {
    //         const ul = document.createElement('ul');
    //         ul.style.display = 'none';  // Hide children by default
    
    //         // Toggle display on click
    //         li.addEventListener('click', () => {
    //             ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
    //         });
    
    //         node.children.forEach(child => buildHierarchyUI(child, ul));
    //         li.appendChild(ul);
    //     }
    // }
    
    document.addEventListener('click', function (event) {
        if (!event.target.closest('#suggestions') && !event.target.closest('#query')) {
            suggestionsBox.style.display = 'none';
        }
    });
    document.getElementById('runQuery').addEventListener('click',async () => {
        const query = document.getElementById('query').value;
        if (query) {
            saveQueryToHistory(query);
            showLoader();
    
            const isNaturalLanguage = !query.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i);
    
            if (isNaturalLanguage) {
                
                try {
                    const suiteQLQuery = await convertNaturalLanguageToSuiteQL(query);
                    console.log('Converted SuiteQL Query:', suiteQLQuery);
    
                    
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
            document.getElementById('query').value = selectedQuery;
        }
    });
    
    document.getElementById('runScript').addEventListener('click', () => {
        const script = document.getElementById('scriptSelect').value;
        if (script) {
            if (script === 'checkUnappliedPayments') {
                showLoader(); 
                runUnappliedPaymentsCheck();
            }
        }
    });
    
    // Salesforce integration event listener for syncing customer to as an account in Salesforce, 
    document.getElementById('sendToSalesforce').addEventListener('click', () => {
        const customerId = document.getElementById('customerId').value;
        if (!customerId) {
            showError('Please enter a valid Customer ID.');
            return;
        }
    
        showLoader();
        sendCustomerToSalesforce(customerId);
    });
    
    // Event listener to fetch all fields from the current record
    document.getElementById('fetchFields').addEventListener('click', () => {
        showLoader();
        fetchAllFieldsFromCurrentRecord();
    });
    
        
        document.getElementById('openQueryLibrary').addEventListener('click', openQueryLibraryModal);
    
        
        window.addEventListener('message', (event) => {
            if (event.origin === window.location.origin && event.data.type === 'SELECT_QUERY') {
                document.getElementById('query').value = event.data.query;
            }
        });
    
        document.addEventListener('DOMContentLoaded', () => {
            // Load saved shortcuts or settings for  default
            const defaultShortcuts = {
                salesOrder: 'Alt+S',
                invoices: 'Alt+I',
                purchaseOrder: 'Alt+P',
                customers: 'Alt+C',
                ScriptUpload: 'Alt+U'
            };
        
            const savedShortcuts = JSON.parse(localStorage.getItem('shortcuts')) || defaultShortcuts;
        
            // settings (page/modal):
            document.getElementById('salesOrderShortcut').value = savedShortcuts.salesOrder;
            document.getElementById('invoiceShortcut').value = savedShortcuts.invoices;
            document.getElementById('purchaseOrderShortcut').value = savedShortcuts.purchaseOrder;
            document.getElementById('customersShortcut').value = savedShortcuts.customers;
        
            // TO save shortcuts when users update them
            document.getElementById('saveShortcuts').addEventListener('click', () => {
                const newShortcuts = {
                    salesOrder: document.getElementById('salesOrderShortcut').value,
                    invoices: document.getElementById('invoiceShortcut').value,
                    purchaseOrder: document.getElementById('purchaseOrderShortcut').value,
                    customers: document.getElementById('customersShortcut').value,
                    ScriptUpload: document.getElementById('ScriptUploadShortcut').value
                };
                localStorage.setItem('shortcuts', JSON.stringify(newShortcuts));
                alert('Shortcuts updated!');
            });
        });
    });
    
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
    
    //SuiteQL ENtry point main function
    function runQuery(query) {
    console.log('Sending query:', query);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (query) => {
                window.postMessage({ type: 'RUN_QUERY', query: query }, '*');
            },
            args: [query]
        }, () => {
            if (chrome.runtime.lastError) {
                hideLoader(); 
                showError('Error executing the query. Please check the syntax.');
            }
        });
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
    
    //modal window
    const modal = window.open('', '_blank', 'width=600,height=400');
    modal.document.write('<html><head><title>Query Library</title></head><body>');
    modal.document.write('<h2>Select a Query</h2>');
    
    const libraryContainer = modal.document.createElement('div');
    libraryContainer.id = 'libraryContainer';
    modal.document.body.appendChild(libraryContainer);
    
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
    
    // Function to run unapplied payments check, it sends mail after the check is successfull
    function runUnappliedPaymentsCheck() {
    console.log('Running unapplied payments check...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
                window.postMessage({ type: 'RUN_UNAPPLIED_PAYMENTS_CHECK' }, '*');
            }
        }, () => {
            if (chrome.runtime.lastError) {
                hideLoader(); 
                showError('Error running the script.');
            }
        });
        setTimeout(() => {
            alert('Successful!');
            }, 4000);
    });
    }
    
    function cleanSuiteQLQuery(query) {
    return query.replace(/```sql|```/g, '').trim();
    }
    
    // Function to send a customer record to Salesforce, when the record is synced it will open the account page consisting of that account ID which is created.
    function sendCustomerToSalesforce(customerId) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (customerId) => {
                window.postMessage({ type: 'SEND_TO_SALESFORCE', customerId: customerId }, '*');
            },
            args: [customerId]
        }, () => {
            if (chrome.runtime.lastError) {
                hideLoader(); 
                showError('Error sending customer to Salesforce.');
            }
        });
    });
    }
    
    // Function to fetch all fields from the current record, currently works for main transaction records
    function fetchAllFieldsFromCurrentRecord() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
                window.postMessage({ type: 'FETCH_ALL_FIELDS' }, '*');
            }
        }, () => {
            if (chrome.runtime.lastError) {
                hideLoader();
                showError('Error fetching fields from the current record.');
            }
        });
    });
    }
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'QUERY_RESULTS') {
        console.log('Received query results:', message.data);
        const results = JSON.parse(message.data);
        openResultsInNewTab(results);
        hideLoader(); 
    } else if (message.type === 'UNAPPLIED_PAYMENTS_RESULT') {
        console.log('Received unapplied payments result:', message.data);
        document.getElementById('output').textContent = message.data;
        hideLoader(); 
        console.log('Loader should stop!!!')
    } else if (message.type === 'SALESFORCE_SUCCESS') {
        document.getElementById('output').textContent = message.text;
        if (message.salesforceAccountId) {
            const salesforceUrl = `https://blueflamelabs-7d-dev-ed.develop.lightning.force.com/lightning/r/Account/${message.salesforceAccountId}/view`;
            // window.open(salesforceUrl, '_blank');  // Opens the Salesforce account page in a new tab
            window.location.href = salesforceUrl ;
    
            document.getElementById('output').textContent = message.text;
        } else {
            console.error('Salesforce Account ID not provided.');
        }
        alert('Successful!');
        hideLoader(); 
    } else if (message.type === 'SALESFORCE_ERROR') {
        showError(message.text);
        hideLoader(); 
    } else if (message.type === 'FIELDS_FETCHED') {
        const fields = message.data;
        document.getElementById('output').textContent = JSON.stringify(fields, null, 2);
        hideLoader();
    } else if (message.type === 'FIELDS_FETCH_ERROR') {
        showError('Error fetching fields: ' + message.error);
        hideLoader();
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
    entity: (id) => `https://td2929968.app.netsuite.com/app/common/entity/custjob.nl?id=${id}`,
    id: (id, recordType) => {
        switch (recordType) {
            case 'CustomField':
                return `https://td2929968.app.netsuite.com/app/common/custom/bodycustfield.nl?id=${id}`;
            case 'SalesOrd':
                return `https://td2929968.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}&whence=`;
            case 'RtnAuth':
                return `https://td2929968.app.netsuite.com/app/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
            case 'employee':
                return `https://td2929968.app.netsuite.com/app/common/entity/employee.nl?id=${id}`;
            default:
                return `https://td2929968.app.netsuite.com/app/common/custom/${recordType}.nl?id=${id}`;
        }
    },
    transaction: (id, type) => {
        if (type === 'SalesOrd') {
            return `https://td2929968.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}&whence=`;
        } else if (type === 'RtnAuth') {
            return `https://td2929968.app.netsuite.com/app/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
        }
        return null;
    }
    };
    
    function openResultsInNewTab(results) {
    
    chrome.tabs.create({ url: 'results.html' }, function (tab) {
     
        chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tabInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.sendMessage(tab.id, { type: 'QUERY_RESULTS', data: results });
            }
        });
    });
    }