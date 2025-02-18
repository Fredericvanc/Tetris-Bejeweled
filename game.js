const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

const COLORS = [
    '#FF0000', // Red
    '#00FF00', // Bright Green
    '#0000FF', // Blue
    '#FFD700', // Gold
    '#FF1493', // Deep Pink
    '#00FFFF', // Cyan
    '#FF8C00'  // Dark Orange
];

// Define all possible Tetris pieces
const SHAPES = [
    {
        shape: [[1, 1], [1, 1]], // Square
        name: 'O'
    },
    {
        shape: [[1, 1, 1, 1]], // Line
        name: 'I'
    },
    {
        shape: [[1, 1, 1], [0, 1, 0]], // T
        name: 'T'
    },
    {
        shape: [[1, 1, 1], [1, 0, 0]], // L
        name: 'L'
    },
    {
        shape: [[1, 1, 1], [0, 0, 1]], // J
        name: 'J'
    },
    {
        shape: [[1, 1, 0], [0, 1, 1]], // S
        name: 'S'
    },
    {
        shape: [[0, 1, 1], [1, 1, 0]], // Z
        name: 'Z'
    }
];

let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let currentPiece = null;
let score = 0;
let sparkles = [];
let comboCount = 0;
let activeAnimations = [];
let gameSpeed = 1;
let dropInterval;
let leaderboard = [];
let gameOver = false;
let gameLoop;

// Load leaderboard from localStorage
function loadLeaderboard() {
    const savedLeaderboard = localStorage.getItem('leaderboard');
    if (savedLeaderboard) {
        leaderboard = JSON.parse(savedLeaderboard);
        updateLeaderboardDisplay();
    }
}

function updateLeaderboardDisplay() {
    const leaderboardElement = document.getElementById('leaderboard');
    leaderboardElement.innerHTML = '';
    
    leaderboard
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span>${index + 1}. ${entry.name}</span>
                <span>${entry.score}</span>
            `;
            leaderboardElement.appendChild(item);
        });
}

function showGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    const scoreDisplay = document.getElementById('finalScore');
    const nameInput = document.getElementById('playerName');
    const submitButton = document.getElementById('submitScore');
    
    // Load previously saved name
    const savedName = localStorage.getItem('playerName') || '';
    nameInput.value = savedName;
    
    scoreDisplay.textContent = score;
    modal.style.display = 'flex';
    
    // Enable the submit button for the new game over
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Score';
    
    if (!savedName) {
        nameInput.focus();
    }
}

function submitScore() {
    const nameInput = document.getElementById('playerName');
    const submitButton = document.getElementById('submitScore');
    const name = nameInput.value.trim();
    
    if (name) {
        // Disable the submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Score Submitted!';
        
        // Save name for future games
        localStorage.setItem('playerName', name);
        
        // Add score to leaderboard
        const newScore = {
            name: name,
            score: score,
            date: new Date().toLocaleDateString()
        };
        
        leaderboard.push(newScore);
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10); // Keep top 10
        
        // Save updated leaderboard
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
        
        // Update display
        updateLeaderboardDisplay();
    } else {
        alert('Please enter your name!');
    }
}

function startNewGame() {
    // Cancel existing game loop if any
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    
    // Reset game state
    board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    score = 0;
    comboCount = 0;
    gameSpeed = 1;
    gameOver = false;
    dropInterval = 1000 / gameSpeed;
    
    // Reset the submit button for next game over
    const submitButton = document.getElementById('submitScore');
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Score';
    
    // Hide the game over modal
    const modal = document.getElementById('gameOverModal');
    modal.style.display = 'none';
    
    // Create new piece and start game loop
    currentPiece = createPiece();
    
    // Update speed display
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
    
    // Reset drop interval
    gameLoop = requestAnimationFrame(update);
}

function increaseSpeed() {
    gameSpeed += 0.1;
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
    
    // Update drop interval
    dropInterval = 1000 / gameSpeed;
}

class Animation {
    constructor(type, x, y, color, text) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.color = color;
        this.text = text;
        this.life = 1;
        this.scale = 0;
        this.rotation = 0;
    }

    update() {
        if (this.type === 'combo') {
            this.y -= 2;
            this.scale = Math.min(this.scale + 0.2, 1);
            this.life -= 0.02;
        } else if (this.type === 'tetris') {
            this.rotation += 0.1;
            this.scale = Math.min(this.scale + 0.15, 1);
            this.life -= 0.015;
        }
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        
        if (this.type === 'combo') {
            ctx.fillStyle = `rgba(255, 215, 0, ${this.life})`;
            ctx.strokeStyle = `rgba(255, 140, 0, ${this.life})`;
            ctx.lineWidth = 3;
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText(this.text, 0, 0);
            ctx.fillText(this.text, 0, 0);
        } else if (this.type === 'tetris') {
            ctx.fillStyle = `rgba(0, 255, 255, ${this.life})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
            ctx.lineWidth = 3;
            ctx.font = 'bold 50px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText('TETRIS!', 0, 0);
            ctx.fillText('TETRIS!', 0, 0);
        }
        
        ctx.restore();
    }
}

