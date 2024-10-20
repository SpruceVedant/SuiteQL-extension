function displayTreeView(data) {
    const jsonContainer = document.getElementById('jsonContainer');
    jsonContainer.innerHTML = ''; // Clear previous tree

    const treeData = formatDataAsTree(data);

    const margin = {top: 20, right: 90, bottom: 30, left: 90},
          width = 960 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = d3.select(jsonContainer).append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const treemap = d3.tree().size([height, width]);
    const root = d3.hierarchy(treeData);

    treemap(root);

    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
        .attr("transform", d => "translate(" + d.y + "," + d.x + ")");

    node.append("circle").attr("r", 10);
    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -13 : 13)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);
}

function formatDataAsTree(data) {
    
    return { name: "Root", children: data.map(obj => {
        return { name: "Item", children: Object.entries(obj).map(([key, value]) => {
            return { name: `${key}: ${value}` };
        }) };
    }) };
}
