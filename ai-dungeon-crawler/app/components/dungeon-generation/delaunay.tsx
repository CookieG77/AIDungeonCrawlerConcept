/* Delaunay triangulation helpers (Bowyer–Watson)
   Export types: Point, Edge, Triangle, Graph
   Export functions: createGraphFromPoints, graphToCanvasHTML, primMST
*/

export type Point = { x: number; y: number };
export type Edge = { a: number; b: number };
export type Triangle = { a: number; b: number; c: number };
export type Graph = { points: Point[]; edges: Edge[]; triangles?: Triangle[] };

function edgeKey(a: number, b: number) {
    return a < b ? `${a},${b}` : `${b},${a}`;
}

function circumcircleContains(pA: Point, pB: Point, pC: Point, p: Point): boolean {
    const d = 2 * (pA.x * (pB.y - pC.y) + pB.x * (pC.y - pA.y) + pC.x * (pA.y - pB.y));
    if (Math.abs(d) < 1e-12) return false; // colinear

    const ux =
        ((pA.x * pA.x + pA.y * pA.y) * (pB.y - pC.y) +
            (pB.x * pB.x + pB.y * pB.y) * (pC.y - pA.y) +
            (pC.x * pC.x + pC.y * pC.y) * (pA.y - pB.y)) /
        d;
    const uy =
        ((pA.x * pA.x + pA.y * pA.y) * (pC.x - pB.x) +
            (pB.x * pB.x + pB.y * pB.y) * (pA.x - pC.x) +
            (pC.x * pC.x + pC.y * pC.y) * (pB.x - pA.x)) /
        d;

    const dx = ux - p.x;
    const dy = uy - p.y;
    const r2 = (ux - pA.x) * (ux - pA.x) + (uy - pA.y) * (uy - pA.y);
    const dist2 = dx * dx + dy * dy;
    return dist2 <= r2 + 1e-8;
}

export function createGraphFromPoints(points: Point[]): Graph {
    if (points.length === 0) return { points: [], edges: [] };

    let minX = points[0].x,
        minY = points[0].y,
        maxX = points[0].x,
        maxY = points[0].y;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    const dx = maxX - minX;
    const dy = maxY - minY;
    const dmax = Math.max(dx, dy);
    const midx = (minX + maxX) / 2;
    const midy = (minY + maxY) / 2;

    const superA: Point = { x: midx - 20 * dmax, y: midy - dmax };
    const superB: Point = { x: midx, y: midy + 20 * dmax };
    const superC: Point = { x: midx + 20 * dmax, y: midy - dmax };

    const pts = points.concat([superA, superB, superC]);
    const superAIdx = pts.length - 3;
    const superBIdx = pts.length - 2;
    const superCIdx = pts.length - 1;

    let triangles: Triangle[] = [{ a: superAIdx, b: superBIdx, c: superCIdx }];

    for (let i = 0; i < points.length; i++) {
        const point = pts[i];
        const bad: Triangle[] = [];
        for (const t of triangles) {
            if (circumcircleContains(pts[t.a], pts[t.b], pts[t.c], point)) {
                bad.push(t);
            }
        }

        const edgeMap = new Map<string, Edge>();
        for (const t of bad) {
            const edges = [
                { a: t.a, b: t.b },
                { a: t.b, b: t.c },
                { a: t.c, b: t.a },
            ];
            for (const e of edges) {
                const key = edgeKey(e.a, e.b);
                if (edgeMap.has(key)) {
                    edgeMap.delete(key);
                } else {
                    edgeMap.set(key, e);
                }
            }
        }

        triangles = triangles.filter(t => !bad.includes(t));

        for (const e of edgeMap.values()) {
            triangles.push({ a: e.a, b: e.b, c: i });
        }
    }

    // remove triangles that share a vertex with the super triangle
    triangles = triangles.filter(
        t => t.a < points.length && t.b < points.length && t.c < points.length,
    );

    const edgeSet = new Map<string, Edge>();
    for (const t of triangles) {
        const cand = [
            { a: t.a, b: t.b },
            { a: t.b, b: t.c },
            { a: t.c, b: t.a },
        ];
        for (const e of cand) {
            const key = edgeKey(e.a, e.b);
            if (!edgeSet.has(key)) {
                edgeSet.set(key, e);
            }
        }
    }

    const edges = Array.from(edgeSet.values());
    return { points: points.slice(), edges, triangles };
}

