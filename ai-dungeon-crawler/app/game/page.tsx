import { createDungeon, dungeonToHTML } from "../components/dungeon-generation/dungeon";
import GraphOverlay from "../components/dungeon-generation/GraphOverlay";
import { primMST, graphToCanvasHTML } from "../components/dungeon-generation/delaunay";
import { Space_Mono } from "next/font/google";

const spaceMono = Space_Mono({
    subsets: ["latin"],
    weight: "400"
});

export default function Game() {
    const dungeon = createDungeon();
    const dungeonHTML = dungeonToHTML(dungeon);
    const minimumSpanningTree = primMST(dungeon.roomGraph);
    const minimumSpanningTreeHTML = graphToCanvasHTML(minimumSpanningTree);
    console.log("Minimum Spanning Tree:", minimumSpanningTree);

    return (
        <div style={{ background: '#0a0a0a', color: '#ededed', minHeight: '100vh', padding: 24 }}>
            <h1>AI Dungeon Crawler - Game Page</h1>
            <p>Your adventure begins here...</p>
            <h2>Dungeon Layout</h2>
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <div dangerouslySetInnerHTML={{ __html: dungeonHTML }} />
                <GraphOverlay graph={dungeon.roomGraph} cols={dungeon.cells[0]?.length ?? 0} rows={dungeon.cells.length ?? 0} />
            </div>
            <h2>Minimum Spanning Tree of Room Connections</h2>
            <div dangerouslySetInnerHTML={{ __html: minimumSpanningTreeHTML }} />
        </div>
    );
}
