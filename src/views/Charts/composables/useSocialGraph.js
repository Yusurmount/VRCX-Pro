import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import {
    useFriendStore,
    useUserStore,
    useManualRelationsStore
} from '../../../stores';
import { database } from '../../../services/database';
import GraphLayoutWorker from '../graphLayoutWorker.js?worker&inline';

const COLORS_PALETTE = [
    '#5470c6',
    '#91cc75',
    '#fac858',
    '#ee6666',
    '#73c0de',
    '#3ba272',
    '#fc8452',
    '#9a60b4',
    '#ea7ccc',
    '#48b8d0',
    '#f5994e',
    '#c0504d'
];

function truncateLabelText(text, maxLen = 20) {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
}

export function useSocialGraph() {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const manualRelationsStore = useManualRelationsStore();

    const { friends } = storeToRefs(friendStore);
    const { relationsList: manualRelationsList } =
        storeToRefs(manualRelationsStore);
    const cachedUsers = userStore.cachedUsers;

    const graph = ref(null);
    const isBuilding = ref(false);
    const graphNodeCount = ref(0);
    const graphEdgeCount = ref(0);
    const communities = ref(new Map());
    const bridgeNodes = ref([]);
    const isolateNodes = ref([]);

    let layoutWorker = null;

    async function runLayout(graphInstance, options = {}) {
        return new Promise((resolve, reject) => {
            if (!layoutWorker) {
                layoutWorker = new GraphLayoutWorker();
            }
            const requestId = layout__;
            const handler = (e) => {
                if (e.data.requestId !== requestId) return;
                layoutWorker.removeEventListener('message', handler);
                if (e.data.error) {
                    reject(new Error(e.data.error));
                    return;
                }
                const positions = e.data.positions;
                for (const nodeId in positions) {
                    if (graphInstance.hasNode(nodeId)) {
                        graphInstance.mergeNodeAttributes(nodeId, positions[nodeId]);
                    }
                }
                resolve();
            };
            layoutWorker.addEventListener('message', handler);

            const nodes = [];
            graphInstance.forEachNode((id, attrs) => {
                nodes.push({ id, attributes: { ...attrs } });
            });
            const edges = [];
            graphInstance.forEachEdge((edgeId, attrs, source, target) => {
                edges.push({
                    key: edgeId,
                    source,
                    target,
                    attributes: { ...attrs }
                });
            });

            layoutWorker.postMessage({
                requestId,
                nodes,
                edges,
                settings: {
                    layoutIterations: options.iterations || 500,
                    layoutSpacing: options.spacing || 50,
                    reinitialize: options.reinitialize ?? true
                }
            });
        });
    }

    function detectBridges(graphInstance) {
        const bridges = [];
        const visited = new Set();
        const low = new Map();
        const disc = new Map();
        const parentMap = new Map();
        let timer = 0;

        const adjList = new Map();
        graphInstance.forEachNode((node) => adjList.set(node, []));
        graphInstance.forEachEdge((edgeId, attrs, source, target) => {
            adjList.get(source)?.push({ node: target });
            adjList.get(target)?.push({ node: source });
        });

        function dfs(u) {
            visited.add(u);
            disc.set(u, ++timer);
            low.set(u, timer);
            for (const { node: v } of adjList.get(u) || []) {
                if (!visited.has(v)) {
                    parentMap.set(v, u);
                    dfs(v);
                    low.set(u, Math.min(low.get(u), low.get(v)));
                    if (low.get(v) > disc.get(u)) {
                        bridges.push(u);
                    }
                } else if (v !== parentMap.get(u)) {
                    low.set(u, Math.min(low.get(u), disc.get(v)));
                }
            }
        }

        for (const node of graphInstance.nodes()) {
            if (!visited.has(node)) dfs(node);
        }
        return bridges;
    }

    async function buildGraph() {
        if (isBuilding.value) return;
        isBuilding.value = true;

        try {
            const mutualSnapshot = await database.getMutualGraphSnapshot();
            const manualRels = manualRelationsList.value;

            const newGraph = new Graph({
                type: 'undirected',
                multi: false,
                allowSelfLoops: false
            });

            const ensureNode = (id, name) => {
                if (!id || newGraph.hasNode(id)) return;
                newGraph.addNode(id, {
                    label: truncateLabelText(name || id),
                    size: 5,
                    type: 'border'
                });
            };

            const addEdge = (source, target, attrs = {}) => {
                if (!source || !target || source === target) return;
                if (!newGraph.hasNode(source) || !newGraph.hasNode(target)) return;
                const [a, b] = [source, target].sort();
                const key = ${a}__;
                if (newGraph.hasEdge(key)) {
                    const existing = newGraph.getEdgeAttributes(key);
                    newGraph.setEdgeAttribute(
                        key,
                        'weight',
                        (existing.weight || 1) + 1
                    );
                } else {
                    newGraph.addEdgeWithKey(key, source, target, {
                        weight: 1,
                        ...attrs
                    });
                }
            };

            const nodeDegree = new Map();
            for (const [friendId, mutuals] of mutualSnapshot.entries()) {
                if (!friendId) continue;
                const friendEntry = friends.value?.get?.(friendId);
                const cached = cachedUsers.get(friendId);
                const name =
                    friendEntry?.ref?.displayName ||
                    cached?.displayName ||
                    friendId;
                ensureNode(friendId, name);

                for (const mutual of mutuals) {
                    const mid =
                        typeof mutual === 'string' ? mutual : mutual?.id;
                    if (!mid) continue;
                    const mCached = cachedUsers.get(mid);
                    ensureNode(mid, mCached?.displayName || mid);
                    addEdge(friendId, mid);
                    nodeDegree.set(
                        friendId,
                        (nodeDegree.get(friendId) || 0) + 1
                    );
                    nodeDegree.set(mid, (nodeDegree.get(mid) || 0) + 1);
                }
            }

            for (const rel of manualRels) {
                const { userIdA, userIdB } = rel;
                if (!userIdA || !userIdB) continue;
                const refA = cachedUsers.get(userIdA);
                const refB = cachedUsers.get(userIdB);
                ensureNode(userIdA, refA?.displayName || userIdA);
                ensureNode(userIdB, refB?.displayName || userIdB);
                addEdge(userIdA, userIdB, { manualRelation: true });
                nodeDegree.set(
                    userIdA,
                    (nodeDegree.get(userIdA) || 0) + 1
                );
                nodeDegree.set(
                    userIdB,
                    (nodeDegree.get(userIdB) || 0) + 1
                );
            }

            const maxDegree = Math.max(...nodeDegree.values(), 1);
            newGraph.forEachNode((id) => {
                const degree = nodeDegree.get(id) || 0;
                const size = 4 + (degree / maxDegree) * 16;
                newGraph.setNodeAttribute(id, 'size', size);
            });

            if (newGraph.order > 1) {
                await runLayout(newGraph, { reinitialize: true });
            }

            const communityMap = new Map();
            if (newGraph.order > 1) {
                const communitiesResult = louvain(newGraph, {
                    resolution: 1
                });
                const communityIdToIndex = new Map();
                let index = 0;

                newGraph.forEachNode((node) => {
                    const commId = communitiesResult[node] || 'default';
                    if (!communityIdToIndex.has(commId)) {
                        communityIdToIndex.set(commId, index++);
                    }
                    const colorIdx = communityIdToIndex.get(commId);
                    newGraph.setNodeAttribute(node, 'community', commId);
                    newGraph.setNodeAttribute(
                        node,
                        'color',
                        COLORS_PALETTE[colorIdx % COLORS_PALETTE.length]
                    );

                    if (!communityMap.has(commId)) {
                        communityMap.set(commId, {
                            id: commId,
                            nodes: [],
                            color: COLORS_PALETTE[
                                colorIdx % COLORS_PALETTE.length
                            ]
                        });
                    }
                    communityMap.get(commId).nodes.push(node);
                });
            }

            const bridges =
                newGraph.order > 2 ? detectBridges(newGraph) : [];
            newGraph.forEachNode((id) => {
                if (bridges.includes(id)) {
                    newGraph.setNodeAttribute(id, 'isBridge', true);
                }
            });

            const isolates = [];
            newGraph.forEachNode((id) => {
                if (newGraph.degree(id) === 0) isolates.push(id);
            });

            graph.value = newGraph;
            graphNodeCount.value = newGraph.order;
            graphEdgeCount.value = newGraph.size;
            communities.value = communityMap;
            bridgeNodes.value = bridges;
            isolateNodes.value = isolates;
        } catch (err) {
            console.error('[useSocialGraph] Failed to build graph', err);
        } finally {
            isBuilding.value = false;
        }
    }

    function destroy() {
        if (layoutWorker) {
            layoutWorker.terminate();
            layoutWorker = null;
        }
        graph.value = null;
    }

    return {
        graph,
        isBuilding,
        graphNodeCount,
        graphEdgeCount,
        communities,
        bridgeNodes,
        isolateNodes,
        buildGraph,
        destroy,
        COLORS_PALETTE
    };
}
