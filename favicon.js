// Create favicon dynamically
function createFavicon() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 32, 32);

    // Size of each block in the Tetris piece
    const blockSize = 8;
    
    // Colors from our game
    const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFD700'];
    
    // Draw L-shaped Tetris piece with different colors for each block
    // Vertical part (3 blocks)
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(10, 6 + (i * blockSize), blockSize, blockSize);
        
        // Add 3D effect for each block
        // Highlights
        ctx.fillStyle = '#FFFFFF33';
        ctx.fillRect(10, 6 + (i * blockSize), blockSize, 2); // top
        ctx.fillRect(10, 6 + (i * blockSize), 2, blockSize); // left
        
        // Shadows
        ctx.fillStyle = '#00000033';
        ctx.fillRect(16, 6 + (i * blockSize), 2, blockSize); // right
        ctx.fillRect(10, 6 + (i * blockSize) + 6, blockSize, 2); // bottom
    }
    
    // Horizontal part (last block)
    ctx.fillStyle = colors[3];
    ctx.fillRect(18, 22, blockSize, blockSize);
    
    // Add 3D effect for horizontal block
    ctx.fillStyle = '#FFFFFF33';
    ctx.fillRect(18, 22, blockSize, 2); // top
    ctx.fillRect(18, 22, 2, blockSize); // left
    
    ctx.fillStyle = '#00000033';
    ctx.fillRect(24, 22, 2, blockSize); // right
    ctx.fillRect(18, 28, blockSize, 2); // bottom

    // Create favicon link element
    const link = document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = canvas.toDataURL("image/x-icon");

    // Remove existing favicon
    const existingFavicon = document.querySelector('link[rel="shortcut icon"]');
    if (existingFavicon) {
        document.head.removeChild(existingFavicon);
    }

    // Add new favicon
    document.head.appendChild(link);
}

// Create favicon when the script loads
createFavicon();
