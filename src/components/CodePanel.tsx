import { useState } from 'react';
import { useStore } from '../store';
import { generateU8g2Code } from '../codegen';

export default function CodePanel() {
  const { state, dispatch } = useStore();
  const [copied, setCopied] = useState(false);

  const code = generateU8g2Code({
    display: state.display,
    layers: state.layers,
    erasedPixels: state.erasedPixels,
    animations: state.animations,
    widgets: state.widgets,
  });

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadIno() {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oled_layout.ino';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveProject() {
    const project = JSON.stringify({
      display: state.display,
      layers: state.layers,
      erasedPixels: state.erasedPixels,
      animations: state.animations,
      widgets: state.widgets,
    }, (_key, value) => {
      // Serialize Uint8Array as regular arrays for JSON compatibility
      if (value instanceof Uint8Array) return Array.from(value);
      return value;
    }, 2);
    const blob = new Blob([project], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oled_project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          // Accept both new (layers) and legacy (elements) format
          if (data.display && (data.layers || data.elements)) {
            // Restore Uint8Array for bitmap elements (including those inside animation frames)
            const restoreInLayers = (arr: { elements?: { type?: string; data?: unknown }[] }[]) => {
              for (const l of arr || []) {
                for (const el of l.elements || []) {
                  if (el.type === 'bitmap' && Array.isArray(el.data)) {
                    (el as { data: Uint8Array }).data = new Uint8Array(el.data as number[]);
                  }
                }
              }
            };
            restoreInLayers(data.layers || []);
            for (const a of data.animations || []) restoreInLayers(a.frames || []);
            dispatch({ type: 'LOAD_PROJECT', payload: data });
          } else {
            alert('Invalid project file.');
          }
        } catch {
          alert('Invalid project file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <div className="panel code-panel">
      <div className="code-header">
        <h3>Generated Code · U8g2</h3>
        <div className="btn-group">
          <button onClick={handleCopy}>{copied ? '✓ Copied' : 'Copy'}</button>
          <button onClick={handleDownloadIno}>.ino</button>
          <button onClick={handleSaveProject}>Save</button>
          <button onClick={handleLoadProject}>Load</button>
        </div>
      </div>
      <pre className="code-output"><code>{code}</code></pre>
    </div>
  );
}
