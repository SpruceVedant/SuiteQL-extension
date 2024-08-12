document.getElementById('runQuery').addEventListener('click', () => {
    const query = document.getElementById('query').value;

    if (query) {
        const config = {
            ACCOUNT_ID: 'TD2929968',
            CONSUMER_KEY: 'a3352c15dae2741f320b87bedb078952c13064e28f854b4655df0cffcadb1c2c',
            CONSUMER_SECRET: '5bb481b7b4b67c3bd1b00e92caaf0a7195f9a9410286ed614e59f71166af26ae',
            TOKEN_ID: '1d947dcd9423f8fb2c1fca69fa30b3c84e41e7082d26bca3bc321fe2145a1d51',
            TOKEN_SECRET: 'bf38fe3351af4bdd3c314745c000761f2463957fb9187c1fd412d11b17e98f1d'
        };

        chrome.runtime.sendMessage({ action: 'runSuiteQL', query, config }, response => {
            if (chrome.runtime.lastError) {
                document.getElementById('result').textContent = `Error: ${chrome.runtime.lastError.message}`;
            } else if (response.error) {
                document.getElementById('result').textContent = `Error: ${response.error}`;
            } else {
                displayTable(response.result.items);
            }
        });
    } else {
        document.getElementById('result').textContent = "Please enter a SuiteQL query.";
    }
});

function displayTable(data) {
    const table = document.getElementById('resultTable');
    table.innerHTML = ''; 
    if (data.length === 0) {
        table.innerHTML = '<tr><td colspan="100%">No results found</td></tr>';
        return;
    }

    
    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

 
    data.forEach(row => {
        const rowElement = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] !== null ? row[header] : ''; 
            rowElement.appendChild(td);
        });
        table.appendChild(rowElement);
    });
}
