const canvas = document.getElementById('gameCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

const COLORS = [
    '#FF0000', // Red
    '#00FF00', // Bright Green
    '#0000FF', // Blue
    '#FFD700', // Gold
    // '#FF1493', // Deep Pink
    // '#00FFFF', // Cyan
    // '#FF8C00'  // Dark Orange
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
let nextPiece = null;
let score = 0;
let sparkles = [];
let comboCount = 0;  // Initialize combo counter
let activeAnimations = [];
let gameSpeed = 1;
let lastSpeedIncrease = 0;
let dropInterval;
let gameOver = false;
let gameLoop;
let leaderboard = [];

// Load leaderboard from Firebase or localStorage
function loadLeaderboard() {
    try {
        if (window.firebaseInitialized && firebase) {
            // Use Firebase if available
            const leaderboardRef = firebase.database().ref('leaderboard');
            leaderboardRef.orderByChild('score').limitToLast(10).on('value', (snapshot) => {
                leaderboard = [];
                snapshot.forEach((childSnapshot) => {
                    leaderboard.push(childSnapshot.val());
                });
                leaderboard.sort((a, b) => b.score - a.score);
                updateLeaderboardDisplay();
            });
        } else {
            // Fallback to localStorage if Firebase is not available
            const savedLeaderboard = localStorage.getItem('leaderboard');
            if (savedLeaderboard) {
                leaderboard = JSON.parse(savedLeaderboard);
                updateLeaderboardDisplay();
            }
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        // Fallback to localStorage if Firebase fails
        const savedLeaderboard = localStorage.getItem('leaderboard');
        if (savedLeaderboard) {
            leaderboard = JSON.parse(savedLeaderboard);
            updateLeaderboardDisplay();
        }
    }
}

function updateLeaderboardDisplay() {
    const leaderboardDiv = document.getElementById('leaderboard');
    const tbody = leaderboardDiv.querySelector('tbody');
    tbody.innerHTML = '';
    
    // Sort scores in descending order
    const sortedScores = leaderboard.sort((a, b) => b.score - a.score);
    
    // Display top 10 scores
    sortedScores.slice(0, 10).forEach((entry, index) => {
        const row = document.createElement('tr');
        
        // Rank column
        const rankCell = document.createElement('td');
        rankCell.className = 'rank';
        rankCell.textContent = `#${index + 1}`;
        
        // Player name column
        const nameCell = document.createElement('td');
        nameCell.textContent = entry.name || 'Anonymous';
        
        // Score column
        const scoreCell = document.createElement('td');
        scoreCell.className = 'score';
        scoreCell.textContent = entry.score.toLocaleString();
        
        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(scoreCell);
        tbody.appendChild(row);
    });
}

function showGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    const scoreDisplay = document.getElementById('finalScore');
    const nameInput = document.getElementById('playerName');
    const submitButton = document.getElementById('submitScore');
    const shareButton = document.getElementById('shareScore');
    
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
    
    shareButton.disabled = false;
    shareButton.textContent = 'Share Score';
}

function submitScore() {
    const nameInput = document.getElementById('playerName');
    const submitButton = document.getElementById('submitScore');
    const name = nameInput.value.trim();
    
    if (name) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        
        // Save name for future games
        localStorage.setItem('playerName', name);
        
        const newScore = {
            name: name,
            score: score,
            date: new Date().toLocaleDateString()
        };
        
        try {
            if (window.firebaseInitialized && firebase) {
                // Use Firebase if available
                firebase.database().ref('leaderboard').push(newScore)
                    .then(() => {
                        submitButton.textContent = 'Submitted!';
                    })
                    .catch((error) => {
                        console.error("Firebase error:", error);
                        // Fallback to localStorage
                        saveToLocalStorage(newScore);
                    });
            } else {
                // Use localStorage if Firebase is not available
                saveToLocalStorage(newScore);
            }
        } catch (error) {
            console.error('Error submitting score:', error);
            // Fallback to localStorage
            saveToLocalStorage(newScore);
        }
    } else {
        alert('Please enter your name!');
    }
}

// Helper function to save to localStorage
function saveToLocalStorage(newScore) {
    leaderboard.push(newScore);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10); // Keep top 10
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    updateLeaderboardDisplay();
    const submitButton = document.getElementById('submitScore');
    submitButton.textContent = 'Submitted!';
}

