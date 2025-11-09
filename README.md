# Fantasy Golf 2026 🏌️

A simple, elegant web application for tracking the best scores of your golf group at Moraga Country Club throughout 2026.

## Features

- **Best Score Tracking**: Track each player's best score on each of the 18 holes
- **Player Management**: Add or remove players as needed
- **Click-to-Edit**: Simply click on any hole number to update a score
- **OCR Scorecard Upload**: Take a photo of your scorecard and automatically extract scores
- **Running Totals**: See current total scores for all players
- **Local Storage**: All data is saved locally in your browser
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## How to Use

### Getting Started

1. Open `index.html` in any modern web browser
2. The app comes pre-loaded with three players: Rob, Drew, and Mike

### Updating Scores

**Manual Entry:**
1. Click on any score cell (hole number) for a player
2. Enter the score
3. Click "Save"
   - The app will only update if the new score is better than the current best
   - You can override this if needed

**Scorecard Upload (OCR):**
1. Click the "📷 Upload Scorecard" button
2. Take a photo or select an image of your scorecard
3. Wait for the OCR processing to complete
4. Review the detected scores (you can edit them)
5. Select the player from the dropdown
6. Click "Apply Scores"
   - Only better scores will be updated

### Managing Players

**Add a Player:**
1. Click "+ Add Player"
2. Enter the player's name
3. Click "Add Player"

**Remove a Player:**
1. Click the "✕" button next to the player's name
2. Confirm the removal

### Reset Scores

Click "Reset All Scores" to clear all scores for all players (use with caution!)

## Technical Details

### Technologies Used

- **HTML5**: Structure
- **CSS3**: Styling with responsive design
- **JavaScript (ES6)**: Application logic
- **Tesseract.js**: OCR for scorecard image processing
- **localStorage**: Data persistence

### Data Storage

All data is stored locally in your browser's localStorage. This means:
- No server required
- Data persists between sessions
- Data is specific to the browser you're using
- Clearing browser data will erase all scores

### Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

### Par Values

The app uses standard par values for Moraga Country Club. You can modify these in the code if needed (see `app.js`, line 9).

## File Structure

```
fantasy-golf-2026/
├── index.html      # Main HTML structure
├── styles.css      # All styling
├── app.js          # Application logic
└── README.md       # This file
```

## Tips for Best Results

### OCR Scorecard Upload

For best OCR results:
- Take photos in good lighting
- Keep the scorecard flat and in focus
- Ensure numbers are clearly visible
- Avoid shadows or glare
- The app looks for numbers between 1-15

### Score Tracking

- The app tracks your **best** score on each hole throughout the year
- Once you record a score, you can only improve it (unless you override)
- Total scores are calculated from all recorded holes
- Holes without scores show "—" and aren't counted in totals

## Future Enhancements

Possible features to add:
- Export/import data (backup/restore)
- Score history (track all rounds, not just best)
- Statistics and charts
- Handicap calculations
- Multi-course support
- Online sync between devices

## Support

For issues or suggestions, contact the developer or modify the code yourself!

## License

Free to use and modify for your golf group!

---

**Fantasy Golf 2026** - Track your best, play your best! 🏌️⛳
