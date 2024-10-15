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
                chrome.tabs.create({ url: 'results.html' }, function(tab) {
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
});
