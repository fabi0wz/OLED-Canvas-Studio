import { useState } from 'react';
import { useStore, getAllScreensCommitted } from '../store';
import { generateU8g2Code, generateAnimSnippet } from '../codegen';

type Tab = 'sketch' | 'snippet';
type SnippetScope = 'all' | 'selected';

export default function CodePanel() {
  const { state, dispatch } = useStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('sketch');
  const [snippetScope, setSnippetScope] = useState<SnippetScope>('all');

  const screens = getAllScreensCommitted(state);

  const sketchCode = generateU8g2Code({
    display: state.display,
    screens,
    defaultScreenId: state.project.defaultScreenId,
    projectName: state.project.name,
  });

  // Collect animations for the snippet tab
  const activeScreenAnimations = state.animations; // current screen's animations
  const allScreenAnimations = screens.flatMap(s => s.animations);
  const selectedAnimation = state.editor.activeAnimationId
    ? activeScreenAnimations.find(a => a.id === state.editor.activeAnimationId) ?? null
    : null;

  const snippetAnimations =
    snippetScope === 'selected' && selectedAnimation
      ? [selectedAnimation]
      : allScreenAnimations;

  const snippetCode = generateAnimSnippet({
    display: state.display,
    animations: snippetAnimations,
  });

  const activeCode = activeTab === 'sketch' ? sketchCode : snippetCode;

  function handleCopy() {
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadIno() {
    const blob = new Blob([sketchCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.project.name || 'oled_layout').replace(/[^a-zA-Z0-9_-]+/g, '_')}.ino`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveProject() {
    const project = JSON.stringify({
      display: state.display,
      project: state.project,
      screens: getAllScreensCommitted(state),
    }, (_key, value) => {
      if (value instanceof Uint8Array) return Array.from(value);
      return value;
    }, 2);
    const blob = new Blob([project], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.project.name || 'oled_project').replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`;
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
          if (!data.display || (!data.layers && !data.elements && !data.screens)) {
            alert('Invalid project file.');
            return;
          }
          // Restore Uint8Array for bitmap elements anywhere they may appear.
          const restoreInContainers = (arr: { elements?: { type?: string; data?: unknown }[] }[] | undefined) => {
            for (const l of arr || []) {
              for (const el of l.elements || []) {
                if (el.type === 'bitmap' && Array.isArray(el.data)) {
                  (el as { data: Uint8Array }).data = new Uint8Array(el.data as number[]);
                }
              }
            }
          };
          // Multi-screen format
          if (Array.isArray(data.screens)) {
            for (const s of data.screens) {
              restoreInContainers(s.layers);
              for (const a of s.animations || []) restoreInContainers(a.frames);
            }
          } else {
            // Legacy single-screen format
            restoreInContainers(data.layers);
            for (const a of data.animations || []) restoreInContainers(a.frames);
          }
          dispatch({ type: 'LOAD_PROJECT', payload: data });
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
        <h3>Generated Code · U8g2 · {state.screens.length} screen{state.screens.length === 1 ? '' : 's'}</h3>
        <div className="btn-group">
          <input
            className="project-name-input"
            type="text"
            value={state.project.name}
            onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', payload: e.target.value })}
            placeholder="Project name"
            title="Project name (used as default filename)"
          />
          <button onClick={handleCopy}>{copied ? '✓ Copied' : 'Copy'}</button>
          {activeTab === 'sketch' && <button onClick={handleDownloadIno}>.ino</button>}
          <button onClick={handleSaveProject}>Save</button>
          <button onClick={handleLoadProject}>Load</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="code-tabs">
        <button
          className={`code-tab${activeTab === 'sketch' ? ' active' : ''}`}
          onClick={() => setActiveTab('sketch')}
        >
          Full Sketch
        </button>
        <button
          className={`code-tab${activeTab === 'snippet' ? ' active' : ''}`}
          onClick={() => setActiveTab('snippet')}
          title="Export animation(s) as a drop-in snippet for use in existing sketches"
        >
          Anim Snippet
        </button>

        {/* Snippet scope selector — only shown on snippet tab */}
        {activeTab === 'snippet' && (
          <span className="snippet-scope">
            <label>
              <input
                type="radio"
                name="snippetScope"
                value="all"
                checked={snippetScope === 'all'}
                onChange={() => setSnippetScope('all')}
              />
              {' All animations'}
            </label>
            <label style={{ marginLeft: 8 }}>
              <input
                type="radio"
                name="snippetScope"
                value="selected"
                checked={snippetScope === 'selected'}
                onChange={() => setSnippetScope('selected')}
                disabled={!selectedAnimation}
              />
              {' Selected'}
              {selectedAnimation ? ` (${selectedAnimation.name})` : ' (none)'}
            </label>
          </span>
        )}
      </div>

      <pre className="code-output"><code>{activeCode}</code></pre>
    </div>
  );
}
