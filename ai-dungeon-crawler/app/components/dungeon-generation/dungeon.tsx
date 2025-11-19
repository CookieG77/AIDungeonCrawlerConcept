import styles from "./dungeon.module.css";
import { Point, Graph, createGraphFromPoints, graphToCanvasHTML, primMST } from "./delaunay";

/* Since rooms are reduced by 1 on each side for better visual afterward we add 2 to the minimum size */
export const MIN_ROOM_SIZE = { width: 3, height: 3 };
export const MAX_ROOM_SIZE = { width: 7, height: 7 };
export const DUNGEON_SIZE = { width: 30, height: 30 };
export const MAX_ROOMS = 7;
// Probability to re-add non-MST Delaunay edges to create loops
export const EXTRA_EDGE_CHANCE = 0.3;
// Required empty cells between rooms (room-to-room distance)
export const ROOM_SEPARATION = 5;
// Distance minimale entre un couloir et une salle (en cases, Chebyshev)
export const ROOM_CORRIDOR_GAP = 2;
// Distance minimale entre deux couloirs différents (en cases, Chebyshev)
export const CORRIDOR_CORRIDOR_GAP = 1;

export enum CellTypeEnum {
    room = "room",
    corridor = "corridor",
    empty = "empty",
}
export type CellType = CellTypeEnum.room | CellTypeEnum.corridor | CellTypeEnum.empty;

export type Cell = {
    x: number;
    y: number;
    type: CellType;
};

export type Room = {
    x: number;
    y: number;
    width: number;
    height: number;
    center: { x: number; y: number };
};
export type Dungeon = {
    cells: Cell[][];
    rooms: Room[];
    roomGraph: Graph;
};

export function createEmptyDungeon(width: number, height: number): Cell[][] {
    const cells: Cell[][] = [];
    for (let y = 0; y < height; y++) {
        const row: Cell[] = [];
        for (let x = 0; x < width; x++) {
            row.push({ x, y, type: CellTypeEnum.empty });
        }
        cells.push(row);
    }
    return cells;
}

export function isAreaEmpty(cells: Cell[][], x: number, y: number, width: number, height: number): boolean {
    const maxY = cells.length;
    const maxX = cells[0]?.length ?? 0;

    const startY = Math.max(0, y);
    const startX = Math.max(0, x);
    const endY = Math.min(maxY, y + height);
    const endX = Math.min(maxX, x + width);

    for (let j = startY; j < endY; j++) {
        for (let i = startX; i < endX; i++) {
            if (cells[j][i].type !== CellTypeEnum.empty) {
                return false;
            }
        }
    }
    return true;
}

export function placeRoom(cells: Cell[][], room: Room): void {
    for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
            cells[y][x].type = CellTypeEnum.room;
        }
    }
}

