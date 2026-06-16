const { createCanvas } = require('canvas');
const fs = require('fs');

function createIcon(text, size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, size, size);

  // Circle
  ctx.fillStyle = '#10b981'; // emerald-500
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.25}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

// Admin Icons
createIcon('Admin', 192, './public/pwa-192x192.png');
createIcon('Admin', 512, './public/pwa-512x512.png');

// Employee Icons
createIcon('Emp', 192, '../employee-panel/public/pwa-192x192.png');
createIcon('Emp', 512, '../employee-panel/public/pwa-512x512.png');

console.log("Icons generated successfully!");