/**
 * Render a graph into a standalone HTML with a canvas.
 */
export function graphToCanvasHTML(graph: Graph, width = 800, height = 600, background: string = "black"): string {
    const payload = JSON.stringify(graph);
    const canvasBg = background === "transparent" ? "transparent" : background;
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>html,body{margin:0;height:100%;background:transparent}canvas{display:block;background:${canvasBg}}</style>
</head>
<body>
    <canvas id="graphCanvas" width="${width}" height="${height}"></canvas>
    <script>
        const graph = ${payload};
        const canvas = document.getElementById('graphCanvas');
        const ctx = canvas.getContext('2d');
        const pts = graph.points || [];
        if(!pts || pts.length===0){ctx.fillStyle='#fff';ctx.fillText('No points',10,20)}

        let minX = pts[0]?.x ?? 0, minY = pts[0]?.y ?? 0, maxX = pts[0]?.x ?? 0, maxY = pts[0]?.y ?? 0;
        for(const p of pts){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y }
        const pad = 20;
        const sx = (canvas.width - pad*2) / Math.max(1, maxX - minX);
        const sy = (canvas.height - pad*2) / Math.max(1, maxY - minY);
        const s = Math.min(sx, sy);
        const ox = pad - minX * s + (canvas.width - (maxX - minX) * s - pad*2)/2;
        const oy = pad - minY * s + (canvas.height - (maxY - minY) * s - pad*2)/2;

        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2;
        for(const e of graph.edges || []){
            const a = pts[e.a];
            const b = pts[e.b];
            if(!a || !b) continue;
            ctx.beginPath();
            ctx.moveTo(a.x * s + ox, a.y * s + oy);
            ctx.lineTo(b.x * s + ox, b.y * s + oy);
            ctx.stroke();
        }

        for(const p of pts){
            ctx.beginPath();
            ctx.fillStyle = '#ffcc00';
            ctx.strokeStyle = '#000';
            const px = p.x * s + ox;
            const py = p.y * s + oy;
            ctx.arc(px, py, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        }
    </script>
</body>
</html>`;
}

/**
 * Build a Minimum Spanning Tree from the provided graph using Prim's algorithm.
 * The graph is expected to have points and candidate edges (e.g., from Delaunay).
 * Returns a new Graph containing the same points and only the MST edges.
 * This implementation is intentionally simple (O(V*E)) and suitable for small graphs.
 */
export function primMST(graph: Graph): Graph {
    const pts = graph.points;
    const edges = graph.edges || [];
    const n = pts.length;
    if (n === 0) return { points: [], edges: [] };
    if (n === 1) return { points: [pts[0]], edges: [] };

    const inMST = new Array<boolean>(n).fill(false);
    inMST[0] = true; // start from vertex 0
    const mstEdges: Edge[] = [];

    function dist(a: number, b: number) {
        const dx = pts[a].x - pts[b].x;
        const dy = pts[a].y - pts[b].y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    while (mstEdges.length < n - 1) {
        let bestEdge: Edge | null = null;
        let bestWeight = Infinity;

        for (const e of edges) {
            const aIn = inMST[e.a];
            const bIn = inMST[e.b];
            if ((aIn && !bIn) || (!aIn && bIn)) {
                const w = dist(e.a, e.b);
                if (w < bestWeight) {
                    bestWeight = w;
                    bestEdge = e;
                }
            }
        }

        if (!bestEdge) {
            // disconnected graph fallback
            let found = false;
            for (let i = 0; i < n && !found; i++) {
                if (!inMST[i]) continue;
                for (let j = 0; j < n && !found; j++) {
                    if (inMST[j]) continue;
                    const w = dist(i, j);
                    if (w < bestWeight) {
                        bestWeight = w;
                        bestEdge = { a: i, b: j };
                        found = true;
                    }
                }
            }
            if (!bestEdge) break;
        }

        mstEdges.push(bestEdge);
        inMST[bestEdge.a] = true;
        inMST[bestEdge.b] = true;
    }

    return { points: pts.slice(), edges: mstEdges };
}