export function createDungeon(): Dungeon {
    const cells = createEmptyDungeon(DUNGEON_SIZE.width, DUNGEON_SIZE.height);
    const rooms: Room[] = [];
    let attempts = 0;
    const separation = ROOM_SEPARATION; // minimum empty cells between rooms

    while (rooms.length < MAX_ROOMS && attempts < MAX_ROOMS * 8) {
        const innerWidth =
            Math.floor(Math.random() * (MAX_ROOM_SIZE.width - MIN_ROOM_SIZE.width + 1)) + MIN_ROOM_SIZE.width;
        const innerHeight =
            Math.floor(Math.random() * (MAX_ROOM_SIZE.height - MIN_ROOM_SIZE.height + 1)) + MIN_ROOM_SIZE.height;

        const roomX = Math.floor(Math.random() * (DUNGEON_SIZE.width - innerWidth));
        const roomY = Math.floor(Math.random() * (DUNGEON_SIZE.height - innerHeight));

        const checkX = roomX - separation;
        const checkY = roomY - separation;
        const checkW = innerWidth + separation * 2;
        const checkH = innerHeight + separation * 2;

        if (isAreaEmpty(cells, checkX, checkY, checkW, checkH)) {
            const newRoom: Room = {
                x: roomX,
                y: roomY,
                width: innerWidth,
                height: innerHeight,
                center: {
                    x: Math.floor(roomX + innerWidth / 2),
                    y: Math.floor(roomY + innerHeight / 2),
                },
            };
            placeRoom(cells, newRoom);
            rooms.push(newRoom);
        }
        attempts++;
    }

    // build graph from room centers (Delaunay triangulation)
    const points: Point[] = rooms.map(r => ({ x: r.center.x, y: r.center.y }));
    const roomGraph = createGraphFromPoints(points);

    // Build MST using Prim, then optionally add extra Delaunay edges with some probability
    const mst = primMST(roomGraph);

    const keyEdge = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
    const mstSet = new Set(mst.edges.map(e => keyEdge(e.a, e.b)));

    // Add extra edges (controlled loops)
    // Build adjacency count from MST
    const adjacency = new Array(points.length).fill(0);
    for (const e of mst.edges) {
        adjacency[e.a]++;
        adjacency[e.b]++;
    }

    const finalEdges = [...mst.edges];

    for (const e of roomGraph.edges) {
        const k = keyEdge(e.a, e.b);

        // Already in MST → skip
        if (mstSet.has(k)) continue;

        // Condition 1: random chance
        if (Math.random() > EXTRA_EDGE_CHANCE) continue;

        // Condition 2: both rooms must have <= 2 corridors
        const degA = adjacency[e.a];
        const degB = adjacency[e.b];

        const MAX_ALLOWED_CONNECTIONS = 2;

        if (degA > MAX_ALLOWED_CONNECTIONS) continue;
        if (degB > MAX_ALLOWED_CONNECTIONS) continue;

        // Accept this loop edge
        finalEdges.push(e);

        // Update degree counts
        adjacency[e.a]++;
        adjacency[e.b]++;
    }


    const cols = cells[0]?.length ?? 0;
    const rows = cells.length;

    function roomIndexAt(x: number, y: number) {
        for (let i = 0; i < rooms.length; i++) {
            const r = rooms[i];
            if (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height) return i;
        }
        return -1;
    }

    // Chebyshev distance d>=1 signifie "touché" (orthogonal ou diagonal)
    function distToRoom(roomIdx: number, px: number, py: number) {
        const r = rooms[roomIdx];
        const rx1 = r.x;
        const ry1 = r.y;
        const rx2 = r.x + r.width - 1;
        const ry2 = r.y + r.height - 1;
        const dx = px < rx1 ? rx1 - px : px > rx2 ? px - rx2 : 0;
        const dy = py < ry1 ? ry1 - py : py > ry2 ? py - ry2 : 0;
        return Math.max(dx, dy);
    }

    // Premier pixel vide en sortant du centre de la salle vers la cible
    function exitCellFromCenter(roomIdx: number, target: Point): { x: number; y: number } {
        const r = rooms[roomIdx];
        const cx = Math.floor(r.center.x);
        const cy = Math.floor(r.center.y);
        const dx = target.x - cx;
        const dy = target.y - cy;
        const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

        const primary: "x" | "y" = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        let x = cx;
        let y = cy;
        while (x >= 0 && x < cols && y >= 0 && y < rows) {
            if (roomIndexAt(x, y) !== roomIdx) {
                return { x, y };
            }
            if (primary === "x") x += stepX;
            else y += stepY;
        }

        // fallback : premier pixel externe autour de la salle
        for (let oy = r.y - 1; oy <= r.y + r.height; oy++) {
            for (let ox = r.x - 1; ox <= r.x + r.width; ox++) {
                if (ox < 0 || oy < 0 || ox >= cols || oy >= rows) continue;
                if (roomIndexAt(ox, oy) === -1) return { x: ox, y: oy };
            }
        }

        return { x: cx, y: cy };
    }

    function clamp(v: number, min: number, max: number) {
        return v < min ? min : v > max ? max : v;
    }

    // Segment axis-aligné → liste de cases
    function lineCells(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
        const out: { x: number; y: number }[] = [];
        let x = x0;
        let y = y0;
        const dx = x1 === x0 ? 0 : x1 > x0 ? 1 : -1;
        const dy = y1 === y0 ? 0 : y1 > y0 ? 1 : -1;

        out.push({ x, y });
        while (x !== x1 || y !== y1) {
            if (x !== x1) x += dx;
            if (y !== y1) y += dy;
            out.push({ x, y });
        }
        return out;
    }

    function polylineToCells(pointsArr: { x: number; y: number }[]) {
        const out: { x: number; y: number }[] = [];
        for (let i = 0; i < pointsArr.length - 1; i++) {
            const a = pointsArr[i];
            const b = pointsArr[i + 1];
            if (a.x === b.x && a.y === b.y) continue;
            const segment = lineCells(a.x, a.y, b.x, b.y);
            for (const s of segment) out.push(s);
        }
        return out;
    }

    function cellTooCloseToRooms(
        p: { x: number; y: number },
        srcRoom: number,
        dstRoom: number,
        start: { x: number; y: number },
        end: { x: number; y: number },
    ): boolean {
        const isStart = p.x === start.x && p.y === start.y;
        const isEnd = p.x === end.x && p.y === end.y;

        for (let i = 0; i < rooms.length; i++) {
            const d = distToRoom(i, p.x, p.y);
            if (d < ROOM_CORRIDOR_GAP) {
                if ((i === srcRoom && isStart) || (i === dstRoom && isEnd)) {
                    continue; // on autorise le couloir à toucher la salle seulement au connecteur
                }
                return true;
            }
        }
        return false;
    }

    // couloir trop proche d'un autre couloir (sauf fusion sur la même case)
    function corridorTooCloseToOthers(p: { x: number; y: number }): boolean {
        if (p.y < 0 || p.y >= rows || p.x < 0 || p.x >= cols) return true;
        if (cells[p.y][p.x].type === CellTypeEnum.corridor) {
            // partage de case = fusion → OK
            return false;
        }

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = p.x + dx;
                const ny = p.y + dy;
                if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
                if (cells[ny][nx].type === CellTypeEnum.corridor) {
                    const cheb = Math.max(Math.abs(dx), Math.abs(dy));
                    if (cheb <= CORRIDOR_CORRIDOR_GAP) {
                        return true; // couloir collé à un autre
                    }
                }
            }
        }

        return false;
    }

    // évite les couloirs 2x2 "pleins" (garde des couloirs fins)
    function createsCorridorSquare(path: { x: number; y: number }[]): boolean {
        for (const c of path) {
            for (let oy = -1; oy <= 0; oy++) {
                for (let ox = -1; ox <= 0; ox++) {
                    const sx = c.x + ox;
                    const sy = c.y + oy;
                    if (sx < 0 || sy < 0 || sx + 1 >= cols || sy + 1 >= rows) continue;
                    let cnt = 0;
                    for (let yy = sy; yy <= sy + 1; yy++) {
                        for (let xx = sx; xx <= sx + 1; xx++) {
                            if (xx === c.x && yy === c.y) {
                                cnt++;
                                continue;
                            }
                            if (cells[yy][xx].type === CellTypeEnum.corridor) cnt++;
                        }
                    }
                    if (cnt >= 3) return true;
                }
            }
        }
        return false;
    }

    function carveCells(path: { x: number; y: number }[]) {
        for (const p of path) {
            if (p.y < 0 || p.y >= rows || p.x < 0 || p.x >= cols) continue;
            if (cells[p.y][p.x].type === CellTypeEnum.room) continue;
            cells[p.y][p.x].type = CellTypeEnum.corridor;
        }
    }

    function candidatePolylines(
        s: { x: number; y: number },
        e: { x: number; y: number },
    ): { x: number; y: number }[][] {
        const polys: { x: number; y: number }[][] = [];

        // 1 segment (droit)
        if (s.x === e.x || s.y === e.y) {
            polys.push([s, e]);
        }

        // 2 segments : L classiques
        polys.push([s, { x: e.x, y: s.y }, e]);
        polys.push([s, { x: s.x, y: e.y }, e]);

        // 3 segments via pivots (max 3 segments)
        const midX = Math.floor((s.x + e.x) / 2);
        const midY = Math.floor((s.y + e.y) / 2);

        for (let off = -2; off <= 2; off++) {
            const px = clamp(midX + off, 0, cols - 1);
            polys.push([s, { x: px, y: s.y }, { x: px, y: e.y }, e]);
        }

        for (let off = -2; off <= 2; off++) {
            const py = clamp(midY + off, 0, rows - 1);
            polys.push([s, { x: s.x, y: py }, { x: e.x, y: py }, e]);
        }

        // déduplication simple
        const seen = new Set<string>();
        const unique: { x: number; y: number }[][] = [];
        for (const poly of polys) {
            const key = poly.map(p => `${p.x},${p.y}`).join("|");
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(poly);
            }
        }

        // garder uniquement <= 4 points (3 segments max)
        return unique.filter(p => p.length <= 4);
    }

    // Tente de créer un couloir entre deux salles en <= 3 segments
    function carveCorridorBetween(aIdx: number, bIdx: number) {
        const aCenter = points[aIdx];
        const bCenter = points[bIdx];

        const start = exitCellFromCenter(aIdx, bCenter);
        const end = exitCellFromCenter(bIdx, aCenter);

        const polys = candidatePolylines(start, end);

        for (const poly of polys) {
            const cellsPath = polylineToCells(poly);

            let invalid = false;

            for (const p of cellsPath) {
                if (p.x < 0 || p.x >= cols || p.y < 0 || p.y >= rows) {
                    invalid = true;
                    break;
                }

                // ne pas traverser les salles
                if (roomIndexAt(p.x, p.y) !== -1) {
                    invalid = true;
                    break;
                }

                // distance minimale aux salles (sauf au connecteur)
                if (cellTooCloseToRooms(p, aIdx, bIdx, start, end)) {
                    invalid = true;
                    break;
                }

                // séparation / fusion entre couloirs
                if (corridorTooCloseToOthers(p)) {
                    invalid = true;
                    break;
                }
            }

            if (invalid) continue;

            if (createsCorridorSquare(cellsPath)) continue;

            carveCells(cellsPath);
            return true;
        }

        // pas trouvé de chemin valide, on abandonne cette arête
        return false;
    }

    // Carve corridors for each final edge
    for (const e of finalEdges) {
        carveCorridorBetween(e.a, e.b);
    }

    const corridorCount = cells.reduce(
        (acc, row) => acc + row.filter(c => c.type === CellTypeEnum.corridor).length,
        0,
    );
    // eslint-disable-next-line no-console
    console.log(
        `createDungeon: rooms=${rooms.length}, finalEdges=${finalEdges.length}, corridors=${corridorCount}`,
    );

    return { cells, rooms, roomGraph };
}

