document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, waiting for result...');  // Debugging log

    // Listen for the result message from the content script or background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Received message in results.html:', message);  // Debugging log

        const resultContainer = document.getElementById('resultsContainer');
        
        if (!resultContainer) {
            console.error('Result container not found!');  // Debugging log if element doesn't exist
            return;
        }

        console.log('Result container found, updating with result:', message.result);  // Debugging log

        // Clear previous content
        resultContainer.textContent = '';

        // If the result is an array of objects (like your sales orders), display them as a list
        if (Array.isArray(message.result)) {
            const table = document.createElement('table');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.border = '1px solid #ddd';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            // Add headers
            ['Transaction ID', 'Total'].forEach(header => {
                const th = document.createElement('th');
                th.style.border = '1px solid #ddd';
                th.style.padding = '8px';
                th.style.backgroundColor = '#007bff';
                th.style.color = 'white';
                th.textContent = header;
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Add rows for each result
            const tbody = document.createElement('tbody');
            message.result.forEach(order => {
                const row = document.createElement('tr');

                const tdTranid = document.createElement('td');
                tdTranid.style.border = '1px solid #ddd';
                tdTranid.style.padding = '8px';
                tdTranid.textContent = order.tranid || 'N/A';

                const tdTotal = document.createElement('td');
                tdTotal.style.border = '1px solid #ddd';
                tdTotal.style.padding = '8px';
                tdTotal.textContent = order.total || 'N/A';

                row.appendChild(tdTranid);
                row.appendChild(tdTotal);
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            resultContainer.appendChild(table);
        } else {
            // For non-object results, just display the result as text
            resultContainer.textContent = message.result;
        }
    });
});
