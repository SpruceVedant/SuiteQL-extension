(function() {
    // console.log('Injected script is running.');
    require(['N/record', 'N/search', 'N/https', 'N/email', 'N/runtime', 'N/log'], function(record, search, https, email, runtime, log) {
    // Function to execute SuiteQL Query
    function executeSuiteQLQuery(query) {
        // console.log('Attempting to run query:', query);

        require(['N/query'], function(queryModule) {
            try {
                console.log('N/query module loaded.');
                const resultSet = queryModule.runSuiteQL({ query: query });
                const results = resultSet.asMappedResults();

                // console.log('Query Results:', results);

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



    // Function to fetch all fields from the current record and display them in a new window
    function fetchAllFields() {
        require(['N/record'], function(record) {
            try {
                const { recordId, recordType } = getRecordDetailsFromUrl(record);
                // console.log('Fetching....');
                
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
        console.log('⏳ Preparing to run custom script…');
      
        // Load the common NS modules
        require([
          'N/record','N/search','N/https','N/email','N/runtime','N/log','N/error'
        ], function(record, search, https, email, runtime, log,  error) {
          
          // Build an async IIFE as a string
          const wrapperSrc = `
            (async function(record, search, https, email, runtime, log,  error) {
              'use strict';
              ${userScript}
            })
          `;
      
          let userFn;
          try {
            // Evaluate it directly in page context
            // eslint-disable-next-line no-eval
            userFn = eval(wrapperSrc);
            if (typeof userFn !== 'function') {
              throw new Error('Wrapper did not produce a function.');
            }
          } catch (compileErr) {
            console.error('❌ Script compile error:', compileErr);
            window.postMessage({
              type: 'CUSTOM_SCRIPT_RESULT',
              result: { success: false, error: compileErr.toString() }
            }, '*');
            return;
          }
      
          // Run the user’s async function
          userFn(record, search, https, email, runtime, log,  error)
            .then(result => {
              console.log('✅ Script executed successfully:', result);
              window.postMessage({
                type: 'CUSTOM_SCRIPT_RESULT',
                result: { success: true, value: result }
              }, '*');
            })
            .catch(runErr => {
              console.error('❌ Script runtime error:', runErr);
              window.postMessage({
                type: 'CUSTOM_SCRIPT_RESULT',
                result: { success: false, error: runErr.stack || runErr.toString() }
              }, '*');
            });
        });
      }
      
      
    // Function to open a new window, display the results, and allow navigation to field configuration
    function openResultsInNewWindow(fieldValues) {
      const newWin = window.open('', '_blank', 'width=900,height=700');
      const doc = newWin.document;
      
      // Format values for display
      const formatValue = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val, null, 2);
        return String(val);
      };
      
      const rowsHtml = Object.entries(fieldValues).map(([id, val]) => {
        const url = getFieldConfigurationUrl(id);
        const formattedValue = formatValue(val);
        
        return `
          <tr>
            <td class="cell-id">
              <div class="id-container">
                <span class="id-text">${id}</span>
              </div>
            </td>
            <td class="cell-val">${formattedValue}</td>
            
              </a>
            </td>
          </tr>`;
      }).join('');
      
      const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Record Fields</title>
      <style>
        /* Modern CSS Reset */
        *, *::before, *::after { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0; 
        }
        
        /* Base Styles */
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
          color: #334155;
          padding: 28px;
          line-height: 1.5;
          min-height: 100vh;
        }
        
        /* Container & Header */
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 24px;
        }
        
        .header-icon {
          font-size: 24px;
          margin-right: 12px;
        }
        
        h1 {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1e293b;
          flex-grow: 1;
        }
        
        /* Card Styling */
        .card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05), 0 5px 10px rgba(0,0,0,0.03);
          transition: all 0.3s ease;
          border: 1px solid rgba(0,0,0,0.05);
        }
        
        /* Table Styling */
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        
        thead th {
          position: sticky;
          top: 0;
          background: #0f172a;
          color: #f8fafc;
          text-align: left;
          padding: 16px;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        thead th:first-child {
          border-top-left-radius: 8px;
        }
        
        thead th:last-child {
          border-top-right-radius: 8px;
        }
        
        tbody tr {
          border-bottom: 1px solid #e2e8f0;
          transition: background 0.2s ease;
        }
        
        tbody tr:hover {
          background: #f1f5f9;
        }
        
        tbody tr:last-child {
          border-bottom: none;
        }
        
        td {
          padding: 16px;
          vertical-align: middle;
          font-size: 0.95rem;
        }
        
        /* Cell Styling */
        .cell-id {
          width: 25%;
        }
        
        .id-container {
          display: inline-block;
          background: #f1f5f9;
          border-radius: 6px;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
        }
        
        .id-text {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.85rem;
          color: #334155;
          word-break: break-all;
        }
        
        .cell-val {
          width: 55%;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.85rem;
          white-space: pre-wrap;
          word-break: break-word;
          color: #475569;
        }
        
        .cell-action {
          width: 20%;
          text-align: center;
        }
        
        /* Button Styling */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          background: #3b82f6;
          color: #fff;
          text-decoration: none;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
          box-shadow: 0 2px 5px rgba(59, 130, 246, 0.3);
        }
        
        .btn:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
        }
        
        .btn:active {
          transform: translateY(0);
        }
        
        .btn-icon {
          margin-right: 6px;
        }
        
        /* Empty state */
        .empty-table {
          padding: 40px;
          text-align: center;
          color: #64748b;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          body {
            padding: 16px;
          }
          
          .header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .header-icon {
            margin-bottom: 8px;
          }
          
          td, th {
            padding: 12px;
          }
          
          .cell-action {
            text-align: left;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="header-icon">📋</span>
          <h1>Record Fields</h1>
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Field ID</th>
                <th>Field Value</th>
             
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length ? rowsHtml : '<tr><td colspan="3" class="empty-table">No fields found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <script>
        // Add animation when the page loads
        document.addEventListener('DOMContentLoaded', () => {
          const rows = document.querySelectorAll('tbody tr');
          rows.forEach((row, index) => {
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            setTimeout(() => {
              row.style.opacity = '1';
              row.style.transform = 'translateY(0)';
            }, 50 * index);
          });
        });
      </script>
    </body>
    </html>`;
    
      doc.open();
      doc.write(html);
      doc.close();
    }
    

    // Function to construct the URL for navigating to the field's configuration page
    function getFieldConfigurationUrl(fieldId) {
        return `https://.app.netsuite.com/app/common/custom/bodycustfield.nl?id=${fieldId}&e=T`;
    }

    // Injecting a script to hide the loader directly in the DOM
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
                const salesforceUrl = ``;
                window.open(salesforceUrl, '_blank');
            } else if (event.data.type === 'FETCH_ALL_FIELDS') {
                console.log('Fetching all fields from the current record.');
                fetchAllFields();
            } else if (event.data.type === 'FETCH_HIERARCHY') {
                const recordId = event.data.recordId;
          
              
                fetchRecordHierarchy(recordId);
              }else if (event.data.type === 'RUN_CUSTOM_SCRIPT') {
                executeCustomScript(event.data.script);
            }
        }
    });
    });
    // console.log('Waiting for queries or script triggers...');


    // ─────────────────────────────────────────────────
// 1) Expose a console‐callable helper
window.runSuiteScript = function(userScript) {
    // forward into your existing message handler
    window.postMessage({ type: 'RUN_CUSTOM_SCRIPT', script: userScript }, '*');
  };
  
  // 2) Log the results back to the DevTools console
  window.addEventListener('message', (event) => {
    if (event.data.type === 'CUSTOM_SCRIPT_RESULT') {
      const { success, value, error } = event.data.result;
      if (success) {
        console.log(
          '%c[SuiteScript Success]','color:green;font-weight:bold;',
          value
        );
      } else {
        console.error(
          '%c[SuiteScript Error]','color:red;font-weight:bold;',
          error
        );
      }
    }
  });
  
})();