export function printDungeon(dungeon: Dungeon): void {
    for (let y = 0; y < dungeon.cells.length; y++) {
        let row = "";
        for (let x = 0; x < dungeon.cells[y].length; x++) {
            switch (dungeon.cells[y][x].type) {
                case CellTypeEnum.room:
                    row += ".";
                    break;
                case CellTypeEnum.corridor:
                    row += "#";
                    break;
                case CellTypeEnum.empty:
                    row += " ";
                    break;
            }
        }
        // eslint-disable-next-line no-console
        console.log(row);
    }
}

export function dungeonToString(dungeon: Dungeon): string {
    let dungeonString = "";
    for (let y = 0; y < dungeon.cells.length; y++) {
        for (let x = 0; x < dungeon.cells[y].length; x++) {
            switch (dungeon.cells[y][x].type) {
                case CellTypeEnum.room:
                    dungeonString += "▮";
                    break;
                case CellTypeEnum.corridor:
                    dungeonString += "◻";
                    break;
                case CellTypeEnum.empty:
                    dungeonString += " ";
                    break;
            }
        }
        dungeonString += "\n";
    }
    return dungeonString;
}

export function dungeonToHTML(dungeon: Dungeon): string {
    const rows = dungeon.cells.length;
    const cols = dungeon.cells[0]?.length ?? 0;

    let dungeonHTML = `<div class="${styles.dungeon_outer_wrapper} ${styles.dungeon_scrollable}">`;
    dungeonHTML += `<div class="${styles.dungeon_box}">`;
    dungeonHTML += `<div class="${styles.dungeon_board} ${styles["dungeon_board--lined"]}" style="--cols:${cols}; --rows:${rows};">`;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = dungeon.cells[y][x];
            const base = styles.dungeon_cell;
            let variant = "";
            switch (cell.type) {
                case CellTypeEnum.room:
                    variant = styles["dungeon_cell--floor"] ?? "";
                    if (!variant) variant = "force-floor";
                    break;
                case CellTypeEnum.corridor:
                    variant = styles["dungeon_cell--wall"] ?? "";
                    if (!variant) variant = "force-wall";
                    break;
                case CellTypeEnum.empty:
                default:
                    variant = "";
                    break;
            }

            const classAttr = variant ? `${base} ${variant}` : `${base}`;
            dungeonHTML += `<div class="${classAttr}"></div>`;
        }
    }

    dungeonHTML += `</div></div></div>`;
    return dungeonHTML;
}

