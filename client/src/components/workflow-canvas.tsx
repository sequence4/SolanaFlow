"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Plus, Minus, Folder, Link, Eye, RotateCcw, Trash2, Layers } from "lucide-react"

interface Node {
  id: string
  type: string
  position: { x: number; y: number }
  data: { label: string }
}

interface Connection {
  id: string
  source: string
  target: string
}

export function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showAccountsBox, setShowAccountsBox] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    },
    [pan],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.1))
  const handleZoomReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleClearCanvas = () => {
    setNodes([])
    setConnections([])
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const instructionData = e.dataTransfer.getData("application/json")
      if (instructionData) {
        const instruction = JSON.parse(instructionData)
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const newNode: Node = {
            id: `node-${Date.now()}`,
            type: "instruction",
            position: {
              x: (e.clientX - rect.left - pan.x) / zoom,
              y: (e.clientY - rect.top - pan.y) / zoom,
            },
            data: { label: instruction.name },
          }
          setNodes((prev) => [...prev, newNode])
        }
      }
    },
    [pan, zoom],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div className="flex-1 bg-background relative overflow-hidden">
      {/* Canvas Controls */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
        <div className="flex items-center gap-1 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Zoom In"
          >
            <Plus className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={handleClearCanvas}
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <button
            onClick={() => setShowAccountsBox(!showAccountsBox)}
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Toggle Accounts"
          >
            <Layers className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <div className="w-px h-6 bg-border" />
          <button
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Save"
          >
            <Folder className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <button
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Connect"
          >
            <Link className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
          <button
            className="p-2 hover:bg-accent rounded-md transition-all duration-200 hover:scale-105 group"
            title="Preview"
          >
            <Eye className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
        </div>

        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
          <span className="text-sm text-muted-foreground font-mono">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="h-full cursor-grab active:cursor-grabbing transition-all duration-200"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          background: '#0a0a0b',
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(77, 124, 254, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, rgba(34, 197, 94, 0.02) 0%, transparent 50%)
          `,
        }}
      >
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(107 114 128) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(107 114 128) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(107 114 128) 2px, transparent 2px),
              linear-gradient(to bottom, rgb(107 114 128) 2px, transparent 2px)
            `,
            backgroundSize: "120px 120px",
          }}
        />

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute bg-card border border-border rounded-xl p-4 shadow-lg hover:shadow-xl cursor-move transition-all duration-200 hover:scale-105 group"
            style={{
              left: node.position.x,
              top: node.position.y,
              minWidth: "140px",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-sm" />
              <span className="text-sm font-mono font-medium">{node.data.label}</span>
            </div>
            <div className="absolute -left-3 top-1/2 w-6 h-6 bg-primary rounded-full border-3 border-background transform -translate-y-1/2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="absolute -right-3 top-1/2 w-6 h-6 bg-primary rounded-full border-3 border-background transform -translate-y-1/2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        ))}

        {/* Empty State */}
        {nodes.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full flex items-center justify-center mb-8 mx-auto shadow-lg">
                <Plus className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-3">Drag and drop nodes to create your dApp</h2>
              <p className="text-muted-foreground leading-relaxed">
                Drag instructions from the sidebar to create your Solana workflow. Connect components to define your
                program logic and build powerful decentralized applications.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}