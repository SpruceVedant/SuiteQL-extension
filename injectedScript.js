(function() {
    // console.log('Injected script is running.');
    function normalizeSuitesenseSearchText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeSuiteScriptComparable(value) {
        return normalizeSuitesenseSearchText(value).toLowerCase().replace(/[_\-\s]+/g, ' ');
    }

    function compactSuiteScriptComparable(value) {
        return normalizeSuitesenseSearchText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    function looksLikeSuiteScriptIdQuery(value) {
        const normalized = normalizeSuitesenseSearchText(value).toLowerCase();
        if (!normalized) {
            return false;
        }

        return /\bcustomscript(?:[_-]?[a-z0-9]+)*\b/.test(normalized);
    }

    function looksLikeSuiteScriptTypeQuery(value) {
        const normalized = normalizeSuitesenseSearchText(value).toLowerCase();
        if (!normalized) {
            return false;
        }

        return /\b(?:suitelet|restlet|map\/?reduce|map reduce|mapreduce|user event|userevent|client script|clientscript|scheduled script|scheduled scripts|schedule script|schedule scripts|workflow action|workflowaction)\b/.test(normalized);
    }

    async function searchSuiteScriptsByPageFetch(scriptTerm) {
        const term = normalizeSuitesenseSearchText(scriptTerm);
        if (!term) {
            window.postMessage({
                type: 'SCRIPT_SEARCH_RESULT',
                scriptTerm: term,
                matches: []
            }, '*');
            return;
        }

        try {
            const response = await fetch(`${window.location.origin}/app/common/scripting/scriptlist.nl?whence=`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const tokens = term.toLowerCase().split(/[\s_\-]+/).filter(Boolean);
            const normalizedTerm = normalizeSuiteScriptComparable(term);
            const compactTerm = compactSuiteScriptComparable(term);
            const matches = [];
            const seen = new Set();
            const ignoredTexts = /^(?:edit|view|copy|remove|delete|actions?)$/i;

            Array.from(doc.querySelectorAll('tr')).forEach((row) => {
                const scriptLinks = Array.from(row.querySelectorAll('a[href*="/app/common/scripting/script.nl?id="]'));
                if (!scriptLinks.length) {
                    return;
                }

                const href = scriptLinks[0].getAttribute('href') || '';
                const url = href.startsWith('http') ? href : `${window.location.origin}${href}`;
                const idMatch = url.match(/[?&]id=(\d+)/i);
                const internalId = idMatch ? idMatch[1] : '';
                const rowText = normalizeSuitesenseSearchText(row.textContent || '');
                const normalizedHaystack = normalizeSuiteScriptComparable(rowText);
                const compactHaystack = compactSuiteScriptComparable(rowText);

                if (!internalId) {
                    return;
                }

                const tokenScore = tokens.reduce((total, token) => total + (normalizedHaystack.includes(token) ? 40 : 0), 0);
                const normalizedRowStartsWith = normalizedHaystack.startsWith(normalizedTerm);
                const normalizedRowIncludes = normalizedHaystack.includes(normalizedTerm);
                const compactStartsWith = compactTerm && compactHaystack.startsWith(compactTerm);
                const compactIncludes = compactTerm && compactHaystack.includes(compactTerm);
                let rowScore = tokenScore;

                if (normalizedHaystack === normalizedTerm) {
                    rowScore += 240;
                } else if (normalizedRowStartsWith) {
                    rowScore += 180;
                } else if (normalizedRowIncludes) {
                    rowScore += 120;
                }

                if (compactStartsWith) {
                    rowScore += 150;
                } else if (compactIncludes) {
                    rowScore += 90;
                }

                if (rowScore <= 0 && !looksLikeSuiteScriptIdQuery(term)) {
                    return;
                }

                const scriptIdMatch = rowText.match(/\bcustomscript[a-z0-9_]+\b/i);
                const scriptId = scriptIdMatch ? scriptIdMatch[0] : '';
                const cellTexts = Array.from(row.querySelectorAll('td, th'))
                    .map((cell) => normalizeSuitesenseSearchText(cell.textContent || ''))
                    .filter((value) => value && !ignoredTexts.test(value));
                const linkTexts = scriptLinks
                    .map((candidate) => normalizeSuitesenseSearchText(candidate.textContent || ''))
                    .filter((value) => value && !ignoredTexts.test(value));
                const candidateNames = [...linkTexts, ...cellTexts]
                    .filter((value) => value && value.toLowerCase() !== scriptId.toLowerCase());
                const dedupeKey = `${internalId}:${scriptId}`;
                if (seen.has(dedupeKey)) {
                    return;
                }
                seen.add(dedupeKey);

                const rankedName = candidateNames
                    .map((candidate) => {
                        const normalizedCandidate = normalizeSuiteScriptComparable(candidate);
                        const compactCandidate = compactSuiteScriptComparable(candidate);
                        const score = tokens.reduce((total, token) => total + (normalizedCandidate.includes(token) ? 40 : 0), 0)
                            + (normalizedCandidate === normalizedTerm ? 160 : 0)
                            + (normalizedCandidate.startsWith(normalizedTerm) ? 80 : 0)
                            + (compactTerm && compactCandidate === compactTerm ? 180 : 0)
                            + (compactTerm && compactCandidate.startsWith(compactTerm) ? 100 : 0)
                            + (compactTerm && compactCandidate.includes(compactTerm) ? 60 : 0)
                            + (/^[a-z0-9_ -]+$/i.test(candidate) ? 10 : 0);
                        return { candidate, score };
                    })
                    .sort((left, right) => right.score - left.score || left.candidate.localeCompare(right.candidate))[0];

                const name = rankedName?.candidate || scriptId || `Script ${internalId}`;
                const normalizedName = normalizeSuiteScriptComparable(name);
                const compactName = compactSuiteScriptComparable(name);
                const score = rowScore
                    + (normalizedName === normalizedTerm ? 160 : 0)
                    + (normalizedName.startsWith(normalizedTerm) ? 80 : 0)
                    + (compactTerm && compactName === compactTerm ? 180 : 0)
                    + (compactTerm && compactName.startsWith(compactTerm) ? 100 : 0)
                    + (compactTerm && compactName.includes(compactTerm) ? 60 : 0);

                if (score <= 0) {
                    return;
                }

                matches.push({
                    internalId,
                    name,
                    scriptId,
                    typeLabel: 'SuiteScript',
                    score,
                    url: `${window.location.origin}/app/common/scripting/script.nl?id=${encodeURIComponent(internalId)}`
                });
            });

            matches.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

            window.postMessage({
                type: 'SCRIPT_SEARCH_RESULT',
                scriptTerm: term,
                matches: matches.slice(0, 15)
            }, '*');
        } catch (error) {
            console.error('Error searching SuiteScripts via page fetch:', error);
            window.postMessage({
                type: 'COMMAND_PALETTE_ACTION_RESULT',
                success: false,
                message: `Unable to search scripts for "${term}".`
            }, '*');
        }
    }

    function initializeSuitesenseInjected(record, search, https, email, runtime, log) {
    window.__suitesenseModulesReady = true;
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



    async function fetchFieldValuesFromXml() {
        const recordDetails = getRecordDetailsFromUrl(record);
        const xmlUrl = new URL(window.location.href);
        xmlUrl.searchParams.set('xml', 'T');

        const response = await fetch(xmlUrl.toString(), {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`XML fetch failed with status ${response.status}.`);
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Unable to parse XML response.');
        }

        const rootTag = xmlDoc.documentElement && xmlDoc.documentElement.tagName
            ? xmlDoc.documentElement.tagName.toLowerCase()
            : '';

        if (rootTag === 'html') {
            throw new Error('XML response returned HTML instead of record XML.');
        }

        const fieldValues = extractStructuredFieldsFromXml(xmlDoc, recordDetails);
        if (!Object.keys(fieldValues.bodyFields || {}).length && !Object.keys(fieldValues.lineFields || {}).length) {
            throw new Error('No usable fields found in XML response.');
        }

        return fieldValues;
    }

    function getXmlNodeKey(element, fallbackIndex) {
        return element.getAttribute('id') ||
            element.getAttribute('scriptid') ||
            element.getAttribute('fieldid') ||
            element.getAttribute('name') ||
            element.tagName ||
            `node_${fallbackIndex}`;
    }

    function isXmlSublistContainer(element) {
        const tagName = String(element.tagName || '').toLowerCase();
        if (['machine', 'sublist', 'lines'].includes(tagName)) {
            return true;
        }

        return Array.from(element.children || []).some((child) => {
            return String(child.tagName || '').toLowerCase() === 'line';
        });
    }

    function xmlElementToJson(element) {
        const children = Array.from(element.children || []);
        const valueAttr = element.getAttribute('value');
        const trimmedText = (element.textContent || '').trim();

        if (!children.length) {
            if (valueAttr !== null && valueAttr !== '') {
                return valueAttr;
            }

            return trimmedText || undefined;
        }

        const allLineChildren = children.every((child) => String(child.tagName || '').toLowerCase() === 'line');
        if (allLineChildren) {
            const lines = {};
            children.forEach((child, index) => {
                const lineValue = xmlElementToJson(child);
                lines[String(index + 1)] = lineValue;
            });
            return lines;
        }

        const output = {};
        children.forEach((child, index) => {
            const key = getXmlNodeKey(child, index);
            const value = xmlElementToJson(child);
            if (typeof value === 'undefined' || value === '') {
                return;
            }

            if (!(key in output)) {
                output[key] = value;
                return;
            }

            if (!Array.isArray(output[key])) {
                output[key] = [output[key]];
            }

            output[key].push(value);
        });

        return Object.keys(output).length ? output : (valueAttr || trimmedText || undefined);
    }

    function extractStructuredFieldsFromXml(xmlDoc, recordDetails) {
        const recordElement = xmlDoc.querySelector('record') || xmlDoc.querySelector('recordmachine') || xmlDoc.documentElement;
        const bodyFields = {};
        const lineFields = {};
        const children = Array.from(recordElement.children || []);

        children.forEach((child, index) => {
            const key = getXmlNodeKey(child, index);
            const value = xmlElementToJson(child);

            if (typeof value === 'undefined' || value === '') {
                return;
            }

            if (isXmlSublistContainer(child)) {
                lineFields[key] = value;
            } else {
                bodyFields[key] = value;
            }
        });

        return {
            recordType: recordDetails.recordTypeName || String(recordElement.tagName || '').toLowerCase(),
            id: recordDetails.recordId || recordElement.getAttribute('id') || null,
            bodyFields,
            lineFields
        };
    }

    function fetchFieldValuesViaRecordLoad() {
        const { recordId, recordType, recordTypeName } = getRecordDetailsFromUrl(record);

        if (!recordType || !recordId) {
            throw new Error('Record type or ID could not be determined.');
        }

        const objRecord = record.load({
            type: recordType,
            id: recordId
        });

        const fields = objRecord.getFields();
        const bodyFields = {};

        fields.forEach(fieldId => {
            bodyFields[fieldId] = objRecord.getValue({ fieldId });
        });

        const lineFields = {};
        const sublists = typeof objRecord.getSublists === 'function' ? objRecord.getSublists() : [];

        sublists.forEach((sublistId) => {
            try {
                const lineCount = objRecord.getLineCount({ sublistId }) || 0;
                const sublistFields = objRecord.getSublistFields({ sublistId }) || [];
                const sublistLines = {};

                for (let line = 0; line < lineCount; line += 1) {
                    const lineValues = {};
                    sublistFields.forEach((fieldId) => {
                        let value = objRecord.getSublistValue({ sublistId, fieldId, line });

                        if ((value === null || typeof value === 'undefined' || value === '') && typeof objRecord.getSublistText === 'function') {
                            try {
                                value = objRecord.getSublistText({ sublistId, fieldId, line });
                            } catch (sublistTextError) {
                                value = value;
                            }
                        }

                        if (value !== null && typeof value !== 'undefined' && value !== '') {
                            lineValues[fieldId] = value;
                        }
                    });

                    if (Object.keys(lineValues).length) {
                        sublistLines[String(line + 1)] = lineValues;
                    }
                }

                lineFields[sublistId] = sublistLines;
            } catch (sublistError) {
                lineFields[sublistId] = { error: sublistError.message };
            }
        });

        return {
            recordType: recordTypeName || objRecord.type,
            id: recordId,
            bodyFields,
            lineFields
        };
    }

    // Function to fetch all fields from the current record and display them in a new window
    async function fetchAllFields() {
        try {
            let fieldValues;
            let source = 'xml';

            try {
                fieldValues = await fetchFieldValuesFromXml();
            } catch (xmlError) {
                console.warn('XML field fetch failed, falling back to record.load:', xmlError);
                fieldValues = fetchFieldValuesViaRecordLoad();
                source = 'record.load';
            }

            openResultsInNewWindow(fieldValues);
            window.postMessage({
                type: 'FIELDS_FETCHED',
                data: fieldValues,
                text: `Fields fetched successfully via ${source}.`
            }, '*');
        } catch (error) {
            console.error('Error fetching fields:', error);
            window.postMessage({ type: 'FIELDS_FETCH_ERROR', error: error.message }, '*');
        }
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

    function openCustomerByName(customerName, openInNewTab = true) {
        const term = String(customerName || '').trim();
        if (!term) {
            window.postMessage({
                type: 'COMMAND_PALETTE_ACTION_RESULT',
                success: false,
                message: 'Enter a customer name to open.'
            }, '*');
            return;
        }

        try {
            const customerSearch = search.create({
                type: search.Type.CUSTOMER,
                filters: [
                    ['isinactive', search.Operator.IS, 'F'],
                    'AND',
                    [
                        ['entityid', search.Operator.CONTAINS, term],
                        'OR',
                        ['companyname', search.Operator.CONTAINS, term],
                        'OR',
                        ['altname', search.Operator.CONTAINS, term]
                    ]
                ],
                columns: [
                    search.createColumn({ name: 'entityid', sort: search.Sort.ASC }),
                    'companyname',
                    'altname',
                    'internalid'
                ]
            });

            const matches = customerSearch.run().getRange({ start: 0, end: 25 }) || [];
            if (!matches.length) {
                window.postMessage({
                    type: 'COMMAND_PALETTE_ACTION_RESULT',
                    success: false,
                    message: `No customer found for "${term}".`
                }, '*');
                return;
            }

            const normalizedTerm = term.toLowerCase();
            const bestMatch = matches
                .map((result) => {
                    const entityId = String(result.getValue({ name: 'entityid' }) || '');
                    const companyName = String(result.getValue({ name: 'companyname' }) || '');
                    const altName = String(result.getValue({ name: 'altname' }) || '');
                    const scoreBase = [entityId, companyName, altName]
                        .filter(Boolean)
                        .reduce((score, value) => {
                            const lowerValue = value.toLowerCase();
                            if (lowerValue === normalizedTerm) {
                                return Math.max(score, 300);
                            }
                            if (lowerValue.startsWith(normalizedTerm)) {
                                return Math.max(score, 220);
                            }
                            if (lowerValue.includes(normalizedTerm)) {
                                return Math.max(score, 140);
                            }
                            return score;
                        }, 0);

                    return {
                        id: result.getValue({ name: 'internalid' }),
                        entityId,
                        companyName,
                        altName,
                        score: scoreBase
                    };
                })
                .sort((left, right) => right.score - left.score || String(left.companyName || left.entityId).localeCompare(String(right.companyName || right.entityId)))[0];

            if (!bestMatch || !bestMatch.id) {
                window.postMessage({
                    type: 'COMMAND_PALETTE_ACTION_RESULT',
                    success: false,
                    message: `No customer found for "${term}".`
                }, '*');
                return;
            }

            const destinationUrl = `${window.location.origin}/app/common/entity/custjob.nl?id=${encodeURIComponent(bestMatch.id)}`;
            if (openInNewTab) {
                window.open(destinationUrl, '_blank', 'noopener');
            } else {
                window.location.assign(destinationUrl);
            }
        } catch (error) {
            console.error('Error opening customer by name:', error);
            window.postMessage({
                type: 'COMMAND_PALETTE_ACTION_RESULT',
                success: false,
                message: `Unable to open customer "${term}".`
            }, '*');
        }
    }

    function searchSuiteScriptsByName(scriptTerm) {
        const term = String(scriptTerm || '').trim();
        if (!term) {
            window.postMessage({
                type: 'SCRIPT_SEARCH_RESULT',
                scriptTerm: term,
                matches: []
            }, '*');
            return;
        }

        try {
            const normalizedTerm = term.toLowerCase();
            const searchTokens = normalizedTerm
                .split(/[\s_\-]+/)
                .map((token) => token.trim())
                .filter(Boolean)
                .slice(0, 6);
            const compactTerm = compactSuiteScriptComparable(term);

            const filters = [];
            searchTokens.forEach((token, index) => {
                if (index > 0) {
                    filters.push('AND');
                }
                filters.push([
                    ['name', search.Operator.CONTAINS, token],
                    'OR',
                    ['scriptid', search.Operator.CONTAINS, token]
                ]);
            });

            const scriptSearch = search.create({
                type: 'script',
                filters: filters.length ? filters : [['name', search.Operator.CONTAINS, term]],
                columns: [
                    search.createColumn({ name: 'name', sort: search.Sort.ASC }),
                    'scriptid',
                    'internalid'
                ]
            });

            const matches = (scriptSearch.run().getRange({ start: 0, end: 15 }) || [])
                .map((result) => {
                    const internalId = String(result.getValue({ name: 'internalid' }) || '').trim();
                    const name = String(result.getValue({ name: 'name' }) || '').trim();
                    const scriptId = String(result.getValue({ name: 'scriptid' }) || '').trim();
                    const haystacks = [name, scriptId]
                        .filter(Boolean)
                        .map((value) => ({
                            normalized: normalizeSuiteScriptComparable(value),
                            compact: compactSuiteScriptComparable(value)
                        }));
                    const score = haystacks.reduce((bestScore, value) => {
                        if (value.normalized === normalizeSuiteScriptComparable(term) || (compactTerm && value.compact === compactTerm)) {
                            return Math.max(bestScore, 300);
                        }
                        if (value.normalized.startsWith(normalizeSuiteScriptComparable(term)) || (compactTerm && value.compact.startsWith(compactTerm))) {
                            return Math.max(bestScore, 220);
                        }
                        if (value.normalized.includes(normalizeSuiteScriptComparable(term)) || (compactTerm && value.compact.includes(compactTerm))) {
                            return Math.max(bestScore, 140);
                        }
                        return bestScore;
                    }, 0);

                    return {
                        internalId,
                        name: name || scriptId || `Script ${internalId}`,
                        scriptId,
                        typeLabel: 'SuiteScript',
                        score,
                        url: internalId
                            ? `${window.location.origin}/app/common/scripting/script.nl?id=${encodeURIComponent(internalId)}`
                            : ''
                    };
                })
                .filter((match) => match.internalId && match.url)
                .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

            if (!matches.length || looksLikeSuiteScriptTypeQuery(term) || looksLikeSuiteScriptIdQuery(term)) {
                searchSuiteScriptsByPageFetch(term);
                return;
            }

            window.postMessage({
                type: 'SCRIPT_SEARCH_RESULT',
                scriptTerm: term,
                matches
            }, '*');
        } catch (error) {
            console.error('Error searching SuiteScripts by name:', error);
            window.postMessage({
                type: 'COMMAND_PALETTE_ACTION_RESULT',
                success: false,
                message: `Unable to search scripts for "${term}".`
            }, '*');
        }
    }

    function resolveInternalId(internalId) {
        const id = String(internalId || '').trim();
        if (!/^\d+$/.test(id)) {
            window.postMessage({
                type: 'INTERNAL_ID_RESOLUTION_RESULT',
                internalId: id,
                matches: []
            }, '*');
            return;
        }

        const matches = [];
        const seen = new Set();
        const origin = window.location.origin;
        const numericId = Number(id);

        function postResolutionResult() {
            window.postMessage({
                type: 'INTERNAL_ID_RESOLUTION_RESULT',
                internalId: id,
                matches
            }, '*');
        }

        function pushMatch(match) {
            if (!match || !match.url) {
                return;
            }

            const dedupeKey = `${match.recordType || ''}:${match.internalId || ''}:${match.url}`;
            if (seen.has(dedupeKey)) {
                return;
            }
            seen.add(dedupeKey);
            matches.push(match);
        }

        function safeValue(result, name) {
            try {
                return result.getValue({ name }) || '';
            } catch (error) {
                return '';
            }
        }

        function safeText(result, name) {
            try {
                return result.getText({ name }) || '';
            } catch (error) {
                return '';
            }
        }

        function resolveCustomRecordMatches(done) {
            require(['N/query'], function(query) {
                try {
                    const customRecordTypes = query.runSuiteQL({
                        query: `
                            SELECT
                                Name,
                                ScriptID
                            FROM
                                CustomRecordType
                            WHERE
                                IsInactive = 'F'
                            ORDER BY
                                Name
                        `
                    }).asMappedResults() || [];

                    customRecordTypes.slice(0, 40).forEach((row) => {
                        const recordTypeLabel = String(row.Name || row.name || '').trim();
                        const scriptId = String(row.ScriptID || row.scriptid || '').trim();

                        if (!scriptId) {
                            return;
                        }

                        try {
                            const customRecordSearch = search.create({
                                type: scriptId,
                                filters: [['internalidnumber', search.Operator.EQUALTO, numericId]],
                                columns: ['internalid', 'name']
                            });

                            const result = customRecordSearch.run().getRange({ start: 0, end: 1 })[0];
                            if (!result) {
                                return;
                            }

                            const title = safeValue(result, 'name') || `${recordTypeLabel || 'Custom Record'} ${id}`;
                            pushMatch({
                                internalId: id,
                                recordType: scriptId,
                                recordTypeLabel: recordTypeLabel || 'Custom Record',
                                title,
                                subtitle: scriptId,
                                url: `${origin}/app/common/custom/${scriptId}.nl?id=${encodeURIComponent(id)}`
                            });
                        } catch (customRecordError) {
                            console.debug(`Unable to resolve custom record type ${scriptId} for ID ${id}:`, customRecordError);
                        }
                    });
                } catch (customTypeError) {
                    console.error('Unable to load custom record types for ID resolution:', customTypeError);
                } finally {
                    done();
                }
            }, function(requireError) {
                console.error('Unable to load N/query for custom record resolution:', requireError);
                done();
            });
        }

        function resolveVendorViaSuiteQL(done) {
            require(['N/query'], function(query) {
                try {
                    const vendorResults = query.runSuiteQL({
                        query: `
                            SELECT
                                id,
                                entityid,
                                companyname
                            FROM
                                vendor
                            WHERE
                                id = ${numericId}
                        `
                    }).asMappedResults() || [];

                    vendorResults.forEach((row) => {
                        const entityId = String(row.entityid || row.ENTITYID || '').trim();
                        const companyName = String(row.companyname || row.COMPANYNAME || '').trim();
                        const title = entityId || companyName || `Vendor ${id}`;

                        pushMatch({
                            internalId: id,
                            recordType: 'vendor',
                            recordTypeLabel: 'Vendor',
                            title,
                            subtitle: companyName && companyName !== title ? companyName : '',
                            url: `${origin}/app/common/entity/vendor.nl?id=${encodeURIComponent(id)}`
                        });
                    });
                } catch (vendorQueryError) {
                    console.debug(`Unable to resolve Vendor via SuiteQL for ID ${id}:`, vendorQueryError);
                } finally {
                    done();
                }
            }, function(requireError) {
                console.debug('Unable to load N/query for vendor resolution:', requireError);
                done();
            });
        }

        try {
            const entityConfigs = [
                {
                    type: search.Type.CUSTOMER,
                    recordType: 'customer',
                    recordTypeLabel: 'Customer',
                    path: '/app/common/entity/custjob.nl',
                    columns: ['entityid', 'altname']
                },
                {
                    type: search.Type.VENDOR,
                    recordType: 'vendor',
                    recordTypeLabel: 'Vendor',
                    path: '/app/common/entity/vendor.nl',
                    columns: ['entityid', 'altname']
                },
                {
                    type: search.Type.EMPLOYEE,
                    recordType: 'employee',
                    recordTypeLabel: 'Employee',
                    path: '/app/common/entity/employee.nl',
                    columns: ['entityid', 'firstname', 'lastname']
                },
                {
                    type: search.Type.ITEM,
                    recordType: 'item',
                    recordTypeLabel: 'Item',
                    path: '/app/common/item/item.nl',
                    columns: ['itemid', 'displayname']
                }
            ];

            entityConfigs.forEach((config) => {
                try {
                    const entitySearch = search.create({
                        type: config.type,
                        filters: [['internalidnumber', search.Operator.EQUALTO, numericId]],
                        columns: config.columns
                    });

                    const result = entitySearch.run().getRange({ start: 0, end: 1 })[0];
                    if (!result) {
                        return;
                    }

                    const entityId = safeValue(result, 'entityid');
                    const altName = safeValue(result, 'altname');
                    const displayName = safeValue(result, 'displayname');
                    const itemId = safeValue(result, 'itemid');
                    const firstName = safeValue(result, 'firstname');
                    const lastName = safeValue(result, 'lastname');
                    const title = entityId || altName || displayName || itemId || `${firstName} ${lastName}`.trim() || `${config.recordTypeLabel} ${id}`;

                    pushMatch({
                        internalId: id,
                        recordType: config.recordType,
                        recordTypeLabel: config.recordTypeLabel,
                        title,
                        subtitle: altName && altName !== title ? altName : '',
                        url: `${origin}${config.path}?id=${encodeURIComponent(id)}`
                    });
                } catch (entityError) {
                    console.debug(`Unable to resolve ${config.recordTypeLabel} for ID ${id}:`, entityError);
                }
            });

            try {
                const transactionSearch = search.create({
                    type: search.Type.TRANSACTION,
                    filters: [
                        ['internalidnumber', search.Operator.EQUALTO, numericId],
                        'AND',
                        ['mainline', search.Operator.IS, 'T']
                    ],
                    columns: ['internalid', 'tranid', 'type', 'entity']
                });

                const transactionResults = transactionSearch.run().getRange({ start: 0, end: 10 }) || [];
                const transactionUrlMap = {
                    SalesOrd: { label: 'Sales Order', path: '/app/accounting/transactions/salesord.nl' },
                    PurchOrd: { label: 'Purchase Order', path: '/app/accounting/transactions/purchord.nl' },
                    CustInvc: { label: 'Invoice', path: '/app/accounting/transactions/custinvc.nl' },
                    Estimate: { label: 'Estimate', path: '/app/accounting/transactions/estimate.nl' },
                    CustPymt: { label: 'Customer Payment', path: '/app/accounting/transactions/custpymt.nl' },
                    CustRfnd: { label: 'Customer Refund', path: '/app/accounting/transactions/custrfnd.nl' },
                    CustCred: { label: 'Credit Memo', path: '/app/accounting/transactions/custcred.nl' },
                    ItemShip: { label: 'Item Fulfillment', path: '/app/accounting/transactions/itemship.nl' },
                    ItemRcpt: { label: 'Item Receipt', path: '/app/accounting/transactions/itemrcpt.nl' },
                    Opprtnty: { label: 'Opportunity', path: '/app/accounting/transactions/opprtnty.nl' },
                    RtnAuth: { label: 'Return Authorization', path: '/app/accounting/transactions/rtnauth.nl' },
                    VendBill: { label: 'Vendor Bill', path: '/app/accounting/transactions/vendbill.nl' },
                    CashSale: { label: 'Cash Sale', path: '/app/accounting/transactions/cashsale.nl' }
                };

                transactionResults.forEach((result) => {
                    const typeCode = safeValue(result, 'type') || '';
                    const typeText = safeText(result, 'type') || typeCode || 'Transaction';
                    const mapped = transactionUrlMap[typeCode];
                    if (!mapped) {
                        return;
                    }

                    const tranId = safeValue(result, 'tranid') || `${mapped.label} ${id}`;
                    const entityText = safeText(result, 'entity') || '';
                    pushMatch({
                        internalId: id,
                        recordType: typeCode,
                        recordTypeLabel: mapped.label || typeText,
                        title: tranId,
                        subtitle: entityText,
                        url: `${origin}${mapped.path}?id=${encodeURIComponent(id)}&whence=`
                    });
                });
            } catch (transactionError) {
                console.debug(`Unable to resolve transaction for ID ${id}:`, transactionError);
            }
        } catch (error) {
            console.error('Error resolving internal ID:', error);
        }

        if (matches.length) {
            postResolutionResult();
            return;
        }

        resolveVendorViaSuiteQL(function() {
            if (matches.length) {
                postResolutionResult();
                return;
            }

            resolveCustomRecordMatches(postResolutionResult);
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
        let recordTypeName = '';

        if (path.includes('/app/accounting/transactions/salesord.nl')) {
            recordType = record.Type.SALES_ORDER;
            recordTypeName = 'salesorder';
        } else if (path.includes('/app/common/entity/custjob.nl')) {
            recordType = record.Type.CUSTOMER;
            recordTypeName = 'customer';
        } else if (path.includes('/app/common/entity/vendor.nl')) {
            recordType = record.Type.VENDOR;
            recordTypeName = 'vendor';
        } else if (path.includes('/app/accounting/transactions/purchord.nl')) {
            recordType = record.Type.PURCHASE_ORDER;
            recordTypeName = 'purchaseorder';
        } else if (path.includes('/app/accounting/transactions/custinvc.nl')) {
            recordType = record.Type.INVOICE;
            recordTypeName = 'invoice';
        } else if (path.includes('/app/accounting/transactions/opprtnty.nl')) {
            recordType = record.Type.OPPORTUNITY;
            recordTypeName = 'opportunity';
        } else if (path.includes('/app/common/item/item.nl')) {
            recordType = record.Type.ITEM;
            recordTypeName = 'item';
        } else {
            console.error('Record type not recognized from the URL.');
        }

        console.log('Record type:', recordType);

        return { recordId, recordType, recordTypeName };
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
      
      
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Override the older flat-table renderer with a JSON-focused viewer
    function openResultsInNewWindow(fieldValues) {
      const newWin = window.open('', '_blank', 'width=980,height=760');
      const doc = newWin.document;
      const escapedJson = escapeHtml(JSON.stringify(fieldValues, null, 2));
      const bodyCount = Object.keys(fieldValues.bodyFields || {}).length;
      const lineGroupCount = Object.keys(fieldValues.lineFields || {}).length;
      const metaLabel = `${fieldValues.recordType || 'record'} #${fieldValues.id || ''}`.trim();

      const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Record Fields JSON</title>
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: Consolas, 'SFMono-Regular', 'Cascadia Code', monospace;
          background: #05070b;
          color: #dbeafe;
          padding: 28px;
          min-height: 100vh;
        }

        .container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 20px;
        }

        h1 {
          font-size: 1.35rem;
          color: #f8fafc;
        }

        .meta {
          margin-top: 8px;
          color: #93c5fd;
          font-size: 0.9rem;
        }

        .summary {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin: 14px 0 18px;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.18);
          color: #bfdbfe;
          font-size: 0.84rem;
        }

        .card {
          background: #0b1220;
          border: 1px solid rgba(96, 165, 250, 0.18);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
        }

        .toolbar {
          display: flex;
          justify-content: flex-end;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(96, 165, 250, 0.12);
          background: rgba(15, 23, 42, 0.88);
        }

        .copy-button {
          border: 0;
          border-radius: 999px;
          padding: 10px 14px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          cursor: pointer;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 600;
        }

        pre {
          margin: 0;
          padding: 20px;
          white-space: pre-wrap;
          word-break: break-word;
          overflow: auto;
          color: #bfdbfe;
          line-height: 1.55;
          font-size: 0.92rem;
        }
      
      
          <h1>Record Fields JSON</h1>
          <div class="meta">${escapeHtml(metaLabel)}</div>
          <div class="summary">
            <div class="pill">Body fields: ${bodyCount}</div>
            <div class="pill">Line groups: ${lineGroupCount}</div>
          </div>
        </div>
        <div class="card">
          <div class="toolbar">
            <button id="copyJson" class="copy-button">Copy JSON</button>
          </div>
          <pre id="jsonOutput">${escapedJson}</pre>
        </div>
      </div>
      <script>
        document.getElementById('copyJson').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(document.getElementById('jsonOutput').textContent);
            document.getElementById('copyJson').textContent = 'Copied';
            setTimeout(() => {
              document.getElementById('copyJson').textContent = 'Copy JSON';
            }, 1200);
          } catch (error) {
            document.getElementById('copyJson').textContent = 'Copy failed';
          }
        });
      </script>
    </body>
    </html>`;

      doc.open();
      doc.write(html);
      doc.close();
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

    const suitesenseIncludedDropdownNames = ['rffield', 'filterfilter', 'sort1', 'sort2', 'sort3', 'field', 'dffield', 'fffilter'];
    const suitesenseMultiSelectMachineNames = ['returnfields', 'filterfields', 'detailfields'];
    const suitesenseMachineFieldIds = {
        detailfields: 'dffield',
        returnfields: 'rffield',
        filterfields: 'field'
    };
    const suitesenseRolePermissionKeywords = ['permission', 'permissions'];
    window.__suitesenseInlineEnhancementsEnabled = window.__suitesenseInlineEnhancementsEnabled !== false;

    function areSuitesenseInlineEnhancementsEnabled() {
        return window.__suitesenseInlineEnhancementsEnabled !== false;
    }

    function cleanupRolePermissionEnhancers() {
        if (typeof window.dropdowns === 'undefined') {
            return;
        }

        Object.keys(window.dropdowns).forEach((key) => {
            const nsDropdown = window.dropdowns[key];
            if (!nsDropdown || !nsDropdown.div || !Array.isArray(nsDropdown.divArray)) {
                return;
            }

            nsDropdown.div.querySelectorAll(':scope > .suitesense-perm-panel').forEach((panel) => panel.remove());

            nsDropdown.divArray.forEach((element, index) => {
                if (!element) {
                    return;
                }

                element.classList.remove('suitesense-perm-option', 'is-selected');
                element.removeAttribute('title');
                element.style.removeProperty('display');

                if (element.dataset.suitesenseRoleDecorated === 'true') {
                    element.textContent = String(nsDropdown.textArray?.[index] || '').trim();
                    element.removeAttribute('data-suitesense-role-decorated');
                }
            });
        });
    }

    function cleanupSavedSearchFieldEnhancers() {
        if (typeof window.dropdowns === 'undefined') {
            return;
        }

        Object.keys(window.dropdowns).forEach((key) => {
            const nsDropdown = window.dropdowns[key];
            if (!nsDropdown || !suitesenseIncludedDropdownNames.includes(nsDropdown.name) || !nsDropdown.div || !Array.isArray(nsDropdown.divArray)) {
                return;
            }

            nsDropdown.div.querySelectorAll(':scope > .suitesense-dd-panel, :scope > .suitesense-dd-footer').forEach((element) => element.remove());

            nsDropdown.divArray.forEach((element, index) => {
                if (!element) {
                    return;
                }

                element.classList.remove('suitesense-dd-option');
                element.removeAttribute('data-suitesense-value');
                element.removeAttribute('title');
                element.style.removeProperty('display');

                if (element.dataset.suitesenseDecorated === 'true') {
                    element.textContent = String(nsDropdown.textArray?.[index] || '').trim();
                    element.removeAttribute('data-suitesense-decorated');
                }
            });
        });
    }

    function applyInlineEnhancementsPreference(enabled) {
        window.__suitesenseInlineEnhancementsEnabled = enabled !== false;

        if (areSuitesenseInlineEnhancementsEnabled()) {
            initializeSavedSearchFieldEnhancer();
            initializeRolePermissionEnhancer();
            return;
        }

        cleanupSavedSearchFieldEnhancers();
        cleanupRolePermissionEnhancers();
    }

    function initializeSavedSearchFieldEnhancer() {
        const isSupportedPage = window.location.pathname.includes('/app/common/search/') || window.location.pathname.includes('/app/common/workflow/');
        if (!isSupportedPage || window.__suitesenseSavedSearchFieldEnhancerInitialized || !areSuitesenseInlineEnhancementsEnabled()) {
            return;
        }

        function start() {
            if (window.__suitesenseSavedSearchFieldEnhancerInitialized || !areSuitesenseInlineEnhancementsEnabled()) {
                return;
            }

            if (typeof window.dropdowns === 'undefined') {
                return;
            }

            window.__suitesenseSavedSearchFieldEnhancerInitialized = true;
            injectSavedSearchFieldEnhancerStyles();

            Object.keys(window.dropdowns).forEach((key) => {
                const nsDropdown = window.dropdowns[key];
                if (!nsDropdown || !suitesenseIncludedDropdownNames.includes(nsDropdown.name)) {
                    return;
                }

                attachSavedSearchFieldEnhancer(nsDropdown);
            });
        }

        if (window.NS && window.NS.form && typeof window.NS.form.isInited === 'function') {
            if (window.NS.form.isInited()) {
                start();
            } else if (window.NS.event && window.NS.event.type && typeof window.NS.event.once === 'function') {
                window.NS.event.once(window.NS.event.type.FORM_INITED, start);
            } else {
                window.setTimeout(start, 1200);
            }
            return;
        }

        window.setTimeout(start, 1200);
    }

    function initializeRolePermissionEnhancer() {
        if (window.__suitesenseRolePermissionEnhancerInitialized || !areSuitesenseInlineEnhancementsEnabled()) {
            return;
        }

        function start() {
            if (window.__suitesenseRolePermissionEnhancerInitialized || typeof window.dropdowns === 'undefined' || !areSuitesenseInlineEnhancementsEnabled()) {
                return;
            }

            window.__suitesenseRolePermissionEnhancerInitialized = true;
            injectRolePermissionEnhancerStyles();

            Object.keys(window.dropdowns).forEach((key) => {
                const nsDropdown = window.dropdowns[key];
                if (!isRolePermissionDropdown(nsDropdown)) {
                    return;
                }

                attachRolePermissionEnhancer(nsDropdown);
            });
        }

        if (window.NS && window.NS.form && typeof window.NS.form.isInited === 'function') {
            if (window.NS.form.isInited()) {
                start();
            } else if (window.NS.event && window.NS.event.type && typeof window.NS.event.once === 'function') {
                window.NS.event.once(window.NS.event.type.FORM_INITED, start);
            } else {
                window.setTimeout(start, 1200);
            }
            return;
        }

        window.setTimeout(start, 1200);
    }

    function injectRolePermissionEnhancerStyles() {
        if (document.getElementById('suitesense-role-permission-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'suitesense-role-permission-styles';
        style.textContent = `
            .suitesense-perm-panel {
                padding: 0;
                background: #ffffff;
                position: sticky;
                top: 0;
                z-index: 4;
            }

            .suitesense-perm-searchrow {
                padding: 4px 6px;
                background: #ffffff;
                border-bottom: 1px solid #e2e6ec;
            }

            .suitesense-perm-search {
                width: 100%;
                border: 1px solid #c7cfda;
                padding: 4px 7px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                outline: none;
                box-sizing: border-box;
                color: #2f4058;
                background: #ffffff;
            }

            .suitesense-perm-search:focus {
                border-color: #8191a8;
                box-shadow: none;
            }

            .suitesense-perm-toolbar {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                background: #ffffff;
                border-bottom: 1px solid #e2e6ec;
            }

            .suitesense-perm-tab {
                border: 1px solid #aeb8c7;
                background: #f7f8fa;
                color: #31425a;
                padding: 2px 9px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                cursor: pointer;
            }

            .suitesense-perm-tab.is-active {
                background: #eef3f8;
                border-color: #8d9bb0;
                color: #23364f;
                font-weight: 700;
            }

            .suitesense-perm-count {
                margin-left: auto;
                color: #5d6c82;
                font: 11px/1.2 "Segoe UI", Arial, sans-serif;
            }

            .suitesense-perm-option {
                white-space: nowrap;
            }

            .suitesense-perm-option.is-selected {
                background: #f2f7f2;
            }

            .suitesense-perm-marker {
                display: inline-block;
                width: 18px;
                text-align: center;
                color: #2aa35a;
                font: 12px/1 "Segoe UI", Arial, sans-serif;
                vertical-align: middle;
                pointer-events: none;
            }

            .suitesense-perm-label {
                display: inline-block;
                width: calc(100% - 24px);
                vertical-align: middle;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                pointer-events: none;
            }

            .suitesense-perm-highlight {
                background: #fff2a8;
                color: inherit;
            }
        `;
        document.documentElement.appendChild(style);
    }

    function isRolePermissionDropdown(nsDropdown) {
        if (!nsDropdown || !Array.isArray(nsDropdown.textArray) || nsDropdown.textArray.length < 15) {
            return false;
        }

        const path = String(window.location.pathname || '').toLowerCase();
        const inputId = String(nsDropdown.inpt?.id || '').toLowerCase();
        const inputName = String(nsDropdown.name || '').toLowerCase();
        const rowText = String(nsDropdown.inpt?.closest('tr, table, td, div')?.textContent || '').toLowerCase();
        const pageText = String(document.body?.textContent || '').toLowerCase();
        const isSavedSearchContext = path.includes('/app/common/search/') || path.includes('/app/common/workflow/');
        const hasPermissionsContext = pageText.includes('permissions') && pageText.includes('level');
        const hasRolePageContext = path.includes('/app/setup/role') ||
            (pageText.includes('permissions') &&
                pageText.includes('restrictions') &&
                pageText.includes('forms') &&
                pageText.includes('searches') &&
                pageText.includes('users') &&
                pageText.includes('preferences'));

        if (isSavedSearchContext || !hasPermissionsContext || !hasRolePageContext) {
            return false;
        }

        const looksLikePermissionList = nsDropdown.textArray.some((text) => {
            const normalized = String(text || '').trim().toLowerCase();
            return normalized.includes('audit trail') ||
                normalized.includes('purchase order') ||
                normalized.includes('sales order') ||
                normalized.includes('customer payment') ||
                normalized.includes('cash sale');
        });

        const keywordMatch = suitesenseRolePermissionKeywords.some((keyword) => {
            return inputId.includes(keyword) || inputName.includes(keyword) || rowText.includes(keyword);
        });

        return keywordMatch || looksLikePermissionList;
    }

    function attachRolePermissionEnhancer(nsDropdown) {
        if (!nsDropdown || nsDropdown.__suitesenseRolePermissionAttached) {
            return;
        }

        const openEnhancer = () => {
            window.clearTimeout(nsDropdown.__suitesenseRoleRenderTimer);
            nsDropdown.__suitesenseRoleRenderTimer = window.setTimeout(() => renderRolePermissionEnhancer(nsDropdown, true), 0);
        };

        if (nsDropdown.inpt && typeof nsDropdown.inpt.addEventListener === 'function') {
            nsDropdown.inpt.addEventListener('click', openEnhancer);
            nsDropdown.inpt.addEventListener('focus', openEnhancer);
        }

        const arrow = document.getElementById(`${nsDropdown.inpt?.id || ''}_arrow`);
        if (arrow) {
            arrow.addEventListener('click', openEnhancer);
        }

        if (typeof nsDropdown.open === 'function' && !nsDropdown.__suitesenseRoleOpenWrapped) {
            const originalOpen = nsDropdown.open.bind(nsDropdown);
            nsDropdown.open = function(...args) {
                const result = originalOpen(...args);
                renderRolePermissionEnhancer(nsDropdown, false);
                return result;
            };
            nsDropdown.__suitesenseRoleOpenWrapped = true;
        }

        if (typeof nsDropdown.buildDiv === 'function' && !nsDropdown.__suitesenseRoleBuildWrapped) {
            const originalBuildDiv = nsDropdown.buildDiv.bind(nsDropdown);
            nsDropdown.buildDiv = function(...args) {
                const result = originalBuildDiv(...args);
                renderRolePermissionEnhancer(nsDropdown, false);
                return result;
            };
            nsDropdown.__suitesenseRoleBuildWrapped = true;
        }

        nsDropdown.__suitesenseRolePermissionAttached = true;
    }

    function renderRolePermissionEnhancer(nsDropdown, shouldFocusSearch) {
        try {
            if (!areSuitesenseInlineEnhancementsEnabled()) {
                cleanupRolePermissionEnhancers();
                return;
            }

            if (!nsDropdown.div && typeof nsDropdown.buildDiv === 'function') {
                nsDropdown.buildDiv();
            }

            if (!nsDropdown.div || !Array.isArray(nsDropdown.divArray) || !Array.isArray(nsDropdown.textArray)) {
                return;
            }

            const optionModels = buildRolePermissionOptions(nsDropdown);
            if (!optionModels.length) {
                return;
            }

            const permissionLevels = getCurrentRolePermissionLevels();
            const selectedPermissions = new Set(permissionLevels.keys());
            const state = nsDropdown.__suitesenseRoleState || { filter: 'all' };

            nsDropdown.div.style.setProperty('width', `${Math.max(parseInt(nsDropdown.div.style.width || '0', 10) || 0, 360)}px`);

            let panel = nsDropdown.div.querySelector(':scope > .suitesense-perm-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'suitesense-perm-panel';
                panel.innerHTML = `
                    <div class="suitesense-perm-toolbar">
                        <button type="button" class="suitesense-perm-tab is-active" data-filter="all">All</button>
                        <button type="button" class="suitesense-perm-tab" data-filter="selected">Selected</button>
                        <button type="button" class="suitesense-perm-tab" data-filter="missing">Missing</button>
                        <div class="suitesense-perm-count"></div>
                    </div>
                `;
                nsDropdown.div.insertBefore(panel, nsDropdown.div.firstChild);
            }

            decorateRolePermissionOptionsMinimal(nsDropdown, optionModels, permissionLevels);

            const countElement = panel.querySelector('.suitesense-perm-count');

            const filterOptions = () => {
                const searchTerm = String(nsDropdown.inpt?.value || '').trim().toLowerCase();
                let shown = 0;

                optionModels.forEach((option) => {
                    const matchesText = !searchTerm || option.label.toLowerCase().includes(searchTerm);
                    const matchesSelection = state.filter === 'all' ||
                        (state.filter === 'selected' && option.selected) ||
                        (state.filter === 'missing' && !option.selected);
                    const visible = matchesText && matchesSelection;
                    option.element.style.setProperty('display', visible ? '' : 'none');
                    resetRolePermissionOptionMinimal(option);

                    if (visible) {
                        shown += 1;
                    }
                });

                countElement.textContent = `Showing ${shown} of ${optionModels.length} permissions.`;
            };

            if (!panel.dataset.suitesenseBound) {
                panel.dataset.suitesenseBound = 'true';

                ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach((eventName) => {
                    panel.addEventListener(eventName, (event) => {
                        event.stopPropagation();
                    });
                });

                nsDropdown.inpt?.addEventListener('keyup', (event) => {
                    event.stopPropagation();
                    filterOptions();
                });
                nsDropdown.inpt?.addEventListener('input', filterOptions);

                panel.querySelector('.suitesense-perm-toolbar').addEventListener('click', (event) => {
                    const button = event.target.closest('[data-filter]');
                    if (!button) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    state.filter = button.dataset.filter || 'all';
                    Array.from(panel.querySelectorAll('[data-filter]')).forEach((tab) => {
                        tab.classList.toggle('is-active', tab === button);
                    });
                    filterOptions();
                });
            }

            nsDropdown.__suitesenseRoleState = state;
            filterOptions();
            if (shouldFocusSearch) {
                window.setTimeout(() => nsDropdown.inpt?.focus(), 0);
            }
        } catch (error) {
            console.error('Suitesense Role Permission enhancer failed:', error);
        }
    }

    function buildRolePermissionOptions(nsDropdown) {
        return nsDropdown.textArray.map((text, index) => {
            const element = nsDropdown.divArray[index];
            const label = String(text || '').trim();
            if (!element || !label) {
                return null;
            }

            return {
                element,
                index,
                label,
                selected: false
            };
        }).filter(Boolean);
    }

    function getCurrentRolePermissionLevels() {
        const levels = new Map();
        Array.from(document.querySelectorAll('tr')).forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 2) {
                return;
            }

            const permission = String(cells[0].textContent || '').trim();
            const level = String(cells[1].textContent || '').trim();

            if (!permission || !level) {
                return;
            }

            if (/permission|level|add|cancel|insert|remove/i.test(permission)) {
                return;
            }

            if (/^(view|create|edit|full)$/i.test(level)) {
                levels.set(permission, level);
            }
        });
        return levels;
    }

    function decorateRolePermissionOptions(optionModels, selectedPermissions) {
        optionModels.forEach((option) => {
            option.selected = selectedPermissions.has(option.label);

            if (option.element.dataset.suitesenseRoleDecorated === 'true') {
                if (option.markerElement) {
                    option.markerElement.textContent = option.selected ? '✓' : '';
                }
                return;
            }

            option.element.dataset.suitesenseRoleDecorated = 'true';
            Array.from(option.element.childNodes).forEach((childNode) => {
                if (childNode.nodeType === Node.TEXT_NODE) {
                    option.element.removeChild(childNode);
                }
            });

            const markerSpan = document.createElement('span');
            markerSpan.className = 'suitesense-perm-marker';
            markerSpan.textContent = option.selected ? '✓' : '';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'suitesense-perm-label';
            labelSpan.textContent = option.label;

            option.element.classList.add('suitesense-perm-option');
            option.element.appendChild(markerSpan);
            option.element.appendChild(labelSpan);
            option.markerElement = markerSpan;
            option.labelElement = labelSpan;
        });
    }

    function resetRolePermissionOption(option) {
        if (option.markerElement) {
            option.markerElement.textContent = option.selected ? '✓' : '';
        }
        if (option.labelElement) {
            option.labelElement.textContent = option.label;
        }
    }

    function decorateRolePermissionOptionsMinimal(nsDropdown, optionModels, permissionLevels) {
        optionModels.forEach((option) => {
            const currentLevel = permissionLevels.get(option.label) || '';
            option.selected = permissionLevels.has(option.label);
            option.element.classList.add('suitesense-perm-option');
            option.element.classList.toggle('is-selected', option.selected);
            option.element.setAttribute('title', option.selected ? `${option.label} (${currentLevel})` : option.label);

            if (option.element.dataset.suitesenseRoleSelectBound === 'true') {
                return;
            }

            option.element.dataset.suitesenseRoleSelectBound = 'true';
            option.element.addEventListener('mousedown', () => {
                if (!areSuitesenseInlineEnhancementsEnabled()) {
                    return;
                }

                if (typeof option.index !== 'number') {
                    return;
                }

                if (typeof nsDropdown.setCurrentCellInMenu === 'function') {
                    nsDropdown.setCurrentCellInMenu(option.element);
                }

                if (typeof nsDropdown.setIndex === 'function') {
                    nsDropdown.setIndex(option.index);
                }

                nsDropdown.indexOnDeck = option.index;
                nsDropdown.currentCell = option.element;
            });
        });
    }

    function resetRolePermissionOptionMinimal(option) {
        option.element.classList.toggle('is-selected', option.selected);
    }

    function injectSavedSearchFieldEnhancerStyles() {
        if (document.getElementById('suitesense-saved-search-fieldfinder-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'suitesense-saved-search-fieldfinder-styles';
        style.textContent = `
            .suitesense-dd-panel {
                padding: 0;
                background: #ffffff;
                border-bottom: 0;
                position: sticky;
                top: 0;
                z-index: 4;
            }

            .suitesense-dd-searchrow {
                padding: 4px 6px 4px;
                background: #ffffff;
                border-bottom: 1px solid #e2e6ec;
            }

            .suitesense-dd-search {
                width: 100%;
                border: 1px solid #c7cfda;
                padding: 4px 7px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                outline: none;
                box-sizing: border-box;
                color: #2f4058;
                background: #ffffff;
            }

            .suitesense-dd-search:focus {
                border-color: #8191a8;
                box-shadow: none;
            }

            .suitesense-dd-toolbar {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 4px 6px;
                flex-wrap: nowrap;
                background: #ffffff;
            }

            .suitesense-dd-tab {
                border: 1px solid #aeb8c7;
                background: #f7f8fa;
                color: #31425a;
                padding: 2px 9px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                cursor: pointer;
            }

            .suitesense-dd-tab.is-active {
                background: #eef3f8;
                border-color: #8d9bb0;
                color: #23364f;
                font-weight: 700;
            }

            .suitesense-dd-count {
                margin-left: auto;
                color: #5d6c82;
                font: 11px/1.2 "Segoe UI", Arial, sans-serif;
            }

            .suitesense-dd-option {
                white-space: nowrap;
            }

            .suitesense-dd-option-marker {
                display: inline-block;
                width: 24px;
                color: #4b5b73;
                font: 12px/1 "Segoe UI", Arial, sans-serif;
                vertical-align: middle;
                text-align: center;
                pointer-events: none;
            }

            .suitesense-dd-option-marker.is-selected {
                color: #2aa35a;
                font-weight: 700;
            }

            .suitesense-dd-option-label {
                display: inline-block;
                width: 256px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                vertical-align: middle;
                pointer-events: none;
            }

            .suitesense-dd-option-label.is-related::before {
                content: '▶';
                display: inline-block;
                margin-right: 6px;
                color: #41556f;
                font-size: 10px;
                vertical-align: middle;
            }

            .suitesense-dd-option-meta {
                display: inline-block;
                width: 280px;
                color: #58697f;
                font: 11px/1.2 Consolas, "SFMono-Regular", monospace;
                white-space: nowrap;
                vertical-align: middle;
                pointer-events: none;
            }

            .suitesense-dd-option-type {
                display: inline-block;
                width: 112px;
                color: #34485f;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                vertical-align: middle;
                pointer-events: none;
            }

            .suitesense-dd-option-datatype {
                display: inline-block;
                width: 104px;
                color: #34485f;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                vertical-align: middle;
                pointer-events: none;
            }

            .suitesense-dd-headerrow {
                display: block;
                background: #ffffff;
                color: #5d6c82;
                padding: 4px 10px 5px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                border-top: 0;
                border-bottom: 1px solid #e2e6ec;
            }

            .suitesense-dd-headercell {
                display: inline-block;
                vertical-align: middle;
            }

            .suitesense-dd-headercell-name { width: 280px; }
            .suitesense-dd-headercell-id { width: 280px; }
            .suitesense-dd-headercell-type { width: 112px; }
            .suitesense-dd-headercell-data { width: 104px; }

            .suitesense-dd-highlight {
                background: #fff2a8;
                color: inherit;
            }

            .suitesense-dd-footer {
                background: #eef1f5;
                border-top: 0;
                color: #5d6c82;
                font: 11px/1.2 "Segoe UI", Arial, sans-serif;
                padding: 5px 10px;
            }
        `;
        document.documentElement.appendChild(style);
    }

    function attachSavedSearchFieldEnhancer(nsDropdown) {
        if (!nsDropdown || nsDropdown.__suitesenseEnhancerAttached) {
            return;
        }

        const openEnhancer = () => {
            window.clearTimeout(nsDropdown.__suitesenseRenderTimer);
            nsDropdown.__suitesenseRenderTimer = window.setTimeout(() => renderSavedSearchFieldEnhancer(nsDropdown, true), 0);
        };

        if (nsDropdown.inpt && typeof nsDropdown.inpt.addEventListener === 'function') {
            nsDropdown.inpt.addEventListener('click', openEnhancer);
            nsDropdown.inpt.addEventListener('focus', openEnhancer);
        }

        const arrow = document.getElementById(`${nsDropdown.inpt?.id || ''}_arrow`);
        if (arrow) {
            arrow.addEventListener('click', openEnhancer);
        }

        if (typeof nsDropdown.open === 'function' && !nsDropdown.__suitesenseOpenWrapped) {
            const originalOpen = nsDropdown.open.bind(nsDropdown);
            nsDropdown.open = function(...args) {
                const result = originalOpen(...args);
                renderSavedSearchFieldEnhancer(nsDropdown, false);
                return result;
            };
            nsDropdown.__suitesenseOpenWrapped = true;
        }

        if (typeof nsDropdown.buildDiv === 'function' && !nsDropdown.__suitesenseBuildWrapped) {
            const originalBuildDiv = nsDropdown.buildDiv.bind(nsDropdown);
            nsDropdown.buildDiv = function(...args) {
                const result = originalBuildDiv(...args);
                renderSavedSearchFieldEnhancer(nsDropdown, false);
                return result;
            };
            nsDropdown.__suitesenseBuildWrapped = true;
        }

        nsDropdown.__suitesenseEnhancerAttached = true;
    }

    function renderSavedSearchFieldEnhancer(nsDropdown, shouldFocusSearch) {
        try {
            if (!areSuitesenseInlineEnhancementsEnabled()) {
                cleanupSavedSearchFieldEnhancers();
                return;
            }

            if (!nsDropdown.div && typeof nsDropdown.buildDiv === 'function') {
                nsDropdown.buildDiv();
            }

            if (!nsDropdown.div || !Array.isArray(nsDropdown.divArray) || !Array.isArray(nsDropdown.textArray)) {
                return;
            }

            const optionModels = buildSavedSearchDropdownOptions(nsDropdown);
            if (!optionModels.length) {
                return;
            }

            refreshSavedSearchMultiSelectState(nsDropdown, optionModels);

            nsDropdown.div.style.setProperty('width', `${Math.max(parseInt(nsDropdown.div.style.width || '0', 10) || 0, 800)}px`);
            nsDropdown.div.style.setProperty('margin-top', '0');
            nsDropdown.div.style.setProperty('margin-bottom', '0');
            nsDropdown.div.style.setProperty('padding-top', '0');
            nsDropdown.div.style.setProperty('padding-bottom', '0');
            nsDropdown.div.style.setProperty('border-top', '0');
            nsDropdown.div.style.setProperty('box-shadow', 'none');

            let panel = nsDropdown.div.querySelector(':scope > .suitesense-dd-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'suitesense-dd-panel';
                panel.innerHTML = `
                    <div class="suitesense-dd-searchrow">
                        <input class="suitesense-dd-search" type="text" placeholder="Filter by Name or ID" autocomplete="off" />
                    </div>
                    <div class="suitesense-dd-toolbar">
                        <button type="button" class="suitesense-dd-tab is-active" data-kind="all">All</button>
                        <button type="button" class="suitesense-dd-tab" data-kind="standard">Standard</button>
                        <button type="button" class="suitesense-dd-tab" data-kind="custom">Custom</button>
                        <button type="button" class="suitesense-dd-tab" data-kind="related">Related</button>
                        <button type="button" class="suitesense-dd-tab" data-kind="formula">Formula</button>
                        <div class="suitesense-dd-count"></div>
                    </div>
                    <div class="suitesense-dd-headerrow">
                        <span class="suitesense-dd-headercell suitesense-dd-headercell-name"></span>
                        <span class="suitesense-dd-headercell suitesense-dd-headercell-id"></span>
                        <span class="suitesense-dd-headercell suitesense-dd-headercell-type">Field Type</span>
                        <span class="suitesense-dd-headercell suitesense-dd-headercell-data">Data Type</span>
                    </div>
                `;
                nsDropdown.div.insertBefore(panel, nsDropdown.div.firstChild);
            }

            let footer = nsDropdown.div.querySelector(':scope > .suitesense-dd-footer');
            if (!footer) {
                footer = document.createElement('div');
                footer.className = 'suitesense-dd-footer';
                nsDropdown.div.appendChild(footer);
            }

            decorateSavedSearchDropdownOptions(nsDropdown, optionModels);

            const state = nsDropdown.__suitesenseEnhancerState || {
                activeKind: 'all'
            };

            const searchInput = panel.querySelector('.suitesense-dd-search');
            const countElement = panel.querySelector('.suitesense-dd-count');
            const footerElement = footer;
            const headerRow = panel.querySelector('.suitesense-dd-headerrow');
            const headerName = headerRow.querySelector('.suitesense-dd-headercell-name');
            const headerId = headerRow.querySelector('.suitesense-dd-headercell-id');
            headerName.textContent = '';
            headerId.textContent = '';

            const filterOptions = () => {
                const searchTerm = String(searchInput.value || '').trim().toLowerCase();
                let shown = 0;
                const firstVisible = [];

                optionModels.forEach((option) => {
                    const kindMatch = state.activeKind === 'all' || option.category === state.activeKind;
                    const haystack = `${option.label} ${option.prettyId}`.toLowerCase();
                    const visible = kindMatch && (!searchTerm || haystack.includes(searchTerm));
                    option.element.style.setProperty('display', visible ? '' : 'none');
                    resetSavedSearchOption(option);

                    if (visible && searchTerm) {
                        highlightSavedSearchOptionPart(option.labelElement, option.label, searchTerm);
                        highlightSavedSearchOptionPart(option.idElement, option.prettyId, searchTerm);
                    }

                    if (visible) {
                        if (!firstVisible.length) {
                            firstVisible.push(option);
                        }
                        shown += 1;
                    }
                });

                countElement.textContent = `Showing ${shown} of ${optionModels.length} fields.`;
                footerElement.textContent = `Showing ${shown} of ${optionModels.length} fields.`;

                if (typeof nsDropdown.respondToArrow === 'function' && typeof nsDropdown.indexOnDeck === 'number') {
                    nsDropdown.respondToArrow(0 - nsDropdown.indexOnDeck);
                }

            };

            Array.from(nsDropdown.div.children).forEach((child) => {
                if (child === panel || child === footer) {
                    return;
                }

                const text = String(child.textContent || '').trim();
                if (!text && !child.classList.contains('suitesense-dd-option')) {
                    child.style.display = 'none';
                }
            });

            if (!panel.dataset.suitesenseBound) {
                panel.dataset.suitesenseBound = 'true';

                ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach((eventName) => {
                    panel.addEventListener(eventName, (event) => {
                        event.stopPropagation();
                    });
                });

                ['mousedown', 'mouseup', 'click', 'pointerdown'].forEach((eventName) => {
                    searchInput.addEventListener(eventName, (event) => {
                        event.stopPropagation();
                        if (eventName !== 'mouseup') {
                            event.preventDefault();
                        }
                        searchInput.focus();
                    });
                });

                searchInput.addEventListener('keydown', (event) => {
                    event.stopPropagation();

                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        moveSavedSearchSelection(nsDropdown, optionModels, 1);
                        return;
                    }

                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        moveSavedSearchSelection(nsDropdown, optionModels, -1);
                        return;
                    }

                    if ((event.key === 'Enter' || event.key === 'Tab') && typeof nsDropdown.setAndClose === 'function') {
                        event.preventDefault();
                        nsDropdown.setAndClose(nsDropdown.indexOnDeck || 0);
                    }
                });

                searchInput.addEventListener('keyup', (event) => {
                    event.stopPropagation();
                    filterOptions();
                });

                searchInput.addEventListener('keypress', (event) => {
                    event.stopPropagation();
                });

                searchInput.addEventListener('input', filterOptions);

                panel.querySelector('.suitesense-dd-toolbar').addEventListener('click', (event) => {
                    const button = event.target.closest('[data-kind]');
                    if (!button) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    state.activeKind = button.dataset.kind || 'all';
                    Array.from(panel.querySelectorAll('[data-kind]')).forEach((tab) => {
                        tab.classList.toggle('is-active', tab === button);
                    });
                    filterOptions();
                });
            }

            nsDropdown.__suitesenseEnhancerState = state;
            filterOptions();
            if (shouldFocusSearch) {
                window.setTimeout(() => searchInput.focus(), 0);
            }
        } catch (error) {
            console.error('Suitesense Saved Search enhancer failed:', error);
        }
    }

    function buildSavedSearchDropdownOptions(nsDropdown) {
        return nsDropdown.textArray.map((text, index) => {
            const element = nsDropdown.divArray[index];
            if (!element) {
                return null;
            }

            const label = String(text || '').replace(/\((Custom Body|Custom Column|Custom)\)/i, '').trim() || String(text || '').trim();
            const value = String(nsDropdown.valueArray[index] || '').trim();
            if (!label && !value) {
                return null;
            }
            return {
                category: getSavedSearchCategory(value, text),
                element,
                fullText: String(text || '').trim(),
                index,
                idElement: null,
                label,
                labelElement: null,
                markerElement: null,
                prettyId: prettySavedSearchFieldId(value),
                selected: false,
                typeLabel: getSavedSearchFieldTypeLabel(value, text),
                dataType: getSavedSearchDataType(nsDropdown, value),
                value
            };
        }).filter(Boolean);
    }

    function prettySavedSearchFieldId(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/^(stdentity|stdbody|custom_|transaction_)/, '');
    }

    function getSavedSearchCategory(value, text) {
        const rawValue = String(value || '').toLowerCase();
        const rawText = String(text || '').toLowerCase();

        if (/_formula/.test(rawValue) || rawText.includes('formula')) {
            return 'formula';
        }

        if (rawValue.startsWith('custbody') || rawValue.startsWith('custcol') || rawValue.startsWith('custrecord') || rawValue.startsWith('custentity') || rawValue.startsWith('custitem') || rawText.includes('(custom')) {
            return 'custom';
        }

        if (rawText.endsWith('fields...')) {
            return 'related';
        }

        return 'standard';
    }

    function getSavedSearchFieldTypeLabel(value, text) {
        const rawValue = String(value || '').toLowerCase();
        const category = getSavedSearchCategory(value, text);
        if (category === 'formula') {
            return 'Formula Field';
        }
        if (category === 'related') {
            return 'Related Fields';
        }
        if (category === 'custom') {
            if (rawValue.startsWith('custbody')) {
                return 'Custom Column';
            }
            if (rawValue.startsWith('custcol')) {
                return 'Custom Body';
            }
            return 'Custom Field';
        }
        return 'Standard Field';
    }

    function getSavedSearchDataType(nsDropdown, fieldId) {
        const normalizedFieldId = String(fieldId || '').toLowerCase();
        if (normalizedFieldId === 'formuladate') {
            return 'DATE';
        }
        if (normalizedFieldId === 'formulanumeric') {
            return 'FLOAT';
        }
        if (normalizedFieldId === 'formulatext') {
            return 'TEXT';
        }
        if (normalizedFieldId === 'formulacurrency') {
            return 'CURRENCY';
        }
        if (normalizedFieldId === 'formulapercent') {
            return 'PERCENT';
        }
        try {
            if ((nsDropdown.name === 'fffilter' || nsDropdown.name === 'filterfilter') && typeof window.ffTypes === 'object' && window.ffTypes) {
                return window.ffTypes[fieldId] || '';
            }
            if (nsDropdown.name === 'rffield' && typeof window.rfTypes === 'object' && window.rfTypes) {
                return window.rfTypes[fieldId] || '';
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function decorateSavedSearchDropdownOptions(nsDropdown, optionModels) {
        optionModels.forEach((option) => {
            if (!option.element || option.element.dataset.suitesenseDecorated === 'true') {
                return;
            }

            option.element.dataset.suitesenseDecorated = 'true';
            Array.from(option.element.childNodes).forEach((childNode) => {
                if (childNode.nodeType === Node.TEXT_NODE) {
                    option.element.removeChild(childNode);
                }
            });

            const markerSpan = document.createElement('span');
            markerSpan.className = 'suitesense-dd-option-marker';
            markerSpan.textContent = '';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'suitesense-dd-option-label';
            if (option.category === 'related') {
                labelSpan.classList.add('is-related');
            }
            labelSpan.textContent = option.label;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'suitesense-dd-option-meta';
            metaSpan.textContent = option.prettyId;

            const typeSpan = document.createElement('span');
            typeSpan.className = 'suitesense-dd-option-type';
            typeSpan.textContent = option.typeLabel;

            const dataTypeSpan = document.createElement('span');
            dataTypeSpan.className = 'suitesense-dd-option-datatype';
            dataTypeSpan.textContent = option.dataType;

            option.element.classList.add('suitesense-dd-option');
            option.element.setAttribute('data-suitesense-value', option.value);
            option.element.appendChild(markerSpan);
            option.element.appendChild(labelSpan);
            option.element.appendChild(metaSpan);
            option.element.appendChild(typeSpan);
            option.element.appendChild(dataTypeSpan);
            option.element.setAttribute('title', option.prettyId || option.label);
            option.markerElement = markerSpan;
            option.labelElement = labelSpan;
            option.idElement = metaSpan;

            option.element.addEventListener('mousedown', (event) => {
                if (!areSuitesenseInlineEnhancementsEnabled()) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                selectSavedSearchOption(nsDropdown, option);
            });
        });
    }

    function selectSavedSearchOption(nsDropdown, option) {
        if (!areSuitesenseInlineEnhancementsEnabled() || !nsDropdown || typeof option.index !== 'number') {
            return;
        }

        if (isSavedSearchMultiSelectDropdown(nsDropdown)) {
            toggleSavedSearchMultiSelectOption(nsDropdown, option);
            return;
        }

        if (typeof nsDropdown.setCurrentCellInMenu === 'function') {
            nsDropdown.setCurrentCellInMenu(option.element);
        }

        if (typeof nsDropdown.setIndex === 'function') {
            nsDropdown.setIndex(option.index);
        }

        nsDropdown.indexOnDeck = option.index;
        nsDropdown.currentCell = option.element;

        if (typeof nsDropdown.setAndClose === 'function') {
            nsDropdown.setAndClose(option.index);
            return;
        }

        if (nsDropdown.hddn) {
            nsDropdown.hddn.value = option.value;
        }

        if (nsDropdown.inpt) {
            nsDropdown.inpt.value = option.fullText || option.label;
        }

        if (typeof nsDropdown.close === 'function') {
            nsDropdown.close();
        }
    }

    function isSavedSearchMultiSelectDropdown(nsDropdown) {
        const machineName = String(nsDropdown?.hddn?.machine?.name || '').toLowerCase();
        return suitesenseMultiSelectMachineNames.includes(machineName);
    }

    function getSavedSearchSelectedFieldIds(nsDropdown) {
        const machine = nsDropdown?.hddn?.machine;
        if (!machine || !machine.dataManager || typeof machine.dataManager.getLineArray !== 'function') {
            return [];
        }

        try {
            return machine.dataManager.getLineArray()
                .map((line) => Array.isArray(line) ? String(line[0] || '').trim() : '')
                .filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    function refreshSavedSearchMultiSelectState(nsDropdown, optionModels) {
        const selectedFieldIds = new Set(getSavedSearchSelectedFieldIds(nsDropdown));
        optionModels.forEach((option) => {
            option.selected = selectedFieldIds.has(option.value);
            if (option.markerElement) {
                option.markerElement.textContent = option.selected ? '✓' : '';
                option.markerElement.classList.toggle('is-selected', option.selected);
            }
        });
    }

    function toggleSavedSearchMultiSelectOption(nsDropdown, option) {
        if (!areSuitesenseInlineEnhancementsEnabled()) {
            return;
        }

        const machine = nsDropdown?.hddn?.machine;
        const machineName = String(machine?.name || '').toLowerCase();
        const fieldKey = suitesenseMachineFieldIds[machineName];
        if (!machine || !fieldKey || !machine.dataManager || typeof machine.dataManager.findFieldValueLineNum !== 'function') {
            return;
        }

        const existingLine = machine.dataManager.findFieldValueLineNum(fieldKey, option.value);

        if (existingLine === -1) {
            if (typeof machine.insertLine === 'function') {
                machine.insertLine([option.value, '', '', '', '', '', ''], machine.getLineCount() + 1);
            }
            if (typeof machine.incrementIndex === 'function') {
                machine.incrementIndex();
            }
            if (typeof machine.setMachineIndex === 'function' && typeof machine.getLineCount === 'function') {
                machine.setMachineIndex(machine.getLineCount() + 1);
            }
        } else {
            if (typeof machine.deleteline === 'function') {
                machine.deleteline(existingLine, true);
            }
            if (typeof machine.getLineCount === 'function' && typeof machine.setMachineIndex === 'function') {
                machine.setMachineIndex(machine.getLineCount() + 1);
            }
            if (typeof machine.clearline === 'function') {
                machine.clearline();
            }
        }

        if (typeof machine.buildtable === 'function') {
            machine.buildtable();
        }

        window.setTimeout(() => {
            renderSavedSearchFieldEnhancer(nsDropdown, false);
            if (typeof nsDropdown.open === 'function') {
                nsDropdown.open();
            }
        }, 0);
    }

    function resetSavedSearchOption(option) {
        if (option.markerElement) {
            option.markerElement.textContent = option.selected ? '✓' : '';
            option.markerElement.classList.toggle('is-selected', !!option.selected);
        }
        if (option.labelElement) {
            option.labelElement.textContent = option.label;
        }
        if (option.idElement) {
            option.idElement.textContent = option.prettyId;
        }
    }

    function highlightSavedSearchOptionPart(element, originalText, searchTerm) {
        if (!element || !searchTerm) {
            return;
        }

        const index = originalText.toLowerCase().indexOf(searchTerm);
        if (index === -1) {
            element.textContent = originalText;
            return;
        }

        const before = escapeHtml(originalText.slice(0, index));
        const match = escapeHtml(originalText.slice(index, index + searchTerm.length));
        const after = escapeHtml(originalText.slice(index + searchTerm.length));
        element.innerHTML = `${before}<mark class="suitesense-dd-highlight">${match}</mark>${after}`;
    }

    function moveSavedSearchSelection(nsDropdown, optionModels, delta) {
        const visibleOptions = optionModels.filter((option) => option.element.style.display !== 'none');
        if (!visibleOptions.length) {
            return;
        }

        const currentElement = nsDropdown.currentCell;
        const currentIndex = visibleOptions.findIndex((option) => option.element === currentElement);
        const nextIndex = currentIndex === -1
            ? (delta > 0 ? 0 : visibleOptions.length - 1)
            : Math.max(0, Math.min(visibleOptions.length - 1, currentIndex + delta));

        const nextOption = visibleOptions[nextIndex];
        if (!nextOption) {
            return;
        }

        if (typeof nsDropdown.setCurrentCellInMenu === 'function') {
            nsDropdown.setCurrentCellInMenu(nextOption.element);
        }

        if (nextOption.element && typeof nextOption.element.scrollIntoView === 'function') {
            nextOption.element.scrollIntoView({ block: 'nearest' });
        }

        if (typeof nsDropdown.valueToIndexMap === 'object' && typeof nsDropdown.setIndex === 'function') {
            const index = nsDropdown.valueToIndexMap[nextOption.value];
            if (typeof index !== 'undefined') {
                nsDropdown.setIndex(index);
            }
        }
    }


    initializeSavedSearchFieldEnhancer();
    initializeRolePermissionEnhancer();

    // Listening for messages from the extension
    window.addEventListener('message', function(event) {
        if (event.data.type) {
            if (event.data.type === 'SUITESENSE_INLINE_ENHANCEMENTS_CONFIG') {
                applyInlineEnhancementsPreference(event.data.enabled !== false);
            } else if (event.data.type === 'RUN_QUERY') {
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
              } else if (event.data.type === 'OPEN_CUSTOMER_BY_NAME') {
                openCustomerByName(event.data.customerName, event.data.openInNewTab !== false);
              } else if (event.data.type === 'SEARCH_SUITESCRIPTS_BY_NAME') {
                searchSuiteScriptsByName(event.data.scriptTerm);
              } else if (event.data.type === 'RESOLVE_INTERNAL_ID') {
                resolveInternalId(event.data.internalId);
              }else if (event.data.type === 'RUN_CUSTOM_SCRIPT') {
                executeCustomScript(event.data.script);
            }
        }
    });
    }

    function waitForNetSuiteModules(attempt) {
        const nextAttempt = attempt || 0;
        const nsRequire = window.require;

        if (typeof nsRequire === 'function') {
            nsRequire(['N/record', 'N/search', 'N/https', 'N/email', 'N/runtime', 'N/log'], function(record, search, https, email, runtime, log) {
                initializeSuitesenseInjected(record, search, https, email, runtime, log);
            }, function(error) {
                if (nextAttempt >= 40) {
                    console.error('Suitesense failed to initialize NetSuite modules:', error);
                    return;
                }
                window.setTimeout(() => waitForNetSuiteModules(nextAttempt + 1), 250);
            });
            return;
        }

        if (nextAttempt >= 40) {
            console.error('Suitesense could not find NetSuite require() on this page.');
            return;
        }

        window.setTimeout(() => waitForNetSuiteModules(nextAttempt + 1), 250);
    }

    window.addEventListener('message', function(event) {
        if (!event.data || event.source !== window) {
            return;
        }

        if (event.data.type === 'SEARCH_SUITESCRIPTS_BY_NAME' && !window.__suitesenseModulesReady) {
            searchSuiteScriptsByPageFetch(event.data.scriptTerm);
        }
    });

    waitForNetSuiteModules(0);
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
