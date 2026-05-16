import { useStore, type ActiveTool } from '../store';
import { useRef } from 'react';

const tools: { id: ActiveTool; label: string; icon: string; shortcut?: string }[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'V',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`,
  },
  {
    id: 'add-text',
    label: 'Text',
    shortcut: 'T',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M8 20h8"/></svg>`,
  },
  {
    id: 'add-rect',
    label: 'Rectangle',
    shortcut: 'R',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  },
  {
    id: 'add-circle',
    label: 'Circle',
    shortcut: 'C',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
  },
  {
    id: 'add-line',
    label: 'Line',
    shortcut: 'L',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>`,
  },
  {
    id: 'freedraw',
    label: 'Free Draw',
    shortcut: 'D',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
  },
  {
    id: 'eraser',
    label: 'Eraser',
    shortcut: 'E',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L12 20"/><path d="M6 11l7 7"/></svg>`,
  },
];

export default function TopToolbar() {
  const { state, dispatch } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const { width: dw, height: dh } = state.display;
        // Scale image to fit display while preserving aspect ratio
        const scale = Math.min(1, dw / img.width, dh / img.height);
        const tw = Math.round(img.width * scale);
        const th = Math.round(img.height * scale);
        // Draw to offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, tw, th);
        const imageData = ctx.getImageData(0, 0, tw, th);
        // Convert to 1-bit using threshold (Floyd-Steinberg dithering)
        const gray = new Float32Array(tw * th);
        for (let i = 0; i < tw * th; i++) {
          const r = imageData.data[i * 4];
          const g = imageData.data[i * 4 + 1];
          const b = imageData.data[i * 4 + 2];
          const a = imageData.data[i * 4 + 3];
          gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) * (a / 255);
        }
        // Floyd-Steinberg dithering
        const out = new Uint8Array(tw * th);
        for (let y = 0; y < th; y++) {
          for (let x = 0; x < tw; x++) {
            const idx = y * tw + x;
            const old = gray[idx];
            const val = old > 127 ? 1 : 0;
            out[idx] = val;
            const err = old - (val ? 255 : 0);
            if (x + 1 < tw) gray[idx + 1] += err * 7 / 16;
            if (y + 1 < th) {
              if (x > 0) gray[idx + tw - 1] += err * 3 / 16;
              gray[idx + tw] += err * 5 / 16;
              if (x + 1 < tw) gray[idx + tw + 1] += err * 1 / 16;
            }
          }
        }
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            id: `bitmap_${Date.now()}`,
            type: 'bitmap' as const,
            x: 0, y: 0,
            visible: true,
            strokeWidth: 1,
            bmpWidth: tw,
            bmpHeight: th,
            data: out,
          },
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be imported again
    e.target.value = '';
  }

  return (
    <div className="top-toolbar">
      <div className="top-toolbar-brand">
        <span className="brand-led" />
        <span className="brand-name">OLED·CANVAS</span>
        <span className="brand-tag">STUDIO</span>
      </div>

      <div className="top-toolbar-tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${state.activeTool === tool.id ? 'tool-active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TOOL', payload: tool.id })}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          >
            <span className="tool-icon" dangerouslySetInnerHTML={{ __html: tool.icon }} />
            {tool.shortcut && <span className="tool-key">{tool.shortcut}</span>}
          </button>
        ))}

        <span className="tool-divider" />
        <button
          className="tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Import Image (I)"
        >
          <span className="tool-icon" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>` }} />
          <span className="tool-key">I</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageImport}
        />
      </div>

      <div className="top-toolbar-info">
        <span className="coord-label">XY</span>
        <span className="canvas-coords" id="canvas-coords">—,—</span>
      </div>
    </div>
  );
}