// Helper: génère un donjon et renvoie une représentation texte + HTML pour le graphe
export function generateDungeonAndGraphHTML(
    width = 800,
    height = 600,
): { dungeonHTML: string; graphHTML: string } {
    const dungeon = createDungeon();
    const dungeonHTML = dungeonToHTML(dungeon);
    const graphHTML = graphToCanvasHTML(dungeon.roomGraph ?? { points: [], edges: [] }, width, height);
    return { dungeonHTML, graphHTML };
}

/**
 * Génère un HTML autonome qui affiche la grille du donjon et superpose
 * le graphe Delaunay aligné sur les centres des pièces.
 */
export function dungeonWithGraphHTML(
    dungeon: Dungeon,
    width = 800,
    height = 800,
    background: string = "transparent",
): string {
    const rows = dungeon.cells.length;
    const cols = dungeon.cells[0]?.length ?? 0;

    const graph = dungeon.roomGraph ?? createGraphFromPoints(dungeon.rooms.map(r => ({ x: r.center.x, y: r.center.y })));
    const graphJSON = JSON.stringify(graph);

    let cellsHTML = "";
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const c = dungeon.cells[y][x];
            const cls =
                c.type === CellTypeEnum.room
                    ? "cell-floor"
                    : c.type === CellTypeEnum.corridor
                        ? "cell-wall"
                        : "cell-empty";
            cellsHTML += `<div class="cell ${cls}"></div>`;
        }
    }

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
        :root{--board-size: min(90vw, 90vh)}
        html,body{height:100%;margin:0;background:${background}}
        .wrapper{display:flex;align-items:center;justify-content:center;padding:12px}
        .board{position:relative;width:var(--board-size);height:var(--board-size);display:grid;grid-template-columns:repeat(var(--cols, ${cols}),1fr);grid-template-rows:repeat(var(--rows, ${rows}),1fr);box-sizing:border-box;border-radius:8px;border:2px solid #444;overflow:hidden;background:#151515}
        .cell{box-sizing:border-box;border:1px solid rgba(255,255,255,0.03);width:100%;height:100%}
        .cell-floor{background:#1f2937}
        .cell-wall{background:#374151}
        .cell-empty{background:transparent}
        .overlayCanvas{position:absolute;left:0;top:0;pointer-events:none}
        @media (max-width:600px){:root{--board-size: min(95vw, 95vh)}}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="board" id="board" style="--cols:${cols}; --rows:${rows};">
            ${cellsHTML}
            <canvas id="graphCanvas" class="overlayCanvas"></canvas>
        </div>
    </div>

    <script>
        const graph = ${graphJSON};
        const cols = ${cols};
        const rows = ${rows};
        const canvas = document.getElementById('graphCanvas');
        const board = document.getElementById('board');

        function resizeAndDraw(){
            const rect = board.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            canvas.width = Math.max(1, Math.floor(rect.width * dpr));
            canvas.height = Math.max(1, Math.floor(rect.height * dpr));
            canvas.classList.add('overlayCanvas');

            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr,0,0,dpr,0,0);
            ctx.clearRect(0,0,rect.width,rect.height);

            const cellW = rect.width / cols;
            const cellH = rect.height / rows;

            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.06);
            for(const e of graph.edges){
                const a = graph.points[e.a];
                const b = graph.points[e.b];
                const ax = (a.x + 0.5) * cellW;
                const ay = (a.y + 0.5) * cellH;
                const bx = (b.x + 0.5) * cellW;
                const by = (b.y + 0.5) * cellH;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                ctx.stroke();
            }

            for(const p of graph.points){
                const px = (p.x + 0.5) * cellW;
                const py = (p.y + 0.5) * cellH;
                ctx.beginPath();
                ctx.fillStyle = '#ffcc00';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 1;
                ctx.arc(px, py, Math.max(3, Math.min(cellW, cellH) * 0.22), 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();
            }
        }

        window.addEventListener('load', resizeAndDraw);
        window.addEventListener('resize', resizeAndDraw);
        const ro = new ResizeObserver(resizeAndDraw);
        ro.observe(board);
    </script>
</body>
</html>`;
}
