document.addEventListener('DOMContentLoaded', () => {
    loadQueryHistory();

    document.getElementById('runQuery').addEventListener('click', () => {
        const query = document.getElementById('query').value;
        if (query) {
            saveQueryToHistory(query);
            showLoader();
            runQuery(query);
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

    // Salesforce integration event listener
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

        // Open the query library modal
        document.getElementById('openQueryLibrary').addEventListener('click', openQueryLibraryModal);

        // Listen for messages from the query library modal
        window.addEventListener('message', (event) => {
            if (event.origin === window.location.origin && event.data.type === 'SELECT_QUERY') {
                document.getElementById('query').value = event.data.query;
            }
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

// Function to run SuiteQL query
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


    ];

    // Open the modal window
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

// Function to run unapplied payments check
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
    });
}

// Function to send a customer record to Salesforce
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

// Function to fetch all fields from the current record
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
        openResultsInNewWindow(results);
        hideLoader(); 
    } else if (message.type === 'UNAPPLIED_PAYMENTS_RESULT') {
        console.log('Received unapplied payments result:', message.data);
        document.getElementById('output').textContent = message.data;
        hideLoader(); 
    } else if (message.type === 'SALESFORCE_SUCCESS') {
        document.getElementById('output').textContent = message.text;
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

// Loading query history into the dropdown
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

function openResultsInNewWindow(results) {
    const newWindow = window.open('', '_blank', 'width=800,height=600');
    const doc = newWindow.document;

    doc.write('<html><head><title>Query Results</title></head><body>');
    doc.write('<h2>Query Results</h2>');

    const exportButtons = doc.createElement('div');
    exportButtons.id = 'exportButtons';
    exportButtons.style.position = 'fixed';
    exportButtons.style.top = '10px';
    exportButtons.style.right = '10px';

    const exportToCSV = doc.createElement('button');
    exportToCSV.id = 'exportToCSV';
    exportToCSV.textContent = 'Export to CSV';

    const exportToExcel = doc.createElement('button');
    exportToExcel.id = 'exportToExcel';
    exportToExcel.textContent = 'Export to Excel';

    const exportToPDF = doc.createElement('button');
    exportToPDF.id = 'exportToPDF';
    exportToPDF.textContent = 'Export to PDF';

    exportButtons.appendChild(exportToCSV);
    exportButtons.appendChild(exportToExcel);
    exportButtons.appendChild(exportToPDF);
    doc.body.appendChild(exportButtons);

    const itemsPerPage = 50;
    let currentPage = 1;
    const totalPages = Math.ceil(results.length / itemsPerPage);

    function renderTable(page) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const rowsToDisplay = results.slice(startIndex, endIndex);

        const table = doc.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.border = '1px solid #ddd';

        const thead = doc.createElement('thead');
        const headerRow = doc.createElement('tr');
        Object.keys(results[0]).forEach(key => {
            const th = doc.createElement('th');
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.backgroundColor = '#007bff';
            th.style.color = 'white';
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = doc.createElement('tbody');
        const fragment = doc.createDocumentFragment();

        rowsToDisplay.forEach(result => {
            const row = doc.createElement('tr');
            Object.entries(result).forEach(([key, value]) => {
                const td = doc.createElement('td');
                td.style.border = '1px solid #ddd';
                td.style.padding = '8px';

                let linkUrl = null;
                if (clickableColumns[key]) {
                    if (key === 'id') {
                        linkUrl = clickableColumns[key](value, result['type'] || result['recordType']);
                    } else if (key === 'transaction' && result['type']) {
                        linkUrl = clickableColumns[key](value, result['type']);
                    } else {
                        linkUrl = clickableColumns[key](value);
                    }

                    if (linkUrl) {
                        const link = doc.createElement('a');
                        link.href = linkUrl;
                        link.target = '_blank';
                        link.textContent = value !== null ? value : '';
                        link.style.color = '#007bff';
                        link.style.textDecoration = 'underline';
                        td.appendChild(link);
                    } else {
                        td.textContent = value !== null ? value : '';
                    }
                } else {
                    td.textContent = value !== null ? value : '';
                }

                row.appendChild(td);
            });
            fragment.appendChild(row);
        });
        tbody.appendChild(fragment);
        table.appendChild(tbody);

        doc.body.innerHTML = '';
        doc.body.appendChild(exportButtons);
        doc.body.appendChild(table);

        renderPagination();
    }

    function renderPagination() {
        const pagination = doc.createElement('div');
        pagination.style.textAlign = 'center';
        pagination.style.marginTop = '20px';

        for (let i = 1; i <= totalPages; i++) {
            const pageLink = doc.createElement('button');
            pageLink.textContent = i;
            pageLink.style.margin = '0 5px';
            pageLink.style.padding = '5px 10px';
            pageLink.style.border = i === currentPage ? '2px solid #007bff' : '1px solid #ddd';
            pageLink.style.backgroundColor = i === currentPage ? '#007bff' : '#fff';
            pageLink.style.color = i === currentPage ? '#fff' : '#000';
            pageLink.style.cursor = 'pointer';

            pageLink.addEventListener('click', () => {
                currentPage = i;
                renderTable(currentPage);
            });

            pagination.appendChild(pageLink);
        }

        doc.body.appendChild(pagination);
    }

    renderTable(currentPage);

    exportToCSV.addEventListener('click', function() {
        const headers = Object.keys(results[0]).join(',');
        const csvContent = results.map(row => Object.values(row).map(value => value !== null ? `"${value}"` : '').join(',')).join('\n');
        const csvBlob = new Blob([`${headers}\n${csvContent}`], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);

        const a = doc.createElement('a');
        a.href = csvUrl;
        a.download = 'query_results.csv';
        a.click();
    });

    exportToExcel.addEventListener('click', function() {
        const headers = Object.keys(results[0]).join('</td><td>');
        const excelContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet 1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
            <body>
            <table>
                <tr><td>${headers}</td></tr>
                ${results.map(row => '<tr>' + Object.values(row).map(value => `<td>${value !== null ? value : ''}</td>`).join('') + '</tr>').join('')}
            </table>
            </body>
            </html>`;
        const excelBlob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
        const excelUrl = URL.createObjectURL(excelBlob);

        const a = doc.createElement('a');
        a.href = excelUrl;
        a.download = 'query_results.xls';
        a.click();
    });

    exportToPDF.addEventListener('click', function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const rows = results.map(row => Object.values(row).map(value => value !== null ? value : ''));
        doc.autoTable({ head: [Object.keys(results[0])], body: rows });
        doc.save('query_results.pdf');
    });

    doc.write(`
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.14/jspdf.plugin.autotable.min.js"></script>
    `);

    doc.write('</body></html>');
    doc.close();
}
