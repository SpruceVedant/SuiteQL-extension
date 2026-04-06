document.addEventListener('DOMContentLoaded', () => {
    loadQueryHistory();

    document.getElementById('runQuery').addEventListener('click', () => {
        const query = document.getElementById('query').value;
        if (query) {
            saveQueryToHistory(query);
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
                runUnappliedPaymentsCheck(); 
            }
        }
    });
});

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
        });
    });
}

function runUnappliedPaymentsCheck() {
    console.log('Running unapplied payments check...');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
                window.postMessage({ type: 'RUN_UNAPPLIED_PAYMENTS_CHECK' }, '*');
            }
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'QUERY_RESULTS') {
        console.log('Received query results:', message.data);
        const results = JSON.parse(message.data);
        openResultsInNewWindow(results);
    } else if (message.type === 'UNAPPLIED_PAYMENTS_RESULT') {
        console.log('Received unapplied payments result:', message.data);
        document.getElementById('output').textContent = message.data;
    }
});

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
    entity: (id) => `https://..app.netsuite.com/app/common/entity/custjob.nl?id=${id}`,
    id: (id, recordType) => {
        switch (recordType) {
            case 'CustomField':
                return `https://..app.netsuite.com/app/common/custom/bodycustfield.nl?id=${id}`;
            case 'SalesOrd':
                return `https://..app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}&whence=`;
            case 'RtnAuth':
                return `https://..app.netsuite.com/app/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
            case 'employee':
                return `https://..app.netsuite.com/app/common/entity/employee.nl?id=${id}`;
            default:
                return `https://..app.netsuite.com/app/common/custom/${recordType}.nl?id=${id}`;
        }
    },
    transaction: (id, type) => {
        if (type === 'SalesOrd') {
            return `https://..app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}&whence=`;
        } else if (type === 'RtnAuth') {
            return `https://..app.netsuite.com/app/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
        }
        return null;
    }
};

function openResultsInNewWindow(results) {
    const newWindow = window.open('', '_blank', 'width=800,height=600');
    const doc = newWindow.document;

    doc.write(`
        <html>
        <head>
            <title>Query Results</title>
            <link rel="stylesheet" href="/libs/datatables.min.css">
            <script src="/libs/jquery.min.js"></script>
            <script src="/libs/datatables.min.js"></script>
        </head>
        <body>
        <h2>Query Results</h2>
        <div id="exportButtons" style="position: fixed; top: 10px; right: 10px;">
            <button id="exportToCSV">Export to CSV</button>
            <button id="exportToExcel">Export to Excel</button>
            <button id="exportToPDF">Export to PDF</button>
        </div>
    `);

    if (Array.isArray(results) && results.length > 0) {
        const tableHtml = `
            <table id="resultsTable" class="display" style="width:100%">
                <thead>
                    <tr>${Object.keys(results[0]).map(key => `<th>${key}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            ${Object.entries(result).map(([key, value]) => {
                                let linkUrl = null;
                                if (clickableColumns[key]) {
                                    if (key === 'id') {
                                        linkUrl = clickableColumns[key](value, result['type'] || result['recordType']);
                                    } else if (key === 'transaction' && result['type']) {
                                        linkUrl = clickableColumns[key](value, result['type']);
                                    } else {
                                        linkUrl = clickableColumns[key](value);
                                    }

                                    return linkUrl
                                        ? `<td><a href="${linkUrl}" target="_blank" style="color:#007bff; text-decoration:underline;">${value !== null ? value : ''}</a></td>`
                                        : `<td>${value !== null ? value : ''}</td>`;
                                } else {
                                    return `<td>${value !== null ? value : ''}</td>`;
                                }
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        doc.write(tableHtml);

        doc.write(`
            <script>
                $(document).ready(function() {
                    $('#resultsTable').DataTable();
                });
            </script>
        `);
    } else {
        doc.write('<p>No results found or an error occurred.</p>');
    }

    doc.write(`
        <script src="libs/jspdf.umd.min.js"></script>
        <script src="libs/jspdf.plugin.autotable.min.js"></script>
        <script>
            document.getElementById('exportToCSV').addEventListener('click', function() {
                const csvContent = results.map(row => Object.values(row).map(value => \`"\${value}"\`).join(',')).join('\\n');
                const csvBlob = new Blob([csvContent], { type: 'text/csv' });
                const csvUrl = URL.createObjectURL(csvBlob);
                const a = document.createElement('a');
                a.href = csvUrl;
                a.download = 'query_results.csv';
                a.click();
            });

          
                const excelBlob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
                const excelUrl = URL.createObjectURL(excelBlob);
                const a = document.createElement('a');
                a.href = excelUrl;
                a.download = 'query_results.xls';
                a.click();
            });

            document.getElementById('exportToPDF').addEventListener('click', function() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                doc.autoTable({ head: [${JSON.stringify(Object.keys(results[0]))}], body: ${JSON.stringify(results.map(row => Object.values(row)))} });
                doc.save('query_results.pdf');
            });
        </script>
        </body>
        </html>
    `);

    doc.close();
}
