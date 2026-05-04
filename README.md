# pda

Local browser-based tool for creating pushdown automatons and exporting them as SVG.

## Features

- Grid-based canvas with snap-to-grid state placement
- Draggable circular states
- Start state arrow
- Accept-state double circle
- Transitions between states and self-loops
- Transition labels rendered as `input | stackTop -> stackResult`
- `\\e` displayed as `ε`
- `$` supported as the stack end symbol
- Export to standalone SVG
- Save/load PDA files as JSON files

## Requirements

- Node.js 18+ recommended
- npm

## Install

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd pda
npm install
```

## Run Locally

Start the local development server:

```bash
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

Open that URL in your browser.

## Usage

1. Click `Add state`, then click the canvas to place a state.
2. Drag states to move them. They snap to the grid.
3. Click `Connect`, then click a source state and a target state to create a transition.
4. Select a state to edit its label or toggle start/accept status.
5. Select a transition to edit `input`, `stackTop`, and `stackResult`.
6. Click `Save JSON` to save the automaton to disk.
7. Click `Load JSON` to reopen a saved automaton.
8. Click `Export SVG` to export only the automaton drawing.

use \e for ε

## JSON Format

Saved files use this structure:

```json
{
  "version": 1,
  "states": [
    {
      "id": "q0",
      "label": "q0",
      "x": 160,
      "y": 160,
      "isStart": true,
      "isAccept": false
    }
  ],
  "transitions": [
    {
      "id": "t0",
      "fromId": "q0",
      "toId": "q0",
      "input": "\\e",
      "stackTop": "$",
      "stackResult": "\\e"
    }
  ]
}
```
