(function() {
    require(['N/https', 'N/record'], function(https, record) {
        try {
           
            var customerId = '';
            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            
            var customerData = {
                Name: customerRecord.getValue({ fieldId: 'companyname' }),
                Phone: customerRecord.getValue({ fieldId: 'phone' }),
                // Email__c: customerRecord.getValue({ fieldId: 'email' }), 
                // NetSuite_ID__c: customerId 
            };

            
            var salesforceResponse = https.post({
                url: '', 
                body: JSON.stringify(customerData),
                headers: {
                    'Authorization': '', 
                    'Content-Type': 'application/json'
                }
            });

            
            if (salesforceResponse.code === 200 || salesforceResponse.code === 201) {
                console.log('Customer ID:', customerId, 'successfully created in Salesforce as an Account.');
            } else {
                console.error('Error creating Account in Salesforce for Customer ID:', customerId, '. Response code:', salesforceResponse.code, 'Response:', salesforceResponse.body);
            }
        } catch (error) {
            console.error('Error during Salesforce integration:', error.message);
        }
    });
})();
