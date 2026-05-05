export function buildAppShellMarkup(): string {
  return `
    <div class="app-shell">
      <header class="toolbar">
        <div class="toolbar-group">
          <button type="button" data-mode="add-state">Add state</button>
          <button type="button" data-mode="connect">Connect</button>
          <button type="button" data-mode="select">Select</button>
        </div>
        <div class="toolbar-group toolbar-group--actions">
          <button type="button" data-action="undo">Undo</button>
          <button type="button" data-action="redo">Redo</button>
          <button type="button" data-action="load">Load JSON</button>
          <button type="button" data-action="save">Save JSON</button>
          <button type="button" data-action="delete">Delete selected</button>
          <button type="button" data-action="export">Export SVG</button>
        </div>
      </header>
      <main class="workspace">
        <section class="canvas-panel">
          <div class="canvas-heading">
            <div>
              <h1>Pushdown Automaton Editor</h1>
            </div>
          </div>
          <div class="runner-panel">
            <label class="runner-field">
              <span>Word</span>
              <input type="text" data-runner-input placeholder="Leave empty for ε" />
            </label>
            <div class="runner-actions">
              <button type="button" data-action="run">Run full</button>
              <button type="button" data-action="step">Step</button>
              <button type="button" data-action="reset-run">Reset step</button>
            </div>
          </div>
          <div class="canvas-frame">
            <div class="canvas-host"></div>
          </div>
          <p class="status-line"></p>
        </section>
        <aside class="inspector-panel">
          <div class="inspector-host"></div>
          <div class="runner-result"></div>
        </aside>
      </main>
      <input class="file-input" type="file" accept="application/json,.json" />
    </div>`
}
