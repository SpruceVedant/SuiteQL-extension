(function() {
    console.log('Injected script is running.');

    // Function to execute SuiteQL Query
    function executeSuiteQLQuery(query) {
        console.log('Attempting to run query:', query);

        require(['N/query'], function(queryModule) {
            try {
                console.log('N/query module loaded.');
                const resultSet = queryModule.runSuiteQL({ query: query });
                const results = resultSet.asMappedResults();

                console.log('Query Results:', results);

                window.postMessage({ type: 'FROM_PAGE', text: JSON.stringify(results) }, '*');
            } catch (error) {
                console.error('Error executing SuiteQL query:', error);
                window.postMessage({ type: 'FROM_PAGE', text: 'Error: ' + error.message }, '*');
            }
        });
    }

    // Function to check unapplied customer payments and send an alert email
    function checkUnappliedPayments() {
        console.log('Checking for unapplied customer payments...');

        require(['N/search', 'N/email'], function(search, email) {
            try {
                var unappliedPaymentsSearch = search.create({
                    type: search.Type.CUSTOMER_PAYMENT,
                    filters: [
                        ['appliedtotransaction', search.Operator.NONEOF, '@NONE@']
                    ],
                    columns: ['internalid', 'entity', 'total']
                });

                var emailBody = 'The following customer payments are unapplied:\n\n';
                unappliedPaymentsSearch.run().each(function(result) {
                    emailBody += `Payment ID: ${result.getValue('internalid')}, Customer: ${result.getText('entity')}, Total: ${result.getValue('total')}\n`;
                    return true;
                });

                email.send({
                    author: -5,
                    recipients: 'finance_team@example.com',
                    subject: 'Unapplied Customer Payments Alert',
                    body: emailBody
                });

                console.log('Unapplied payments report sent to the finance team.');
                window.postMessage({ type: 'UNAPPLIED_PAYMENTS_RESULT', text: 'Unapplied payments report sent.' }, '*');
                
                injectHideLoaderScript();
                
            } catch (error) {
                console.error('Error checking unapplied payments:', error);
                window.postMessage({ type: 'UNAPPLIED_PAYMENTS_RESULLT ', text: 'Error: ' + error.message }, '*');
                
                injectHideLoaderScript();
            }
        });
    }

    // Function to send a customer record to Salesforce
    function sendCustomerToSalesforce(customerId) {
        console.log('Sending customer to Salesforce with ID:', customerId);

        require(['N/record', 'N/https'], function(record, https) {
            try {
                const customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customerId
                });

                const customerData = {
                    Name: customerRecord.getValue({ fieldId: 'companyname' }),
                    Phone: customerRecord.getValue({ fieldId: 'phone' }),
                    // Email__c: customerRecord.getValue({ fieldId: 'email' }),
                    // NetSuite_ID__c: customerId
                };

                const salesforceResponse = https.post({
                    url: 'https://blueflamelabs-7d-dev-ed.develop.my.salesforce.com/services/data/v61.0/sobjects/Account/',
                    body: JSON.stringify(customerData),
                    headers: {
                        'Authorization': 'Bearer 00D5g00000LNAsc!AR0AQKc27ZcZoWhiDkomi87iDi_uOzAuv.PAYfUf6ZOTI9jFG3Fk5QAzupkyQYlqXH9KS78w.EHDkuXgnLQDcFAb.OnGhL.n',
                        'Content-Type': 'application/json'
                    }
                });

                if (salesforceResponse.code === 200 || salesforceResponse.code === 201) {
                    window.postMessage({ type: 'SALESFORCE_SUCCESS', text: 'Customer successfully sent to Salesforce.' }, '*');
                    console.log('Customer synced successfuly!!');
                } else {
                    window.postMessage({ type: 'SALESFORCE_ERROR', text: 'Error sending customer to Salesforce. Response: ' + salesforceResponse.body }, '*');
                }
                
                injectHideLoaderScript();

            } catch (error) {
                console.error('Error sending customer to Salesforce:', error);
                window.postMessage({ type: 'SALESFORCE_ERROR', text: 'Error: ' + error.message }, '*');
                
                injectHideLoaderScript();
            }
        });
    }

    // Function to fetch all fields from the current record and display them in a new window
    function fetchAllFields() {
        require(['N/record'], function(record) {
            try {
                const { recordId, recordType } = getRecordDetailsFromUrl(record);
                console.log('Fetching....');
                
                if (!recordType || !recordId) {
                    throw new Error('Record type or ID could not be determined.');
                }

                const objRecord = record.load({
                    type: recordType,
                    id: recordId
                });
                console.log('Record type:', objRecord.type);
                console.log('Record ID:', objRecord.id);

                const fields = objRecord.getFields();
                const fieldValues = {};

                fields.forEach(fieldId => {
                    fieldValues[fieldId] = objRecord.getValue({ fieldId });
                });

                // Open a new window to display the results and allow navigation
                openResultsInNewWindow(fieldValues);

            } catch (error) {
                console.error('Error fetching fields:', error);
                window.postMessage({ type: 'FIELDS_FETCH_ERROR', error: error.message }, '*');
            }
        });
    }

    // Function to extract recordId and recordType from the URL
    function getRecordDetailsFromUrl(record) {
        const urlParams = new URLSearchParams(window.location.search);
        const recordId = urlParams.get('id');
        console.log('Record ID:', recordId);

        const path = window.location.pathname;
        let recordType = '';

        if (path.includes('/app/accounting/transactions/salesord.nl')) {
            recordType = record.Type.SALES_ORDER;
        } else if (path.includes('/app/common/entity/custjob.nl')) {
            recordType = record.Type.CUSTOMER;
        } else if (path.includes('/app/common/entity/vendor.nl')) {
            recordType = record.Type.VENDOR;
        } else if (path.includes('/app/accounting/transactions/purchord.nl')) {
            recordType = record.Type.PURCHASE_ORDER;
        } else {
            console.error('Record type not recognized from the URL.');
        }

        console.log('Record type:', recordType);

        return { recordId, recordType };
    }

    // Function to open a new window, display the results, and allow navigation to field configuration
    function openResultsInNewWindow(fieldValues) {
        const newWindow = window.open('', '_blank', 'width=800,height=600');
        const doc = newWindow.document;

        doc.write('<html><head><title>Record Fields</title></head><body>');
        doc.write('<h2>Record Fields</h2>');

        const table = doc.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.border = '1px solid #ddd';

        const thead = doc.createElement('thead');
        const headerRow = doc.createElement('tr');
        ['Field ID', 'Field Value', 'Navigate to Configuration'].forEach(header => {
            const th = doc.createElement('th');
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.backgroundColor = '#007bff';
            th.style.color = 'white';
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = doc.createElement('tbody');
        Object.entries(fieldValues).forEach(([fieldId, value]) => {
            const row = doc.createElement('tr');
            const tdFieldId = doc.createElement('td');
            tdFieldId.style.border = '1px solid #ddd';
            tdFieldId.style.padding = '8px';
            tdFieldId.textContent = fieldId;
            row.appendChild(tdFieldId);

            const tdValue = doc.createElement('td');
            tdValue.style.border = '1px solid #ddd';
            tdValue.style.padding = '8px';
            tdValue.textContent = value !== null ? value : '';
            row.appendChild(tdValue);

            const tdNavigate = doc.createElement('td');
            const navigateLink = document.createElement('a');
            navigateLink.textContent = 'Configure Field';
            navigateLink.style.color = '#007bff';
            navigateLink.style.textDecoration = 'underline';
            navigateLink.href = getFieldConfigurationUrl(fieldId);
            navigateLink.target = '_blank';
            tdNavigate.appendChild(navigateLink);
            row.appendChild(tdNavigate);

            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        doc.body.appendChild(table);
        doc.write('</body></html>');
        doc.close();
    }

    function getFieldConfigurationUrl(fieldId) {
       
        return `https://td2929968.app.netsuite.com/app/common/custom/bodycustfield.nl?id=${fieldId}&e=T`;
    }

    // Injects a script to hide the loader directly in the DOM
    function injectHideLoaderScript() {
        const scriptContent = `
            (function() {
                const loader = document.getElementById('loader');
                if (loader) {
                    loader.style.display = 'none';
                }
            })();
        `;

        const script = document.createElement('script');
        script.textContent = scriptContent;
        document.documentElement.appendChild(script);
        script.remove();
    }

    window.addEventListener('message', function(event) {
        if (event.data.type) {
            if (event.data.type === 'RUN_QUERY') {
                console.log('Received query:', event.data.query);
                executeSuiteQLQuery(event.data.query);
            } else if (event.data.type === 'RUN_UNAPPLIED_PAYMENTS_CHECK') {
                console.log('Received request to check unapplied payments.');
                showLoader();
                checkUnappliedPayments();
            } else if (event.data.type === 'SEND_TO_SALESFORCE') {
                console.log('Received request to send customer to Salesforce.');
                alert('Synced Successfuly');
                sendCustomerToSalesforce(event.data.customerId);
                showLoader();
            } else if (event.data.type === 'FETCH_ALL_FIELDS') {
                console.log('Fetching all fields from the current record.');
                 alert('Successful...');
                fetchAllFields();
            }
        }
    });

    console.log('Waiting for queries or script triggers...');
})();
