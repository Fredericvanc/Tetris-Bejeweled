// Create a canvas for the favicon
const canvas = document.createElement('canvas');
canvas.width = 32;
canvas.height = 32;
const ctx = canvas.getContext('2d');

// Clear background
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, 32, 32);

// Draw L piece (blue color from our game)
ctx.fillStyle = '#0000FF';
// Main vertical part
ctx.fillRect(8, 4, 8, 20);
// Bottom horizontal part
ctx.fillRect(8, 20, 16, 8);

// Add some shading for 3D effect
ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
ctx.fillRect(8, 4, 2, 24);
ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
ctx.fillRect(14, 4, 2, 24);

// Convert to favicon
const link = document.createElement('link');
link.type = 'image/x-icon';
link.rel = 'shortcut icon';
link.href = canvas.toDataURL("image/x-icon");
document.head.appendChild(link);
