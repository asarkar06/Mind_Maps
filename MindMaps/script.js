document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Performance optimization - Throttle resize events
    let resizeTimeout;
    window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            if (jm) jm.resize();
        }, 250);
    });

    const options = {
        container: 'jsmind_container',
        theme: 'primary',
        editable: true,
        mode: 'full',
        view: {
            hmargin: 100,
            vmargin: 50,
            line_width: 2,
            line_color: '#555'
        },
        layout: {
            hspace: 80,
            vspace: 30,
            pspace: 13
        }
    };
    console.log('Options initialized:', options);

    const CHILDREN_PER_PAGE = 5;
    const MORE_NODE_ID_PREFIX = 'more_';
    const MORE_NODE_TOPIC = '...';

    // Track paginated nodes and their remaining children
    const paginationState = new Map();

    function createCollapsedData(originalData) {
        const rootNode = originalData.data.find(node => node.isroot);
        const firstLevelNodes = originalData.data.filter(node => node.parentid === rootNode.id);
        
        firstLevelNodes.forEach(node => {
            node._childCount = countTotalChildren(node.id, originalData.data);
        });
        
        return {
            meta: originalData.meta,
            format: originalData.format,
            data: [rootNode, ...firstLevelNodes]
        };
    }

    const nodeChildrenCache = new Map();
    function countTotalChildren(nodeId, allNodes) {
        if (nodeChildrenCache.has(nodeId)) {
            return nodeChildrenCache.get(nodeId);
        }
        
        const directChildren = allNodes.filter(node => node.parentid === nodeId);
        let total = directChildren.length;
        
        directChildren.forEach(child => {
            total += countTotalChildren(child.id, allNodes);
        });
        
        nodeChildrenCache.set(nodeId, total);
        return total;
    }

    const fullMindMapData = mindMapData;
    const collapsedMindMapData = createCollapsedData(mindMapData);

    const jm = new jsMind(options);
    console.log('jsMind instance created');
    
    jm.show(collapsedMindMapData);
    console.log('Mind map rendered in collapsed state');

    const nodeCache = new Map();
    function getChildNodes(nodeId) {
        if (nodeCache.has(nodeId)) {
            return nodeCache.get(nodeId);
        }
        const children = fullMindMapData.data.filter(node => node.parentid === nodeId);
        nodeCache.set(nodeId, children);
        return children;
    }

    function hasChildren(nodeId) {
        return getChildNodes(nodeId).length > 0;
    }

    function areChildrenRendered(nodeId) {
        const node = jm.get_node(nodeId);
        return node && node.children && node.children.length > 0;
    }

    function isMoreNode(nodeId) {
        return nodeId.startsWith(MORE_NODE_ID_PREFIX);
    }

    function getParentFromMoreNode(moreNodeId) {
        return moreNodeId.split('_')[1];
    }

    function createMoreNodeId(parentId, pageIndex) {
        return `${MORE_NODE_ID_PREFIX}${parentId}_${pageIndex}`;
    }
