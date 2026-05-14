'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle'

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#ff6600', '#ffff00', '#00cc00',
  '#0000ff', '#9900cc', '#ff69b4', '#00ccff', '#8B4513', '#808080',
  '#ff4444', '#44ff44', '#4444ff', '#ffaa00', '#00ffaa', '#aa00ff'
]

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'pencil', label: 'Lápiz', icon: '✏️' },
  { id: 'eraser', label: 'Borrador', icon: '🧹' },
  { id: 'fill', label: 'Relleno', icon: '🪣' },
  { id: 'line', label: 'Línea', icon: '╱' },
  { id: 'rect', label: 'Rectángulo', icon: '▭' },
  { id: 'circle', label: 'Círculo', icon: '○' }
]

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function colorsMatch(a: Uint8ClampedArray, offset: number, r: number, g: number, b: number, tolerance = 10): boolean {
  return Math.abs(a[offset] - r) <= tolerance &&
    Math.abs(a[offset + 1] - g) <= tolerance &&
    Math.abs(a[offset + 2] - b) <= tolerance
}

function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string) {
  const canvas = ctx.canvas
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data
  const [fr, fg, fb] = hexToRgb(fillColor)
  const startOffset = (startY * canvas.width + startX) * 4
  const sr = data[startOffset]
  const sg = data[startOffset + 1]
  const sb = data[startOffset + 2]

  if (sr === fr && sg === fg && sb === fb) return

  const stack: [number, number][] = [[startX, startY]]
  const visited = new Uint8Array(canvas.width * canvas.height)

  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue
    const idx = y * canvas.width + x
    if (visited[idx]) continue
    const offset = idx * 4
    if (!colorsMatch(data, offset, sr, sg, sb)) continue
    visited[idx] = 1
    data[offset] = fr
    data[offset + 1] = fg
    data[offset + 2] = fb
    data[offset + 3] = 255
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  ctx.putImageData(imgData, 0, 0)
}

export default function PaintPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(4)
  const [isDrawing, setIsDrawing] = useState(false)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const snapshotRef = useRef<ImageData | null>(null)

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, [])
  const getPreviewCtx = useCallback(() => previewRef.current?.getContext('2d') ?? null, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const preview = previewRef.current
    const container = containerRef.current
    if (!canvas || !preview || !container) return

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      const ctx = canvas.getContext('2d')!
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = w
      canvas.height = h
      preview.width = w
      preview.height = h
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.putImageData(imgData, 0, 0)
    }

    resize()
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e)
    setIsDrawing(true)
    startPos.current = pos
    lastPos.current = pos

    if (tool === 'fill') {
      const ctx = getCtx()
      if (!ctx) return
      floodFill(ctx, Math.floor(pos.x), Math.floor(pos.y), color)
      setIsDrawing(false)
      return
    }

    if (tool === 'pencil' || tool === 'eraser') {
      const ctx = getCtx()
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      const ctx = getCtx()
      if (!ctx) return
      snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const pos = getPos(e)
    const ctx = getCtx()
    const previewCtx = getPreviewCtx()
    if (!ctx) return

    if (tool === 'pencil') {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = brushSize * 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
    } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      if (!snapshotRef.current || !startPos.current) return
      ctx.putImageData(snapshotRef.current, 0, 0)

      if (previewCtx) {
        previewCtx.clearRect(0, 0, previewRef.current!.width, previewRef.current!.height)
      }

      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'

      const sx = startPos.current.x
      const sy = startPos.current.y
      const ex = pos.x
      const ey = pos.y

      if (tool === 'line') {
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      } else if (tool === 'rect') {
        ctx.beginPath()
        ctx.strokeRect(sx, sy, ex - sx, ey - sy)
      } else if (tool === 'circle') {
        const rx = Math.abs(ex - sx) / 2
        const ry = Math.abs(ey - sy) / 2
        const cx = sx + (ex - sx) / 2
        const cy = sy + (ey - sy) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const ctx = getCtx()
    if (ctx && (tool === 'pencil' || tool === 'eraser')) {
      ctx.closePath()
    }
    startPos.current = null
    lastPos.current = null
    snapshotRef.current = null
  }

  const clearCanvas = () => {
    const ctx = getCtx()
    if (!ctx || !canvasRef.current) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'pizarra.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const getCursor = () => {
    if (tool === 'eraser') return 'cell'
    if (tool === 'fill') return 'crosshair'
    return 'crosshair'
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700 flex-wrap">
        {/* Tools */}
        <div className="flex gap-1 border-r border-gray-600 pr-3 mr-1">
          {TOOLS.map(t => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => setTool(t.id)}
              className={`w-9 h-9 rounded text-lg flex items-center justify-center transition-all ${
                tool === t.id
                  ? 'bg-blue-500 shadow-md shadow-blue-500/50 scale-110'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2 border-r border-gray-600 pr-3 mr-1">
          <span className="text-xs text-gray-400 whitespace-nowrap">Tamaño:</span>
          <input
            type="range"
            min={1}
            max={40}
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="w-24 accent-blue-500"
          />
          <div
            className="rounded-full bg-current flex-shrink-0"
            style={{ width: Math.min(brushSize, 30), height: Math.min(brushSize, 30), backgroundColor: color }}
          />
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-2 border-r border-gray-600 pr-3 mr-1">
          <span className="text-xs text-gray-400">Color:</span>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 bg-transparent"
          />
          <div className="flex flex-wrap gap-0.5" style={{ maxWidth: 120 }}>
            {COLORS.map(c => (
              <button
                key={c}
                title={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-sm border transition-transform ${
                  color === c ? 'border-white scale-125 z-10' : 'border-gray-600 hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={clearCanvas}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors flex items-center gap-1"
          >
            🗑️ Limpiar
          </button>
          <button
            onClick={downloadCanvas}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors flex items-center gap-1"
          >
            💾 Guardar PNG
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-700">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ cursor: getCursor(), touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={e => { e.preventDefault(); startDrawing(e) }}
          onTouchMove={e => { e.preventDefault(); draw(e) }}
          onTouchEnd={stopDrawing}
        />
        <canvas
          ref={previewRef}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.7 }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <span>Herramienta: <span className="text-blue-400 font-semibold">{TOOLS.find(t => t.id === tool)?.label}</span></span>
        <span>Color: <span className="font-mono" style={{ color }}>{color.toUpperCase()}</span></span>
        <span>Pincel: <span className="text-blue-400">{brushSize}px</span></span>
      </div>
    </div>
  )
}