function createPiece() {
    const randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const piece = {
        x: Math.floor(COLS / 2) - Math.floor(randomShape.shape[0].length / 2),
        y: 0,
        shape: randomShape.shape,
        colors: [], // Array to store colors for each block
        name: randomShape.name,
        rotationState: 0  // Initialize rotation state
    };

    // Create a color matrix matching the shape
    piece.colors = randomShape.shape.map(row => 
        row.map(cell => 
            cell ? COLORS[Math.floor(Math.random() * COLORS.length)] : null
        )
    );

    return piece;
}

function drawBoard() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                ctx.fillStyle = COLORS[value - 1];
                ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                
                // Add shine effect to board pieces
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.moveTo(x * BLOCK_SIZE, y * BLOCK_SIZE);
                ctx.lineTo((x + 0.5) * BLOCK_SIZE, y * BLOCK_SIZE);
                ctx.lineTo(x * BLOCK_SIZE, (y + 0.5) * BLOCK_SIZE);
                ctx.fill();
            }
        });
    });
}

function drawPiece() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                ctx.fillStyle = currentPiece.colors[y][x];
                ctx.fillRect(
                    (currentPiece.x + x) * BLOCK_SIZE,
                    (currentPiece.y + y) * BLOCK_SIZE,
                    BLOCK_SIZE,
                    BLOCK_SIZE
                );
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    (currentPiece.x + x) * BLOCK_SIZE,
                    (currentPiece.y + y) * BLOCK_SIZE,
                    BLOCK_SIZE,
                    BLOCK_SIZE
                );
                
                // Add a shine effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.moveTo((currentPiece.x + x) * BLOCK_SIZE, (currentPiece.y + y) * BLOCK_SIZE);
                ctx.lineTo((currentPiece.x + x + 0.5) * BLOCK_SIZE, (currentPiece.y + y) * BLOCK_SIZE);
                ctx.lineTo((currentPiece.x + x) * BLOCK_SIZE, (currentPiece.y + y + 0.5) * BLOCK_SIZE);
                ctx.fill();
            }
        });
    });
}

function merge() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                // Store the color index + 1 as the value, and the actual color in a separate array
                const colorIndex = COLORS.indexOf(currentPiece.colors[y][x]) + 1;
                board[currentPiece.y + y][currentPiece.x + x] = colorIndex;
            }
        });
    });
}

function isValidMove(piece, offsetX, offsetY) {
    return piece.shape.every((row, y) => {
        return row.every((value, x) => {
            let newX = piece.x + x + offsetX;
            let newY = piece.y + y + offsetY;
            return (
                value === 0 ||
                (newX >= 0 && newX < COLS && newY < ROWS && (newY < 0 || board[newY][newX] === 0))
            );
        });
    });
}

function moveDown() {
    if (gameOver) return;
    
    if (isValidMove(currentPiece, 0, 1)) {
        currentPiece.y++;
    } else {
        merge();
        if (checkMatches()) {
            score += comboCount * 50; // Bonus points for combos
        }
        currentPiece = createPiece();
        increaseSpeed(); // Increase speed with each new piece
        
        if (!isValidMove(currentPiece, 0, 0)) {
            // Game over
            gameOver = true;
            cancelAnimationFrame(gameLoop);
            showGameOverModal();
        }
    }
}

