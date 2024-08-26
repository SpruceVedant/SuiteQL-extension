console.log('Content script is running.');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('injectedScript.js');
script.onload = function() {
    console.log('Injected script successfully.');
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

console.log('Attempting to inject the script into the page.');

// Listening for messages from the injected script and forward them to the popup
window.addEventListener('message', function(event) {
    if (event.data.type && event.data.type === 'FROM_PAGE') {
        console.log('Received results from injected script:', event.data.text);
        chrome.runtime.sendMessage({ type: 'QUERY_RESULTS', data: event.data.text });
    }
});
