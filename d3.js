function displayTreeView(data) {
    const jsonContainer = document.getElementById('jsonContainer');
    jsonContainer.innerHTML = ''; 

    const treeData = formatDataAsTree(data);

    const margin = {top: 20, right: 90, bottom: 30, left: 90},
          width = 960 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = d3.select(jsonContainer).append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

   
    const root = d3.hierarchy(treeData);

    treemap(root);
}

function formatDataAsTree(data) {
    
    return { name: "Root", children: data.map(obj => {
        return { name: "Item", children: Object.entries(obj).map(([key, value]) => {
            return { name: `${key}: ${value}` };
        }) };
    }) };
}