function shareScore() {
    const gameUrl = 'https://fredericvanc.github.io/Tetris-Bejeweled/';
    const tweetText = `I just scored ${score} points in Tetris Bejeweled! Can you beat my score? Play now at ${gameUrl} @RealFredericVC`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
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
    nextPiece = createPiece();
    
    // Update speed display
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
    
    // Reset drop interval
    gameLoop = requestAnimationFrame(update);
    
    // Initialize mobile controls
    initializeMobileControls();
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
        this.scale = 1;
    }

    update() {
        if (this.type === 'line') {
            this.life -= 0.02;
            this.scale += 0.05;
        } else if (this.type === 'color') {
            this.life -= 0.02;
            this.scale += 0.05;
        } else {
            this.life -= 0.02;
            this.scale += 0.05;
        }
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        if (this.type === 'line') {
            ctx.globalAlpha = this.life;
            ctx.translate(this.x, this.y);
            ctx.scale(this.scale, this.scale);
            ctx.font = "bold 48px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(this.text, 0, 0);
            ctx.fillStyle = this.color || '#FFD700';
            ctx.fillText(this.text, 0, 0);
        } else if (this.type === 'color') {
            ctx.globalAlpha = this.life;
            ctx.translate(this.x, this.y);
            ctx.scale(this.scale, this.scale);
            ctx.font = "bold 48px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(this.text, 0, 0);
            ctx.fillStyle = this.color || '#FFD700';
            ctx.fillText(this.text, 0, 0);
        } else {
            ctx.globalAlpha = this.life;
            ctx.translate(this.x, this.y);
            ctx.scale(this.scale, this.scale);
            ctx.font = "bold 48px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(this.text, 0, 0);
            ctx.fillStyle = this.color || '#FFD700';
            ctx.fillText(this.text, 0, 0);
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

function drawPiece(piece) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                ctx.fillStyle = piece.colors[y][x];
                ctx.fillRect(
                    (piece.x + x) * BLOCK_SIZE,
                    (piece.y + y) * BLOCK_SIZE,
                    BLOCK_SIZE,
                    BLOCK_SIZE
                );
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    (piece.x + x) * BLOCK_SIZE,
                    (piece.y + y) * BLOCK_SIZE,
                    BLOCK_SIZE,
                    BLOCK_SIZE
                );
                
                // Add a shine effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.moveTo((piece.x + x) * BLOCK_SIZE, (piece.y + y) * BLOCK_SIZE);
                ctx.lineTo((piece.x + x + 0.5) * BLOCK_SIZE, (piece.y + y) * BLOCK_SIZE);
                ctx.lineTo((piece.x + x) * BLOCK_SIZE, (piece.y + y + 0.5) * BLOCK_SIZE);
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
        increaseSpeed(); // Increase speed for each new piece
        if (checkForMatches()) {
            score += comboCount * 50; // Bonus points for combos
        }
        currentPiece = nextPiece;
        nextPiece = createPiece();
        
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

async function checkForMatches() {
    let matches = findMatches();
    let chainMultiplier = 1;
    let totalClears = 0;
    let hasChainReaction = false;
    
    // Only increment combo on first match if it's not a chain reaction
    if (matches.length > 0 && !hasChainReaction) {
        comboCount++;
    }
    
    while (matches.length > 0) {
        hasChainReaction = true;
        totalClears += matches.length;
        
        // Increment combo for each new set of matches in the chain
        if (matches.length > 0) {
            comboCount++;
        }
        
        // Clear current matches
        for (let match of matches) {
            // Add sparkle effects at match positions
            for (let pos of match.positions) {
                addSparkleEffect(pos.x * BLOCK_SIZE + BLOCK_SIZE/2, 
                               pos.y * BLOCK_SIZE + BLOCK_SIZE/2, 
                               board[pos.y][pos.x]);
            }
            
            // Handle special clears based on match length and type
            if (match.type === 'color') {
                // Color clear - all blocks of the same color
                const colorValue = board[match.positions[0].y][match.positions[0].x];
                match.positions = clearAllBlocksOfColor(colorValue);
                createColorClearAnimation();
            } else if (match.type === 'line') {
                // Line clear - entire row or column
                const firstPos = match.positions[0];
                const secondPos = match.positions[1];
                
                if (firstPos.y === secondPos.y) {
                    // Horizontal line
                    match.positions = clearRow(firstPos.y);
                    createLineClearAnimation(true);
                } else {
                    // Vertical line
                    match.positions = clearColumn(firstPos.x);
                    createLineClearAnimation(false);
                }
            }
            
            // Clear matched blocks
            for (let pos of match.positions) {
                board[pos.y][pos.x] = 0;
            }
            
            // Update score based on match type and chain multiplier
            let baseScore = 0;
            switch (match.type) {
                case 'color':
                    baseScore = 500;
                    break;
                case 'line':
                    baseScore = 300;
                    break;
                default:
                    baseScore = 100;
            }
            
            // Apply chain multiplier and combo bonus
            score += (baseScore * chainMultiplier) + (comboCount * 50);
        }
        
        // Create combo animation if we have multiple clears
        if (totalClears > 1) {
            createComboAnimation(matches.length, totalClears);
        }
        
        // Wait for blocks to clear animation
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Make blocks fall
        let blocksFell = false;
        do {
            blocksFell = false;
            for (let y = ROWS - 2; y >= 0; y--) {
                for (let x = 0; x < COLS; x++) {
                    if (board[y][x] !== 0 && board[y + 1][x] === 0) {
                        board[y + 1][x] = board[y][x];
                        board[y][x] = 0;
                        blocksFell = true;
                    }
                }
            }
            if (blocksFell) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } while (blocksFell);
        
        // Increase chain multiplier for subsequent matches
        chainMultiplier++;
        
        // Check for new matches after blocks have fallen
        matches = findMatches();
        
        // If new matches found, add a visual indicator
        if (matches.length > 0) {
            // Display chain combo text
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(`Chain x${chainMultiplier}!`, canvas.width/2 - 50, canvas.height/2);
            ctx.restore();
            
            // Wait a moment to show the chain notification
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // Only reset combo count if no matches were found at all
    if (!hasChainReaction) {
        comboCount = 0;
    }
    
    return matches.length > 0;
}

// Clear all blocks of the same color
function clearAllBlocksOfColor(colorValue) {
    const positions = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === colorValue) {
                positions.push({ x, y });
                addSparkleEffect(x * BLOCK_SIZE + BLOCK_SIZE/2, 
                               y * BLOCK_SIZE + BLOCK_SIZE/2, 
                               colorValue);
            }
        }
    }
    return positions;
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
                    const match = {
                        type: matchLength >= 5 ? 'color' : 
                              matchLength >= 4 ? 'line' : 'normal',
                        positions: []
                    };
                    for (let i = 0; i < matchLength; i++) {
                        match.positions.push({ x: x + i, y });
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
                    const match = {
                        type: matchLength >= 5 ? 'color' : 
                              matchLength >= 4 ? 'line' : 'normal',
                        positions: []
                    };
                    for (let i = 0; i < matchLength; i++) {
                        match.positions.push({ x, y: y + i });
                        markVisited(x, y + i);
                    }
                    matches.push(match);
                }
            }
        }
    }

    return matches;
}

