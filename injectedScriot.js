(function() {
    console.log('Injected script is running.');
    require(['N/record', 'N/search', 'N/https', 'N/email', 'N/runtime', 'N/log'], function(record, search, https, email, runtime, log) {
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
                window.postMessage({ type: 'UNAPPLIED_PAYMENTS_RESULT', text: 'Error: ' + error.message }, '*');
                
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
                        'Authorization': 'Bearer 00D5g00000LNAsc!AR0AQBm3DfrqLbN.EwsoBe8mPJcUOYkRlh8oBU6b3XqDHwjdhA0CqO4OVbG9l9OtL7g.IclatEMkU4suSgvph3EAWfGYmsV1',
                        'Content-Type': 'application/json'
                    }
                });

                if (salesforceResponse.code === 200 || salesforceResponse.code === 201) {
                    const responseData = JSON.parse(salesforceResponse.body);
                    const salesforceAccountId = responseData.id;
                    window.postMessage({ type: 'SALESFORCE_SUCCESS', text: 'Customer successfully sent to Salesforce.' , salesforceAccountId: salesforceAccountId}, '*');
                    console.log('Customer synced successfuly!!', salesforceAccountId);
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
                window.postMessage({type: 'FIELDS_FETCHED',text: 'Fields successfully fetched.' }, '*');

            } catch (error) {
                console.error('Error fetching fields:', error);
                window.postMessage({ type: 'FIELDS_FETCH_ERROR', error: error.message }, '*');
            }
        });
    }

    function fetchRecordHierarchy(recordId) {
        require(['N/query'], function (query) {
          const suiteQL = `
            SELECT 
              so.id AS "Sales Order ID", 
              so.tranid AS "Sales Order Number",
              BUILTIN.DF(so.entity) AS "Customer Name",
              inv.id AS "Invoice ID", 
              inv.tranid AS "Invoice Number",
              BUILTIN.DF(subsidiary) AS "Customer Subsidiary",
              BUILTIN.DF(soline.item) AS "Item Name",
              BUILTIN.DF(soline.quantity) AS "Quantity",
              soline.rate AS "Rate",
              (soline.rate * soline.quantity) AS "Calculated Amount"
            FROM 
              Transaction so
            LEFT JOIN 
              NextTransactionLink ntl ON ntl.previousdoc = so.id
            LEFT JOIN 
              Transaction inv ON inv.id = ntl.nextdoc
            LEFT JOIN 
              TransactionLine soline ON soline.transaction = so.id
            WHERE 
              so.type = 'SalesOrd'
              AND so.id = ${recordId}`;
          console.log(suiteQL);
          const resultSet = query.runSuiteQL({ query: suiteQL });
          const results = resultSet.asMappedResults();
          console.log(results);
    
          // Send the results back to the content script
          window.postMessage({ type: 'HIERARCHY_RESULT', hierarchy: results }, '*');
        });
      }

    // Function to extract recordId and recordType from the URL
    function getRecordDetailsFromUrl(record) {
        const urlParams = new URLSearchParams(window.location.search);
        var accountValue = window.location.hostname.split('.')[0];
        console.log(accountValue)
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
        } else if (path.includes('/app/accounting/transactions/custinvc.nl')) {
            recordType = record.Type.INVOICE;
        } else if (path.includes('/app/accounting/transactions/opprtnty.nl')) {
            recordType = record.Type.OPPORTUNITY;
        } else if(path.includes('/app/common/item/item.nl')) {
            recordType = record.Type.ITEM;
        } else if(path.includes('/app/common/item/item.nl')) {
            recordType = record.Type.INVOICE;
        }
            else {
            console.error('Record type not recognized from the URL.');
        }

        console.log('Record type:', recordType);

        return { recordId, recordType };
    }
    function executeCustomScript(userScript) {
        console.log('Received user script:', userScript);

        try {
           
            const result = (function(record, search, https, email, runtime, log) {
                return eval(userScript);  
            })(record, search, https, email, runtime, log);

            console.log('Script executed successfully:', result);

         
            window.postMessage({ type: 'CUSTOM_SCRIPT_RESULT', result: result }, '*');
        } catch (error) {
            console.error('Error executing custom script:', error);
            window.postMessage({ type: 'CUSTOM_SCRIPT_RESULT', result: 'Error: ' + error.message }, '*');
        }
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

    // Function to construct the URL for navigating to the field's configuration page
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

    // Listening for messages from the extension
    window.addEventListener('message', function(event) {
        if (event.data.type) {
            if (event.data.type === 'RUN_QUERY') {
                console.log('Received query:', event.data.query);
                executeSuiteQLQuery(event.data.query);
            } else if (event.data.type === 'RUN_UNAPPLIED_PAYMENTS_CHECK') {
                console.log('Received request to check unapplied payments.');
                checkUnappliedPayments();
            } else if (event.data.type === 'SEND_TO_SALESFORCE') {
                console.log('Received request to send customer to Salesforce.');
                sendCustomerToSalesforce(event.data.customerId);
                const salesforceUrl = `https://blueflamelabs-7d-dev-ed.develop.my.salesforce.com/lightning/r/Account/${salesforceAccountId}/view`;
                window.open(salesforceUrl, '_blank');
            } else if (event.data.type === 'FETCH_ALL_FIELDS') {
                console.log('Fetching all fields from the current record.');
                fetchAllFields();
            } else if (event.data.type === 'FETCH_HIERARCHY') {
                const recordId = event.data.recordId;
          
                // Call the SuiteQL query to get the hierarchy data
                fetchRecordHierarchy(recordId);
              }else if (event.data.type === 'RUN_CUSTOM_SCRIPT') {
                executeCustomScript(event.data.script); // Run the user’s script
            }
        }
    });
    });
    console.log('Waiting for queries or script triggers...');
})();
