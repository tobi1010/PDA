# pda

Local browser-based tool for creating PDAs and exporting them as SVG.
Only intended for convenience and studying
!!!!100% vibe coded!!!!
may not always work as intended

## Features

- Full run to check whether a word is accepted
- Step mode to walk an accepting run state by state
- Export to standalone SVG
- Save/load PDA files as JSON files

## Requirements

- Node.js 18+ recommended
- npm

## Install

Clone the repository and install dependencies:

```bash
git clone git@github.com:tobi1010/pda.git 
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