function createComboAnimation(matchSize, totalClears) {
    const texts = [
        "NICE!",
        "GREAT!",
        "AWESOME!",
        "INCREDIBLE!",
        "UNSTOPPABLE!"
    ];
    
    const text = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        text: texts[Math.min(totalClears - 1, texts.length - 1)],
        life: 1,
        scale: 1,
        color: '#FFD700'
    };
    activeAnimations.push(text);
}

function createColorClearAnimation() {
    const text = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        text: "COLOR CLEAR!",
        life: 1,
        scale: 1,
        color: '#FFD700'
    };
    activeAnimations.push(text);
}

function addSparkleEffect(x, y, color) {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
    const sparkleColor = colors[color % colors.length];
    
    for (let i = 0; i < 5; i++) {
        sparkles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color: sparkleColor,
            life: 1,
            size: 2 + Math.random() * 2
        });
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
    const ctx = canvas.getContext('2d');
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
    
    // Draw the game board and current piece
    drawBoard();
    if (currentPiece) {
        drawPiece(currentPiece);
    }
    
    // Draw the preview piece
    drawPreviewPiece();
    
    // Update and draw animations
    for (let i = activeAnimations.length - 1; i >= 0; i--) {
        const anim = activeAnimations[i];
        anim.life -= 0.02;
        
        if (anim.life <= 0) {
            activeAnimations.splice(i, 1);
            continue;
        }
        
        if (anim.text) {
            ctx.save();
            ctx.globalAlpha = anim.life;
            ctx.font = `bold ${24 * anim.scale}px Arial`;
            ctx.fillStyle = anim.color || '#FFD700';
            ctx.textAlign = 'center';
            ctx.fillText(anim.text, anim.x, anim.y);
            ctx.restore();
            anim.scale = 1 + Math.sin(anim.life * Math.PI) * 0.5;
        }
    }
    
    // Update and draw sparkles
    updateSparkles();
    drawSparkles();
    
    // Draw score with shadow
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    
    // Draw score shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`Score: ${score}`, 12, 32);
    // Draw score
    ctx.fillStyle = 'white';
    ctx.fillText(`Score: ${score}`, 10, 30);
    
    // Draw combo counter if active
    if (comboCount > 1) {
        // Draw combo shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(`Combo x${comboCount}!`, 12, 62);
        // Draw combo
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Combo x${comboCount}!`, 10, 60);
    }
    
    // Draw speed indicator
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
}

function drawPreviewPiece() {
    if (!nextPiece) return;
    
    // Clear the preview canvas
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Calculate piece dimensions
    const pieceWidth = nextPiece.shape[0].length * BLOCK_SIZE;
    const pieceHeight = nextPiece.shape.length * BLOCK_SIZE;
    
    // Calculate center position
    const offsetX = (previewCanvas.width - pieceWidth) / 2;
    const offsetY = (previewCanvas.height - pieceHeight) / 2;
    
    // Draw the preview piece
    nextPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                previewCtx.fillStyle = nextPiece.colors[y][x];
                previewCtx.fillRect(
                    offsetX + x * BLOCK_SIZE,
                    offsetY + y * BLOCK_SIZE,
                    BLOCK_SIZE - 1,
                    BLOCK_SIZE - 1
                );
            }
        });
    });
}

function initializeMobileControls() {
    const dPad = document.querySelector('.d-pad');
    if (!dPad) return;
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', function(e) {
        if (e.target.closest('.d-pad')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Handle button touches
    const buttons = dPad.querySelectorAll('button');
    buttons.forEach(button => {
        // Handle touch start
        button.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const key = this.getAttribute('data-key');
            handleKeyEvent(key);
        });
        
        // Handle touch end
        button.addEventListener('touchend', function(e) {
            e.preventDefault();
        });
        
        // Handle mouse events for testing on desktop
        button.addEventListener('mousedown', function(e) {
            const key = this.getAttribute('data-key');
            handleKeyEvent(key);
        });
    });
}

function handleKeyEvent(key) {
    if (gameOver) return;
    
    switch (key) {
        case 'ArrowLeft':
            moveLeft();
            break;
        case 'ArrowRight':
            moveRight();
            break;
        case 'ArrowDown':
            moveDown();
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
    }
}

document.addEventListener('keydown', event => {
    if (gameOver) return;
    handleKeyEvent(event.key);
});

// Prevent arrow key scrolling
window.addEventListener('keydown', function(e) {
    if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}, false);

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

// Clear a full row
function clearRow(y) {
    const positions = [];
    for (let x = 0; x < COLS; x++) {
        if (board[y][x] !== 0) {
            positions.push({ x, y });
            addSparkleEffect(x * BLOCK_SIZE + BLOCK_SIZE/2, 
                           y * BLOCK_SIZE + BLOCK_SIZE/2, 
                           board[y][x]);
        }
    }
    return positions;
}

// Clear a full column
function clearColumn(x) {
    const positions = [];
    for (let y = 0; y < ROWS; y++) {
        if (board[y][x] !== 0) {
            positions.push({ x, y });
            addSparkleEffect(x * BLOCK_SIZE + BLOCK_SIZE/2, 
                           y * BLOCK_SIZE + BLOCK_SIZE/2, 
                           board[y][x]);
        }
    }
    return positions;
}

// Create line clear animation
function createLineClearAnimation(isHorizontal) {
    const text = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        text: isHorizontal ? "ROW CLEAR!" : "COLUMN CLEAR!",
        life: 1,
        scale: 1,
        color: '#4CAF50'
    };
    activeAnimations.push(text);
}

loadLeaderboard();
startNewGame();
gameLoop = requestAnimationFrame(update);