function moveLeft() {
    if (gameOver) return;
    
    if (isValidMove(currentPiece, -1, 0)) {
        currentPiece.x--;
    }
}

function moveRight() {
    if (gameOver) return;
    
    if (isValidMove(currentPiece, 1, 0)) {
        currentPiece.x++;
    }
}

function checkMatches() {
    let matchFound = false;
    let totalClears = 0;
    
    // First, check for Tetris lines
    for (let y = ROWS - 1; y >= 0; y--) {
        if (isLineFull(y)) {
            matchFound = true;
            totalClears++;
            clearTetrisLine(y);
            createTetrisAnimation(y);
            score += 800; // Bonus points for Tetris line
        }
    }
    
    // Then check for color matches
    const matches = findMatches();
    if (matches.length > 0) {
        matchFound = true;
        totalClears += matches.length;
        
        matches.forEach(match => {
            if (match.length >= 5) {
                // Clear all blocks of the same color
                clearAllBlocksOfColor(match[0].color);
                createColorExplosion(COLORS[match[0].color - 1]);
                score += 500;
                createComboAnimation(match.length, totalClears);
            } else if (match.length >= 4) {
                // Clear the whole line (row or column)
                if (match[0].y === match[1].y) {
                    clearRow(match[0].y);
                    createLineExplosion(match[0].y, true);
                } else {
                    clearColumn(match[0].x);
                    createLineExplosion(match[0].x, false);
                }
                score += 300;
                createComboAnimation(match.length, totalClears);
            } else {
                // Clear just the matching blocks
                match.forEach(block => {
                    board[block.y][block.x] = 0;
                    createSparkles(block.x * BLOCK_SIZE, block.y * BLOCK_SIZE);
                });
                score += 100;
            }
        });
    }

    if (matchFound) {
        comboCount++;
        if (comboCount > 1) {
            score += comboCount * 50; // Bonus points for combos
        }
        makeBlocksFall();
    } else {
        comboCount = 0;
    }
    
    return matchFound;
}

function isLineFull(y) {
    return board[y].every(cell => cell !== 0);
}

function clearTetrisLine(y) {
    // Create a white flash effect
    for (let x = 0; x < COLS; x++) {
        createTetrisSparkles(x * BLOCK_SIZE, y * BLOCK_SIZE);
    }
    
    // Clear the line
    for (let y2 = y; y2 > 0; y2--) {
        for (let x = 0; x < COLS; x++) {
            board[y2][x] = board[y2-1][x];
        }
    }
    // Clear top line
    for (let x = 0; x < COLS; x++) {
        board[0][x] = 0;
    }
}

function createTetrisSparkles(x, y) {
    const colors = ['#00FFFF', '#FFFFFF', '#40E0D0'];
    for (let i = 0; i < 8; i++) {
        sparkles.push({
            x: x + BLOCK_SIZE/2,
            y: y + BLOCK_SIZE/2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1,
            size: 3 + Math.random() * 3
        });
    }
}

function createTetrisAnimation(y) {
    activeAnimations.push(new Animation(
        'tetris',
        canvas.width / 2,
        y * BLOCK_SIZE + BLOCK_SIZE / 2,
        null,
        'TETRIS!'
    ));
}

function createComboAnimation(combo, clears) {
    const texts = [
        'DOUBLE!',
        'TRIPLE!',
        'SUPER!',
        'AWESOME!',
        'INCREDIBLE!',
        'INSANE!',
        'GODLIKE!'
    ];
    
    const text = combo <= 8 ? texts[Math.min(combo - 2, texts.length - 1)] : `${combo}x COMBO!`;
    
    activeAnimations.push(new Animation(
        'combo',
        canvas.width / 2,
        canvas.height / 2,
        null,
        text
    ));
}

