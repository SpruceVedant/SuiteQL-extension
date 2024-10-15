let accountId = '';

chrome.runtime.sendMessage({ type: 'GET_ACCOUNT_ID' }, (response) => {
    accountId = response.accountId;
    if (accountId) {
        console.log('Account ID retrieved from background script:', accountId);
        initializePage();
    } else {
        console.error('Account ID is not available.');
    }
});

function initializePage() {
 
    displayResults(currentPage);
    setupSearch(filteredResults);
    setupPagination(filteredResults);
    setupExportButtons(filteredResults);
}
let currentPage = 1;
let rowsPerPage = 10; 
let filteredResults = [];


const rowsPerPageSelect = document.getElementById('rowsPerPage');
if (rowsPerPageSelect) {
    rowsPerPageSelect.addEventListener('change', (event) => {
        rowsPerPage = parseInt(event.target.value);
        currentPage = 1;  
        displayResults(currentPage);
        setupPagination(filteredResults);
    });
} else {
    console.error('Dropdown with id "rowsPerPage" not found.');
}

// Waiting for the message from the popup with the query results
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'QUERY_RESULTS') {
        const results = message.data;
        filteredResults = results;  // Initially, filteredResults are the same as results
        displayResults(currentPage);
        setupSearch(results);
        setupPagination(results);
        displayResultCount(filteredResults.length);
        setupExportButtons(results);  
        sendResponse({ status: 'success' });
    }
    if (message.type === 'ACCOUNT_ID') {
        accountId = message.accountId;
        console.log("Account ID received:", accountId);
    }
});


// // Fetching accountId from IndexedDB
// function getFromIndexedDB(key) {
//     return new Promise((resolve, reject) => {
//         openIndexedDB().then((db) => {
//             const transaction = db.transaction('settings', 'readonly');
//             const store = transaction.objectStore('settings');
//             const request = store.get(key);
//             request.onsuccess = (event) => {
//                 if (event.target.result) {
//                     resolve(event.target.result.value);
//                 } else {
//                     reject(`No data found for ${key}`);
//                 }
//             };
//             request.onerror = () => reject('Error retrieving data from IndexedDB');
//         });
//     });
// }

// function openIndexedDB() {
//     return new Promise((resolve, reject) => {
//         const request = indexedDB.open('MyExtensionDB', 1);
//         request.onupgradeneeded = function(event) {
//             const db = event.target.result;
//             if (!db.objectStoreNames.contains('settings')) {
//                 db.createObjectStore('settings', { keyPath: 'key' });
//             }
//         };
//         request.onsuccess = function(event) {
//             resolve(event.target.result);
//         };
//         request.onerror = function(event) {
//             reject('Error opening IndexedDB');
//         };
//     });
// }

// let accountId = '';
// getFromIndexedDB('accountId').then((id) => {
//     accountId = id;
//     console.log('Account ID retrieved from IndexedDB:', accountId);
// }).catch((error) => {
//     console.error(error);
// });

function displayResults(page) {
    const table = document.getElementById('resultsTable');
    table.innerHTML = '';  

    if (filteredResults.length === 0) {
        table.innerHTML = '<tr><td>No results found</td></tr>';
        return;
    }

    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredResults.length);
    const rowsToDisplay = filteredResults.slice(startIndex, endIndex);

    const headers = Object.keys(filteredResults[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    rowsToDisplay.forEach(result => {
        const row = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = result[header] || '';

            if (header === 'id' || header === 'entity' || header === 'transaction') {
                const recordType = getRecordType(result);
                const linkUrl = generateNetSuiteLink(result[header], recordType);
                if (linkUrl) {
                    const link = document.createElement('a');
                    link.href = linkUrl;
                    link.target = '_blank';
                    link.textContent = result[header];
                    link.style.color = '#007bff';
                    link.style.textDecoration = 'underline';
                    td.innerHTML = '';
                    td.appendChild(link);
                }
            }
            row.appendChild(td);
        });
        table.appendChild(row);
    });
}
function displayJSON(data) {
    const jsonViewer = new JSONViewer();
    const jsonContainer = document.getElementById('jsonContainer');
    jsonContainer.innerHTML = ''; // Clear previous JSON data
    jsonContainer.appendChild(jsonViewer.getContainer());
    jsonViewer.showJSON(data, null, 2);
}

document.getElementById('viewJSON').addEventListener('click', () => {
    document.getElementById('resultsTable').style.display = 'none';
    document.getElementById('jsonContainer').style.display = 'block';
    displayJSON(filteredResults); // Display your JSON data
});
function getRecordType(result) {
    return result['type'] || 'customer';
}

function generateNetSuiteLink(id, recordType) {
    console.log(accountId);
    const baseUrl = "https://"+accountId+".app.netsuite.com/app";
    let url = '';

    switch (recordType) {
        case 'customer':
            url = `${baseUrl}/common/entity/custjob.nl?id=${id}`;
            break;
        case 'SalesOrd':
            url = `${baseUrl}/accounting/transactions/salesord.nl?id=${id}&whence=`;
            break;
        case 'invoice':
            url = `${baseUrl}/accounting/transactions/invoice.nl?id=${id}`;
            break;
        case 'RtnAuth':
            url = `${baseUrl}/accounting/transactions/rtnauth.nl?id=${id}&whence=`;
            break;
        case 'employee':
            url = `${baseUrl}/common/entity/employee.nl?id=${id}`;
            break;
        default:
            url = `${baseUrl}/common/entity/custjob.nl?id=${id}`;
            break;
    }
    return url;
}

function setupPagination(results) {
    const totalPages = Math.ceil(results.length / rowsPerPage);
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';  

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('pagination-button');
        if (i === currentPage) {
            pageButton.disabled = true;
        }
        pageButton.addEventListener('click', () => {
            currentPage = i;
            displayResults(currentPage);
            setupPagination(filteredResults);
        });
        pagination.appendChild(pageButton);
    }
}

function displayResultCount(count) {
    const resultCountElement = document.getElementById('resultCount');
    if (resultCountElement) {
        resultCountElement.textContent = `Total Results: ${count}`;
    } else {
        console.error('Result count element not found.');
    }
}

function setupSearch(results) {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function () {
        const query = searchInput.value.toLowerCase();
        filteredResults = results.filter(row => 
            Object.values(row).some(value => value && value.toString().toLowerCase().includes(query))
        );
        currentPage = 1;
        displayResults(currentPage);
        setupPagination(filteredResults);
    });
}

function setupExportButtons(results) {
    const exportToCSVButton = document.getElementById('exportToCSV');
    const exportToExcelButton = document.getElementById('exportToExcel');

    exportToCSVButton.addEventListener('click', function() {
        const csvContent = generateCSVContent(results);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'query_results.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    exportToExcelButton.addEventListener('click', function() {
        const excelContent = generateExcelContent(results);
        const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'query_results.xls';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

function generateCSVContent(results) {
    const headers = Object.keys(results[0]).join(',');
    const rows = results.map(row => 
        Object.values(row).map(value => `"${value !== null ? value : ''}"`).join(',')
    );
    return `${headers}\n${rows.join('\n')}`;
}

function generateExcelContent(results) {
    const headers = Object.keys(results[0]).join('</td><td>');
    const rows = results.map(row => 
        '<tr>' + Object.values(row).map(value => `<td>${value !== null ? value : ''}</td>`).join('') + '</tr>'
    ).join('');
    return `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head><body>
        <table><thead><tr><td>${headers}</td></tr></thead><tbody>${rows}</tbody></table>
        </body></html>
    `;
}
