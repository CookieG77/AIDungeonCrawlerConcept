"use client";
import React, { useEffect, useRef } from "react";
import type { Graph } from "./delaunay";

type Props = {
    graph: Graph | undefined;
    cols: number;
    rows: number;
    className?: string;
    style?: React.CSSProperties;
};

export default function GraphOverlay({ graph, cols, rows, className, style }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;
        const container = containerRef.current;
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;

        function draw() {
            const rect = container.getBoundingClientRect();
            const cssW = Math.max(1, rect.width);
            const cssH = Math.max(1, rect.height);

            canvas.style.width = cssW + "px";
            canvas.style.height = cssH + "px";
            canvas.width = Math.max(1, Math.floor(cssW * dpr));
            canvas.height = Math.max(1, Math.floor(cssH * dpr));

            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssW, cssH);

            if (!graph || !graph.points || !graph.edges) return;

            const cellW = cssW / Math.max(1, cols);
            const cellH = cssH / Math.max(1, rows);

            // draw edges
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.06);
            for (const e of graph.edges) {
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

            // draw points
            for (const p of graph.points) {
                const px = (p.x + 0.5) * cellW;
                const py = (p.y + 0.5) * cellH;
                ctx.beginPath();
                ctx.fillStyle = "#ffcc00";
                ctx.strokeStyle = "rgba(0,0,0,0.7)";
                ctx.lineWidth = 1;
                ctx.arc(px, py, Math.max(3, Math.min(cellW, cellH) * 0.22), 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        draw();

        const ro = new ResizeObserver(draw);
        ro.observe(container);
        window.addEventListener("resize", draw);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", draw);
        };
    }, [graph, cols, rows]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, ...style }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    background: "transparent",
                    pointerEvents: "none",
                }}
            />

        </div>
    );
}