git 
    function getPaginationState(nodeId) {push 
        if (!paginationState.has(nodeId)) {
            paginationState.set(nodeId, {
                currentPage: 0,
                totalChildren: getChildNodes(nodeId).length
            });
        }
        return paginationState.get(nodeId);
    }

    function renderPaginatedChildren(nodeId, pageIndex = 0) {
        const childNodes = getChildNodes(nodeId);
        
        // If 5 or fewer children, render them all
        if (childNodes.length <= CHILDREN_PER_PAGE && pageIndex === 0) {
            requestAnimationFrame(() => {
                childNodes.forEach(childNode => {
                    jm.add_node(nodeId, childNode.id, childNode.topic, {
                        direction: childNode.direction,
                        expanded: false,
                        data: childNode.data || {}
                    });
                });
                
                if (jm.layout) {
                    jm.layout.layout();
                }
            });
            return;
        }

        // For more than 5 children or subsequent pages
        const startIndex = pageIndex * (CHILDREN_PER_PAGE - 1); // Reserve space for "..." node
        const endIndex = startIndex + (CHILDREN_PER_PAGE - 1);
        const currentPageNodes = childNodes.slice(startIndex, endIndex);
        const remainingNodes = childNodes.slice(endIndex);
        const hasMoreNodes = remainingNodes.length > 0;

        requestAnimationFrame(() => {
            // Render current page nodes
            currentPageNodes.forEach(childNode => {
                jm.add_node(nodeId, childNode.id, childNode.topic, {
                    direction: childNode.direction,
                    expanded: false,
                    data: childNode.data || {}
                });
            });

            // Add "..." node if there are more children
            if (hasMoreNodes) {
                const moreNodeId = createMoreNodeId(nodeId, pageIndex + 1);
                jm.add_node(nodeId, moreNodeId, MORE_NODE_TOPIC, {
                    direction: currentPageNodes[0].direction,
                    expanded: false,
                    data: {
                        isMoreNode: true,
                        parentId: nodeId,
                        pageIndex: pageIndex + 1,
                        remainingCount: remainingNodes.length
                    }
                });

                // Store remaining nodes in pagination state
                paginationState.set(moreNodeId, {
                    parentId: nodeId,
                    remainingNodes: remainingNodes,
                    currentPage: pageIndex + 1
                });
            }

            if (jm.layout) {
                jm.layout.layout();
            }
        });
    }

    function handleMoreNodeClick(moreNodeId) {
        const state = paginationState.get(moreNodeId);
        if (!state) return;

        const { parentId, currentPage } = state;
        
        // Remove the current "..." node
        jm.remove_node(moreNodeId);
        
        // Remove the state for the current "..." node
        paginationState.delete(moreNodeId);
        
        // Render the next set of children
        renderPaginatedChildren(parentId, currentPage);
    }

    let activeNodeId = null; // Track the currently active node

    function fadeAllNodes() {
        const nodes = document.querySelectorAll('jmnode');
        const expanders = document.querySelectorAll('jmexpander');
        nodes.forEach(node => node.classList.add('faded'));
        expanders.forEach(expander => expander.classList.add('faded'));
    }

    function highlightActiveNodeAndChildren(nodeId) {
        // Fade all nodes first
        fadeAllNodes();

        // Highlight the active node
        const activeNode = document.querySelector(`jmnode[nodeid="${nodeId}"]`);
        if (activeNode) {
            activeNode.classList.remove('faded');
            activeNode.classList.add('active');

            // Highlight immediate children
            const childNodes = Array.from(document.querySelectorAll('jmnode'))
                .filter(node => node.getAttribute('parentid') === nodeId);
            
            childNodes.forEach(child => {
                child.classList.remove('faded');
                child.classList.add('active');
                
                // Show the expander for the active node
                const expander = document.querySelector(`jmexpander[nodeid="${nodeId}"]`);
                if (expander) {
                    expander.classList.remove('faded');
                }
            });

            // Show the connection lines for active nodes
            const canvases = activeNode.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                const parentElement = canvas.closest('jmnode');
                if (parentElement) {
                    parentElement.classList.remove('faded');
                }
            });
        }
    }

    let clickTimeout;
    document.querySelector('#jsmind_container').addEventListener('click', function(e) {
        if (clickTimeout) clearTimeout(clickTimeout);
        
        clickTimeout = setTimeout(() => {
            const nodeElement = e.target.closest('jmnode');
            if (!nodeElement) return;

            const nodeId = nodeElement.getAttribute('nodeid');
            if (!nodeId) return;

            // Update active node
            activeNodeId = nodeId;
            highlightActiveNodeAndChildren(nodeId);

            if (isMoreNode(nodeId)) {
                handleMoreNodeClick(nodeId);
            } else if (hasChildren(nodeId) && !areChildrenRendered(nodeId)) {
                console.log('Rendering children for node:', nodeId);
                renderPaginatedChildren(nodeId, 0);
                jm.expand_node(nodeId);
            } else if (areChildrenRendered(nodeId)) {
                const node = jm.get_node(nodeId);
                if (node.isexpanded) {
                    jm.collapse_node(nodeId);
                } else {
                    jm.expand_node(nodeId);
                }
            }
        }, 50);
    });

    let updateTimeout;
    jm.add_event_listener((type, data) => {
        if (['expand_node', 'collapse_node'].includes(type)) {
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                console.log(`Node ${type === 'expand_node' ? 'expanded' : 'collapsed'}`);
            }, 100);
        }
    });

    if ('ontouchstart' in window) {
        const touchContainer = document.querySelector('#jsmind_container');
        let touchStartX, touchStartY;
        
        touchContainer.addEventListener('touchstart', function(e) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        touchContainer.addEventListener('touchmove', function(e) {
            if (!touchStartX || !touchStartY) return;
            
            const deltaX = touchStartX - e.touches[0].clientX;
            const deltaY = touchStartY - e.touches[0].clientY;
            
            touchContainer.scrollLeft += deltaX;
            touchContainer.scrollTop += deltaY;
            
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
    }

    // Initialize with root node active
    setTimeout(() => {
        const rootNode = jm.get_root();
        if (rootNode) {
            activeNodeId = rootNode.id;
            highlightActiveNodeAndChildren(rootNode.id);
        }
    }, 100);
}); 