function findMatches() {
    const matches = [];
    const visited = new Set();

    // Helper function to check if a position has been visited
    const getKey = (x, y) => `${x},${y}`;
    const isVisited = (x, y) => visited.has(getKey(x, y));
    const markVisited = (x, y) => visited.add(getKey(x, y));

    // Check horizontal matches
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS - 2; x++) {
            if (!isVisited(x, y) && board[y][x]) {
                const colorValue = board[y][x];
                let matchLength = 1;
                let currentX = x + 1;

                // Count consecutive matching blocks
                while (currentX < COLS && board[y][currentX] === colorValue) {
                    matchLength++;
                    currentX++;
                }

                if (matchLength >= 3) {
                    const match = [];
                    for (let i = 0; i < matchLength; i++) {
                        match.push({ x: x + i, y, color: colorValue });
                        markVisited(x + i, y);
                    }
                    matches.push(match);
                }
            }
        }
    }

    // Check vertical matches
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS - 2; y++) {
            if (!isVisited(x, y) && board[y][x]) {
                const colorValue = board[y][x];
                let matchLength = 1;
                let currentY = y + 1;

                // Count consecutive matching blocks
                while (currentY < ROWS && board[currentY][x] === colorValue) {
                    matchLength++;
                    currentY++;
                }

                if (matchLength >= 3) {
                    const match = [];
                    for (let i = 0; i < matchLength; i++) {
                        match.push({ x, y: y + i, color: colorValue });
                        markVisited(x, y + i);
                    }
                    matches.push(match);
                }
            }
        }
    }

    return matches;
}

function clearRow(row) {
    for (let x = 0; x < COLS; x++) {
        if (board[row][x] !== 0) {
            createSparkles(x * BLOCK_SIZE, row * BLOCK_SIZE);
        }
        board[row][x] = 0;
    }
}

function clearColumn(col) {
    for (let y = 0; y < ROWS; y++) {
        if (board[y][col] !== 0) {
            createSparkles(col * BLOCK_SIZE, y * BLOCK_SIZE);
        }
        board[y][col] = 0;
    }
}

function clearAllBlocksOfColor(colorValue) {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === colorValue) {
                createSparkles(x * BLOCK_SIZE, y * BLOCK_SIZE);
                board[y][x] = 0;
            }
        }
    }
}

function makeBlocksFall() {
    for (let x = 0; x < COLS; x++) {
        let writeY = ROWS - 1;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y][x] !== 0) {
                if (writeY !== y) {
                    board[writeY][x] = board[y][x];
                    board[y][x] = 0;
                }
                writeY--;
            }
        }
    }
}

function createColorExplosion(color) {
    for (let i = 0; i < 50; i++) {
        const angle = (Math.PI * 2 * i) / 50;
        const speed = 5 + Math.random() * 5;
        sparkles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            life: 1,
            size: 3 + Math.random() * 2
        });
    }
}

function createLineExplosion(pos, isHorizontal) {
    const count = 30;
    const spacing = isHorizontal ? canvas.width / count : canvas.height / count;
    
    for (let i = 0; i < count; i++) {
        const x = isHorizontal ? i * spacing : pos * BLOCK_SIZE;
        const y = isHorizontal ? pos * BLOCK_SIZE : i * spacing;
        
        sparkles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color: '#FFFFFF',
            life: 1,
            size: 2 + Math.random() * 2
        });
    }
}

function createSparkles(x, y) {
    for (let i = 0; i < 5; i++) {
        sparkles.push({
            x: x + BLOCK_SIZE/2,
            y: y + BLOCK_SIZE/2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1
        });
    }
}

function updateSparkles() {
    sparkles = sparkles.filter(sparkle => {
        sparkle.x += sparkle.vx;
        sparkle.y += sparkle.vy;
        sparkle.life -= 0.02;
        return sparkle.life > 0;
    });
}

