document.addEventListener('DOMContentLoaded', () => {
    loadQueryHistory();

    // Run SuiteQL query or convert natural language and run the query
    document.getElementById('runQuery').addEventListener('click', async () => {
        const query = document.getElementById('query').value;

        if (query) {
            saveQueryToHistory(query);
            showLoader();

            // Check if the query looks like natural language (not starting with typical SQL keywords)
            const isNaturalLanguage = !query.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i);

            if (isNaturalLanguage) {
                // It's natural language, so convert it to SuiteQL using OpenAI API
                try {
                    const suiteQLQuery = await convertNaturalLanguageToSuiteQL(query);
                    console.log('Converted SuiteQL Query:', suiteQLQuery);

                    // Run the converted SuiteQL query
                    runQuery(suiteQLQuery);
                } catch (error) {
                    console.error('Error converting natural language to SuiteQL:', error);
                    showError('Failed to convert natural language to SuiteQL.');
                    hideLoader();
                }
            } else {
                // It's already SuiteQL, so run it directly
                runQuery(query);
            }
        }
    });

    // Load query from history
    document.getElementById('queryHistory').addEventListener('change', (event) => {
        const selectedQuery = event.target.value;
        if (selectedQuery) {
            document.getElementById('query').value = selectedQuery;
        }
    });

    // Existing event listeners (for scripts, Salesforce, fetch fields, etc.)
    document.getElementById('runScript').addEventListener('click', () => {
        const script = document.getElementById('scriptSelect').value;
        if (script) {
            showLoader();
            if (script === 'checkUnappliedPayments') {
                runUnappliedPaymentsCheck();
            }
        }
    });

    document.getElementById('sendToSalesforce').addEventListener('click', () => {
        const customerId = document.getElementById('customerId').value;
        if (!customerId) {
            showError('Please enter a valid Customer ID.');
            return;
        }

        showLoader();
        sendCustomerToSalesforce(customerId);
    });

    document.getElementById('fetchFields').addEventListener('click', () => {
        showLoader();
        fetchAllFieldsFromCurrentRecord();
    });
});

// Show and hide loader functions
function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Show error message function
function showError(message) {
    const errorBox = document.getElementById('errorBox');
    errorBox.textContent = message;
    errorBox.style.display = 'block';

    setTimeout(() => {
        errorBox.style.display = 'none';
    }, 5000);
}

// Run SuiteQL query function (executed after conversion or directly)
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

// Convert natural language to SuiteQL function using OpenAI API
async function convertNaturalLanguageToSuiteQL(naturalLanguageQuery) {
    const openAiApiKey = ''; // Replace with your OpenAI API key

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


// Run unapplied payments check function
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
function cleanSuiteQLQuery(query) {
    // Remove code block markers (```sql and ```) and any extra whitespace
    return query.replace(/```sql|```/g, '').trim();
}
// Send customer record to Salesforce function
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

// Fetch all fields from the current record function
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

// Save query to history
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

// Load query history
function loadQueryHistory() {
    const history = JSON.parse(localStorage.getItem('queryHistory')) || [];
    const historyDropdown = document.getElementById('queryHistory');
    historyDropdown.innerHTML = '<option value="" disabled selected>Select a previous query...</option>';

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
