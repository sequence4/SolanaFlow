import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useColorModeValue } from '@/components/ui/color-mode';
import "@/styles/nodes/basicNodeStyle.css";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { FiTerminal, FiSettings } from 'react-icons/fi';
import { FaCircle } from 'react-icons/fa';

interface Field {
  label: string;
  value: string;
  type: string;
  description?: string;
}

interface InputNodeData {
  label: string;
  fields?: Field[];
  onChange?: (label: string, value: string) => void;
}

export function InputNode({ data }: { data: InputNodeData }) {
  const { label, fields } = data;
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    fields?.reduce((acc, field) => ({ ...acc, [field.label]: field.value }), {}) || {}
  );

  const handleInputChange = (label: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [label]: value }));
    if (data.onChange) {
      data.onChange(label, value);
    }
  };

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[320px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-border transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      style={{
        background: "hsl(var(--card))",
      }}
    >
      {/* Header */}
      <div className="flex flex-row justify-start items-center gap-2 p-3 text-sm font-semibold rounded-t-lg" 
           style={{ background: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="bg-primary w-1.5 h-6 rounded-sm mr-3"></div>
        <FiSettings className="h-4 w-4 text-primary mr-2" />
        <span className="font-medium tracking-wide">Inputs</span>
        <div className="flex-grow"></div>
        <Badge 
          variant="outline" 
          className="bg-muted text-primary border-primary/30 text-xs px-2"
        >
          Parameters
        </Badge>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {fields && fields.map((field, idx) => (
          <div 
            key={idx} 
            className="bg-muted rounded-md p-3 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-primary mr-2"></div>
                <span className="font-medium">{field.label}</span> 
              </div>
              <Badge
                className="bg-primary/10 text-primary border-primary/20 text-xs px-2"
              >
                {field.type}
              </Badge>
            </div>
            {field.description && (
              <div className="text-xs ml-4 text-muted-foreground">{field.description}</div>
            )}
            <div className="relative">
              <div 
                className="absolute left-2 top-1/2 -translate-y-1/2 text-primary opacity-50"
              >
                <FiTerminal size={14} />
              </div>
              <Input
                className="h-8 bg-background border-border text-sm font-mono pl-8"
                type={field.type === 'number' ? 'number' : 'text'}
                value={fieldValues[field.label] || ''}
                onChange={(e) => handleInputChange(field.label, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Handle */}
      <Handle
        id="input-handle-right"
        type="source"
        position={Position.Right}
        style={{
          background: "hsl(var(--border))",
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          border: "2px solid hsl(var(--foreground)),"
        }}
      />
    </div>
  );
}
