import { useState, useRef, useCallback } from 'react';
import { StoreProvider, useStore } from './store';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import TopToolbar from './components/TopToolbar';
import ScreenManager from './components/ScreenManager';
import LayerPanel from './components/LayerPanel';
import FramePanel from './components/FramePanel';
import WidgetPanel from './components/WidgetPanel';
import PropertiesPanel from './components/PropertiesPanel';
import CodePanel from './components/CodePanel';
import './App.css';

/** Picks the left-panel content based on the current scene mode. */
function ScenePanel() {
  const { state } = useStore();
  if (state.editor.mode === 'animation') return <FramePanel />;
  if (state.editor.mode === 'widgets') return <WidgetPanel />;
  return <LayerPanel />;
}

function ResizeHandle({ side, onResize }: { side: 'left' | 'right' | 'bottom'; onResize: (delta: number) => void }) {
  const startRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = side === 'bottom' ? e.clientY : e.clientX;

    function onMove(ev: MouseEvent) {
      const current = side === 'bottom' ? ev.clientY : ev.clientX;
      const delta = current - startRef.current;
      startRef.current = current;
      onResize(delta);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [side, onResize]);

  return <div className={`resize-handle resize-${side}`} onMouseDown={handleMouseDown} />;
}

export default function App() {
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(260);
  const [bottomHeight, setBottomHeight] = useState(280);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  return (
    <StoreProvider>
      <div className="app-layout">
        <TopToolbar />
        <ScreenManager />
        <div className="app-body">
          {!leftCollapsed && (
            <>
              <aside className="left-panel" style={{ width: leftWidth }}>
                <Toolbar />
                <ScenePanel />
              </aside>
              <ResizeHandle side="left" onResize={(d) => setLeftWidth((w) => Math.max(180, Math.min(420, w + d)))} />
            </>
          )}
          <main className="center-area">
            <div className="canvas-wrapper">
              <Canvas />
            </div>
            {!bottomCollapsed && (
              <>
                <ResizeHandle side="bottom" onResize={(d) => setBottomHeight((h) => Math.max(100, Math.min(600, h - d)))} />
                <div style={{ height: bottomHeight, minHeight: bottomHeight }}>
                  <CodePanel />
                </div>
              </>
            )}
          </main>
          {!rightCollapsed && (
            <>
              <ResizeHandle side="right" onResize={(d) => setRightWidth((w) => Math.max(200, Math.min(420, w - d)))} />
              <aside className="right-panel" style={{ width: rightWidth }}>
                <PropertiesPanel />
              </aside>
            </>
          )}
        </div>
        <div className="panel-toggles">
          <button
            className={leftCollapsed ? '' : 'btn-active'}
            onClick={() => setLeftCollapsed((c) => !c)}
          >☰ Left</button>
          <button
            className={bottomCollapsed ? '' : 'btn-active'}
            onClick={() => setBottomCollapsed((c) => !c)}
          >☰ Code</button>
          <button
            className={rightCollapsed ? '' : 'btn-active'}
            onClick={() => setRightCollapsed((c) => !c)}
          >☰ Right</button>
        </div>
      </div>
    </StoreProvider>
  );
}
