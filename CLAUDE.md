# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Fantasy Golf 2026 is a web application for tracking best golf scores at Moraga Country Club. It uses vanilla HTML/CSS/JavaScript with Firebase Realtime Database for cloud sync and Tesseract.js for OCR scorecard processing.

## Development

**No build process** - Open `index.html` directly in a browser. All libraries are loaded from CDN.

**Testing** - Manual browser testing only. No test framework is configured.

**Static preview** - `DEMO.html` provides a static demo without Firebase connectivity.

## Architecture

### Core Class: `FantasyGolf` (app.js)

Single class managing the entire application with these key responsibilities:

1. **Data Model**: Players array with `{name: string, scores: number[]}` where -1 represents no score
2. **Dual Storage**: localStorage for offline capability + Firebase Realtime Database for cloud sync
3. **Rendering**: Dynamic HTML table with inline editing, keyboard navigation, and running totals

### Data Flow
```
User Input → Event Listener → saveInlineScore() → saveData() →
  localStorage + Firebase → render() → DOM Update
```

### Key Implementation Details

**Keyboard Navigation**: Arrow keys move between cells, single-digit scores (1-9) auto-advance to next hole, Backspace clears previous cell and moves cursor back.

**Firebase Sync**: Bidirectional real-time sync with online/offline status indicator. Firebase uses null for empty values; app uses -1 internally.

**OCR Processing**: Three-strategy approach in `extractScoresFromText()`:
- Anchor Pattern: Finds hole number sequences (1-9, 10-18)
- Line Analysis: Parses scorecard structure
- Filtering: Identifies valid scores (2-12 range) with sanity checks (total 65-130)

### Par Values

Moraga Country Club par values are defined in `parValues` array (line ~22 in app.js). Sum = 72.

### Styling

Moraga CC branding colors: `#2D4F32` and `#355E3B` (forest green). Oak leaf SVG logo.

## File Structure

```
index.html    - Main application entry
app.js        - All application logic (FantasyGolf class)
styles.css    - Responsive styling
DEMO.html     - Static preview page
```

## Known Considerations

- Firebase credentials are in app.js (acceptable for this private use case)
- OCR results vary by scorecard format; manual review UI is provided
- Focus restoration logic (`pendingFocusHole`) ensures cursor position survives re-renders