function drawSparkles() {
    sparkles.forEach(sparkle => {
        const color = sparkle.color || '#FFFFFF';
        ctx.fillStyle = color.replace(')', `, ${sparkle.life})`).replace('rgb', 'rgba');
        ctx.beginPath();
        ctx.arc(sparkle.x, sparkle.y, sparkle.size || 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function update(time) {
    if (gameOver) {
        return; // Stop the game loop if game is over
    }

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
        moveDown();
        dropCounter = 0;
    }

    draw();
    gameLoop = requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }
    
    drawBoard();
    drawPiece();
    
    // Update and draw animations
    activeAnimations = activeAnimations.filter(anim => {
        const isAlive = anim.update();
        if (isAlive) {
            anim.draw(ctx);
        }
        return isAlive;
    });
    
    updateSparkles();
    drawSparkles();
    
    // Draw score with shadow
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`Score: ${score}`, 12, 27);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Score: ${score}`, 10, 25);
    
    // Draw combo counter if active
    if (comboCount > 1) {
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = 'rgba(255, 140, 0, 0.8)';
        ctx.fillText(`${comboCount}x Combo!`, 10, 55);
    }
}

document.addEventListener('keydown', event => {
    if (gameOver) return; // Ignore input if game is over
    
    if (event.key === 'ArrowLeft') moveLeft();
    if (event.key === 'ArrowRight') moveRight();
    if (event.key === 'ArrowDown') moveDown();
    if (event.key === 'ArrowUp') rotatePiece();
});

function rotatePiece() {
    // Special handling for I-piece (4 blocks in a line)
    if (currentPiece.name === 'I') {
        console.log('Before rotation - State:', currentPiece.rotationState);
        console.log('Before rotation - Colors:', JSON.stringify(currentPiece.colors));
        
        // Update rotation state
        currentPiece.rotationState = ((currentPiece.rotationState || 0) + 1) % 4;
        
        // Get current colors in a flat array
        const colors = currentPiece.shape.length === 1 
            ? [...currentPiece.colors[0]]  // Horizontal
            : currentPiece.colors.map(row => row[0]);  // Vertical
            
        console.log('Current colors array:', colors);
        
        let newShape, newColors;
        
        switch (currentPiece.rotationState) {
            case 0: // Horizontal: [A,B,C,D]
                newShape = [[1, 1, 1, 1]];
                newColors = [[colors[0], colors[1], colors[2], colors[3]]];
                break;
            case 1: // Vertical: [A] down
                newShape = [[1], [1], [1], [1]];
                newColors = [[colors[0]], [colors[1]], [colors[2]], [colors[3]]];
                break;
            case 2: // Horizontal: [D,C,B,A]
                newShape = [[1, 1, 1, 1]];
                newColors = [[colors[3], colors[2], colors[1], colors[0]]];
                break;
            case 3: // Vertical: [D] down
                newShape = [[1], [1], [1], [1]];
                newColors = [[colors[3]], [colors[2]], [colors[1]], [colors[0]]];
                break;
        }
        
        console.log('After rotation - State:', currentPiece.rotationState);
        console.log('After rotation - New colors:', JSON.stringify(newColors));
        
        // Calculate position adjustment
        let newX = currentPiece.x;
        let newY = currentPiece.y;
        
        const isGoingVertical = newShape.length > 1;
        if (isGoingVertical) {
            newX = currentPiece.x + 1;
            newY = currentPiece.y - 1;
        } else {
            newX = currentPiece.x - 1;
            newY = currentPiece.y + 1;
        }
        
        // Store old state
        const oldShape = currentPiece.shape;
        const oldColors = currentPiece.colors;
        const oldX = currentPiece.x;
        const oldY = currentPiece.y;
        const oldRotationState = currentPiece.rotationState;
        
        // Apply new state
        currentPiece.shape = newShape;
        currentPiece.colors = newColors;
        currentPiece.x = newX;
        currentPiece.y = newY;
        
        // Revert if invalid
        if (!isValidMove(currentPiece, 0, 0)) {
            currentPiece.shape = oldShape;
            currentPiece.colors = oldColors;
            currentPiece.x = oldX;
            currentPiece.y = oldY;
            currentPiece.rotationState = oldRotationState;
            console.log('Rotation reverted - invalid move');
        }
    } else {
        // Normal rotation for other pieces
        const rotated = [];
        const rotatedColors = [];
        
        for (let i = 0; i < currentPiece.shape[0].length; i++) {
            rotated.push([]);
            rotatedColors.push([]);
            for (let j = currentPiece.shape.length - 1; j >= 0; j--) {
                rotated[i].push(currentPiece.shape[j][i]);
                rotatedColors[i].push(currentPiece.colors[j][i]);
            }
        }
        
        const oldShape = currentPiece.shape;
        const oldColors = currentPiece.colors;
        
        currentPiece.shape = rotated;
        currentPiece.colors = rotatedColors;
        
        if (!isValidMove(currentPiece, 0, 0)) {
            currentPiece.shape = oldShape;
            currentPiece.colors = oldColors;
        }
    }
}

let lastTime = 0;
let dropCounter = 0;

loadLeaderboard();
startNewGame();
gameLoop = requestAnimationFrame(update);
