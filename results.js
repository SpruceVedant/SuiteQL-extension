let accountId = '';
let allResults = [];
let pageInitialized = false;
let searchBound = false;
let exportBound = false;
const RESULTS_PAGE_STATES_KEY = 'suitesenseResultsPageStates';
const resultsStateId = new URLSearchParams(window.location.search).get('state');
const LOCAL_RESULTS_PAGE_PREFIX = 'suitesenseResultsTab:';

restoreResultsPageState().finally(() => {
    chrome.runtime.sendMessage({ type: 'GET_ACCOUNT_ID' }, (response) => {
        if (response && response.accountId) {
            accountId = response.accountId;
            console.log('Account ID retrieved from background script:', accountId);
        }

        initializePage();
    });
});

function getResultsStorageArea() {
    return chrome.storage.session || chrome.storage.local;
}

function readResultsPageStates() {
    return new Promise((resolve) => {
        getResultsStorageArea().get({ [RESULTS_PAGE_STATES_KEY]: {} }, (items) => {
            if (chrome.runtime.lastError) {
                resolve({});
                return;
            }

            const states = items && items[RESULTS_PAGE_STATES_KEY];
            resolve(states && typeof states === 'object' ? states : {});
        });
    });
}

async function restoreResultsPageState() {
    if (resultsStateId) {
        try {
            const localState = localStorage.getItem(`${LOCAL_RESULTS_PAGE_PREFIX}${resultsStateId}`);
            if (localState) {
                const parsed = JSON.parse(localState);
                allResults = Array.isArray(parsed.results) ? parsed.results : [];
                filteredResults = [...allResults];
                if (parsed.accountId) {
                    accountId = parsed.accountId;
                }
                return;
            }
        } catch (error) {
            console.warn('Unable to restore local results tab state.', error);
        }
    }

    if (!resultsStateId) {
        return;
    }

    const states = await readResultsPageStates();
    const state = states[resultsStateId];
    if (!state || typeof state !== 'object') {
        return;
    }

    allResults = Array.isArray(state.results) ? state.results : [];
    filteredResults = [...allResults];
    if (state.accountId) {
        accountId = state.accountId;
    }
}

function persistCurrentResultsTabState() {
    if (!resultsStateId) {
        return;
    }

    try {
        localStorage.setItem(`${LOCAL_RESULTS_PAGE_PREFIX}${resultsStateId}`, JSON.stringify({
            results: allResults,
            accountId,
            savedAt: Date.now()
        }));
    } catch (error) {
        console.warn('Unable to persist local results tab state.', error);
    }
}

function initializePage() {
    if (pageInitialized) {
        renderResultsState();
        return;
    }

    pageInitialized = true;
    displayResults(currentPage);
    setupSearch();
    setupPagination(filteredResults);
    setupExportButtons();
    displayResultCount(filteredResults.length);
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
    if (message.type === 'ACCOUNT_ID') {
        accountId = message.accountId || accountId;
        persistCurrentResultsTabState();
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
document.getElementById('viewTree').addEventListener('click', () => {
    document.getElementById('resultsTable').style.display = 'none';
    document.getElementById('jsonContainer').style.display = 'block';
    displayTreeView(filteredResults); // Render tree based on current filtered results
});

function displayTreeView(data) {
    const jsonContainer = document.getElementById('jsonContainer');
    jsonContainer.innerHTML = ''; // Clear previous tree

    const treeData = formatDataAsTree(data); // Convert data to hierarchical structure

    const margin = {top: 20, right: 90, bottom: 30, left: 90},
          width = 960 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = d3.select(jsonContainer).append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const treemap = d3.tree().size([height, width]);
    const root = d3.hierarchy(treeData);

    treemap(root);

    const link = svg.selectAll(".link")
        .data(root.descendants().slice(1))
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d => `
            M${d.y},${d.x}
            C${(d.y + d.parent.y) / 2},${d.x}
             ${(d.y + d.parent.y) / 2},${d.parent.x}
             ${d.parent.y},${d.parent.x}
        `);

    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
        .attr("transform", d => "translate(" + d.y + "," + d.x + ")");

    node.append("circle").attr("r", 10);
    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -13 : 13)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);
}

function formatDataAsTree(data) {
    
    return { name: "Root", children: data.map(obj => {
        return { name: "Item", children: Object.entries(obj).map(([key, value]) => {
            return { name: `${key}: ${value}` };
        }) };
    }) };
}

document.getElementById('viewTable').addEventListener('click', () => {
    document.getElementById('jsonContainer').style.display = 'none';
    document.getElementById('resultsTable').style.display = 'block';
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

function setupSearch() {
    if (searchBound) {
        return;
    }

    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        return;
    }

    searchBound = true;
    searchInput.addEventListener('input', function () {
        const query = searchInput.value.toLowerCase();
        filteredResults = allResults.filter(row => 
            Object.values(row).some(value => value && value.toString().toLowerCase().includes(query))
        );
        currentPage = 1;
        renderResultsState();
    });
}

function setupExportButtons() {
    if (exportBound) {
        return;
    }

    const exportToCSVButton = document.getElementById('exportToCSV');
    const exportToExcelButton = document.getElementById('exportToExcel');
    if (!exportToCSVButton || !exportToExcelButton) {
        return;
    }

    exportBound = true;

    exportToCSVButton.addEventListener('click', function() {
        const exportResults = filteredResults.length ? filteredResults : allResults;
        if (!exportResults.length) {
            return;
        }
        const csvContent = generateCSVContent(exportResults);
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
        const exportResults = filteredResults.length ? filteredResults : allResults;
        if (!exportResults.length) {
            return;
        }
        const excelContent = generateExcelContent(exportResults);
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

function renderResultsState() {
    displayResults(currentPage);
    setupPagination(filteredResults);
    displayResultCount(filteredResults.length);
}
