"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Pencil, Eraser, Trash2, Download } from "lucide-react";

type Tool = "pen" | "eraser";

const COLORS = ["#f0ede8", "#60a5fa", "#4ade80", "#f87171", "#fbbf24", "#c084fc", "#fb923c"];
const SIZES  = [2, 4, 8, 16];

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPt    = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool]     = useState<Tool>("pen");
  const [color, setColor]   = useState(COLORS[0]);
  const [size, setSize]     = useState(4);

  /* ── Canvas resize ──────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    const saved = canvas.toDataURL();

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const img = new Image();
      img.src = saved;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#1a1916";
      ctx.fillRect(0, 0, w, h);
      img.onload = () => ctx.drawImage(img, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => ro.disconnect();
  }, []);

  /* ── Pointer helpers ────────────────────────────────────── */
  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function draw(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = tool === "eraser" ? "#1a1916" : color;
    ctx.lineWidth   = tool === "eraser" ? size * 4 : size;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    isDrawing.current = true;
    lastPt.current    = getPoint(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
    draw(lastPt.current, lastPt.current);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || !lastPt.current) return;
    const pt = getPoint(e);
    draw(lastPt.current, pt);
    lastPt.current = pt;
  }

  function onPointerUp() { isDrawing.current = false; lastPt.current = null; }

  /* ── Actions ────────────────────────────────────────────── */
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a1916";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function downloadCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 10rem)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 px-1 flex-wrap">
        {/* Tool buttons */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          {(["pen", "eraser"] as Tool[]).map((t) => (
            <button key={t} onClick={() => setTool(t)} title={t === "pen" ? "Pen" : "Eraser"}
              className="p-1.5 rounded transition-colors"
              style={{ backgroundColor: tool === t ? "#3a3a35" : "transparent", color: tool === t ? "#f0ede8" : "var(--muted)" }}>
              {t === "pen" ? <Pencil size={15} /> : <Eraser size={15} />}
            </button>
          ))}
        </div>

        {/* Colors — only for pen */}
        {tool === "pen" && (
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
        )}

        {/* Brush size */}
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className="flex items-center justify-center w-7 h-7 rounded transition-colors"
              style={{ backgroundColor: size === s ? "#3a3a35" : "transparent" }}>
              <div className="rounded-full" style={{
                width: Math.max(4, s * (tool === "eraser" ? 2 : 1)),
                height: Math.max(4, s * (tool === "eraser" ? 2 : 1)),
                backgroundColor: tool === "eraser" ? "#7a7870" : color,
              }} />
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={downloadCanvas} title="Download"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}>
            <Download size={13} /> Save
          </button>
          <button onClick={clearCanvas} title="Clear all"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#f87171", border: "1px solid var(--border)" }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="flex-1 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor: tool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
