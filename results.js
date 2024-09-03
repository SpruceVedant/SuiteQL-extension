window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const results = JSON.parse(decodeURIComponent(urlParams.get('results')));

    function displayResultsInTable(results) {
        const output = document.getElementById('output');
        output.innerHTML = '';  // Clear previous results

        if (Array.isArray(results) && results.length > 0) {
            const table = document.createElement('table');

            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            Object.keys(results[0]).forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Create table body
            const tbody = document.createElement('tbody');
            results.forEach(result => {
                const row = document.createElement('tr');
                Object.values(result).forEach(value => {
                    const td = document.createElement('td');
                    td.textContent = value !== null ? value : '';  // Handle null values
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });
            table.appendChild(tbody);

            output.appendChild(table);
        } else {
            output.textContent = 'No results found or an error occurred.';
        }
    }

    displayResultsInTable(results);
};
