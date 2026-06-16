const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function processLogo(panelName) {
  // Now __dirname is inside admin-panel
  const logoPath = path.join(__dirname, '..', panelName, 'public', 'logo.png');
  if (!fs.existsSync(logoPath)) {
    console.log('No logo.png found in', logoPath);
    return;
  }

  const image = await loadImage(logoPath);
  
  // We want to create 192x192 and 512x512
  const sizes = [192, 512];
  
  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#0f172a'; // admin background color
    ctx.fillRect(0, 0, size, size);
    
    // Calculate aspect ratio
    const scale = Math.min((size * 0.8) / image.width, (size * 0.8) / image.height);
    const newWidth = image.width * scale;
    const newHeight = image.height * scale;
    
    const x = (size - newWidth) / 2;
    const y = (size - newHeight) / 2;
    
    ctx.drawImage(image, x, y, newWidth, newHeight);
    
    const outputPath = path.join(__dirname, '..', panelName, 'public', `pwa-${size}x${size}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Created ${outputPath}`);
  }
}

async function run() {
  await processLogo('admin-panel');
  await processLogo('employee-panel');
}

run();
