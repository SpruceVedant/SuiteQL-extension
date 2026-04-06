// Listen for the hierarchy data sent from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DISPLAY_HIERARCHY') {
        console.log('Hierarchy data received:', message.hierarchy); // Log hierarchy data
        console.log('Available keys:', Object.keys(message.hierarchy[0])); // Log the keys of the first result
        displayResults(message.hierarchy);
    }
});

// Function to display the results in a hierarchical tree view
function displayResults(hierarchy) {
    const hierarchyDisplay = document.getElementById('hierarchyDisplay');
    hierarchyDisplay.innerHTML = '';  // Clear any existing content

    // Create a parent list to display the hierarchy
    const ul = document.createElement('ul');
    buildTree(hierarchy[0], ul); // We are assuming the first element of the array contains the data
    hierarchyDisplay.appendChild(ul);
}

// Recursive function to build tree structure with nodes
function buildTree(node, parentElement) {
    console.log('Building tree for node:', node);  // Log node data
    const li = document.createElement('li');

    // Adjust object key access based on logged keys
    const salesOrderId = node["sales order id"] || 'N/A';
    const salesOrderNode = document.createElement('div');
    salesOrderNode.className = 'node';
    salesOrderNode.textContent = `Sales Order ID: ${salesOrderId}`;
    li.appendChild(salesOrderNode);

    // Create a child list for the invoice and customer
    const childUl = document.createElement('ul');

    // Invoice node
    const invoiceId = node["invoice id"] || 'N/A';
    const invoiceLi = document.createElement('li');
    const invoiceNode = document.createElement('div');
    invoiceNode.className = 'node';
    invoiceNode.textContent = `Invoice ID: ${invoiceId}`;
    invoiceLi.appendChild(invoiceNode);
    childUl.appendChild(invoiceLi);

    // Customer node
    const customerName = node["customer name"] || 'N/A';
    const customerLi = document.createElement('li');
    const customerNode = document.createElement('div');
    customerNode.className = 'node';
    customerNode.textContent = `Customer: ${customerName}`;
    customerLi.appendChild(customerNode);
    childUl.appendChild(customerLi);

    // Append child nodes to the parent node
    li.appendChild(childUl);
    parentElement.appendChild(li);
}

// Styling for the tree structure
const style = document.createElement('style');
style.innerHTML = `
    ul {
        list-style-type: none; /* Remove bullet points */
        margin-left: 20px; /* Indent child nodes */
    }
    .node {
        padding: 5px;
        cursor: pointer;
        border: 1px solid #ccc;
        background-color: #f9f9f9;
        border-radius: 4px;
        margin: 5px 0;
        transition: all 0.3s ease;
    }
    .node:hover {
        background-color: #e0e0e0;
    }
    .collapsible {
        display: none; /* Hide child nodes by default */
    }
    .node.collapsed + ul {
        display: none; /* Hide the children when node is collapsed */
    }
    .node.expanded {
        font-weight: bold;
    }
`;
document.head.appendChild(style);

// Added collapsibility to nodes
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('node')) {
        const node = event.target;
        const isCollapsed = node.classList.toggle('collapsed');
        node.classList.toggle('expanded', !isCollapsed);

        const nextElement = node.nextElementSibling;
        if (nextElement && nextElement.tagName === 'UL') {
            nextElement.style.display = isCollapsed ? 'none' : 'block';  // Toggle visibility of child nodes
        }
    }
});