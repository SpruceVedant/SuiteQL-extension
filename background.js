chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'runSuiteQL') {
        const { query, config } = message;

        runSuiteQL(query, config)
            .then(result => sendResponse({ result }))
            .catch(error => sendResponse({ error: error.message }));

        return true; // Keeping the message channel open for async response
    }
});

async function runSuiteQL(query, config) {
    const { ACCOUNT_ID, CONSUMER_KEY, CONSUMER_SECRET, TOKEN_ID, TOKEN_SECRET } = config;
    
    //proxy server
    const proxyUrl = 'http://localhost:8080/';  
    const targetUrl = 'https://' + ACCOUNT_ID.toLowerCase() + '.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql';
    const fullUrl = proxyUrl + targetUrl;

    const method = 'POST';
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_token: TOKEN_ID,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp,
        oauth_nonce: nonce,
        oauth_version: '1.0'
    };

    const signature = await generateOAuthSignature(method, targetUrl, params, CONSUMER_SECRET, TOKEN_SECRET);
    params.oauth_signature = signature;

    const authHeader = 'OAuth realm="' + ACCOUNT_ID + '",oauth_consumer_key="' + CONSUMER_KEY + '",oauth_token="' + TOKEN_ID + '",oauth_signature_method="HMAC-SHA256",oauth_timestamp="' + timestamp + '",oauth_nonce="' + nonce + '",oauth_version="1.0",oauth_signature="' + encodeURIComponent(signature) + '"';

    try {
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'prefer': 'transient',
                'Authorization': authHeader,
                'Origin': 'chrome-extension://cghklponalpbbhlaljooboodmbbeohgd',
                'X-Requested-With': 'XMLHttpRequest' 
            },
            body: JSON.stringify({ q: query })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return await response.json();
    } catch (error) {
        throw new Error('Error running SuiteQL query: ' + error.message);
    }
}

async function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
    const sortedParams = Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const baseString = method.toUpperCase() + '&' + encodeURIComponent(url) + '&' + encodeURIComponent(sortedParams);
    const signingKey = encodeURIComponent(consumerSecret) + '&' + encodeURIComponent(tokenSecret);

    console.log('Base String:', baseString);
    console.log('Signing Key:', signingKey);

    const keyData = new TextEncoder().encode(signingKey);
    const baseStringData = new TextEncoder().encode(baseString);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, baseStringData);
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));

    console.log('Generated Signature:', encodedSignature);

    return encodedSignature;
}
