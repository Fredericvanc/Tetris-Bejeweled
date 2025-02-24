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
];

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
let comboCount = 0;
let activeAnimations = [];
let gameSpeed = 1;
let lastSpeedIncrease = 0;
let dropInterval;
let gameOver = false;
let gameLoop;
let leaderboard = [];
let isPaused = false;
let wasManuallyPaused = false;

function loadLeaderboard() {
    try {
        if (window.firebaseInitialized && firebase) {
            const leaderboardRef = firebase.database().ref('leaderboard');
            leaderboardRef.orderByChild('score').limitToLast(100).on('value', (snapshot) => {
                leaderboard = [];
                snapshot.forEach((childSnapshot) => {
                    leaderboard.push(childSnapshot.val());
                });
                leaderboard.sort((a, b) => b.score - a.score);
                updateLeaderboardDisplay();
            });
        } else {
            const savedLeaderboard = localStorage.getItem('leaderboard');
            if (savedLeaderboard) {
                leaderboard = JSON.parse(savedLeaderboard);
                updateLeaderboardDisplay();
            }
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
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
    
    const sortedScores = leaderboard.sort((a, b) => b.score - a.score);
    
    sortedScores.slice(0, 100).forEach((entry, index) => {
        const row = document.createElement('tr');
        
        const rankCell = document.createElement('td');
        rankCell.className = 'rank';
        rankCell.textContent = `#${index + 1}`;
        
        const nameCell = document.createElement('td');
        nameCell.textContent = entry.name || 'Anonymous';
        
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
    
    const savedName = localStorage.getItem('playerName') || '';
    nameInput.value = savedName;
    
    scoreDisplay.textContent = score;
    modal.style.display = 'flex';
    
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
    
    // Validate score and name
    if (!name) {
        alert('Please enter your name!');
        return;
    }
    
    if (name.length > 20) {
        alert('Name must be 20 characters or less!');
        return;
    }
    
    if (typeof score !== 'number' || score < 0 || score > 1000000) {
        console.error('Invalid score detected:', score);
        alert('Invalid score detected. This has been logged.');
        return;
    }
    
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    
    localStorage.setItem('playerName', name);
    
    const newScore = {
        name: name,
        score: score,
        date: new Date().toLocaleDateString()
    };

    // Execute reCAPTCHA verification
    grecaptcha.execute('6Lddlt4qAAAAANwBt_1SjBB-Li1Mm9TuAJIqw5iI', {action: 'submit_score'})
        .then(function(token) {
            // Add the token to the score data
            newScore.recaptchaToken = token;
            
            try {
                if (window.firebaseInitialized && firebase) {
                    firebase.database().ref('leaderboard').push(newScore)
                        .then(() => {
                            submitButton.textContent = 'Submitted!';
                        })
                        .catch((error) => {
                            console.error("Firebase error:", error);
                            saveToLocalStorage(newScore);
                        });
                } else {
                    saveToLocalStorage(newScore);
                }
            } catch (error) {
                console.error('Error submitting score:', error);
                saveToLocalStorage(newScore);
            }
        })
        .catch(function(error) {
            console.error('reCAPTCHA error:', error);
            alert('Error verifying submission. Score saved locally.');
            saveToLocalStorage(newScore);
        });
}

function saveToLocalStorage(newScore) {
    leaderboard.push(newScore);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 100);
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
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    
    board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    score = 0;
    comboCount = 0;
    sparkles = [];
    activeAnimations = [];
    gameOver = false;
    isPaused = false;
    wasManuallyPaused = false;
    gameSpeed = 1;
    lastSpeedIncrease = 0;
    dropInterval = 1000 / gameSpeed;
    
    const submitButton = document.getElementById('submitScore');
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Score';
    
    const modal = document.getElementById('gameOverModal');
    modal.style.display = 'none';
    
    currentPiece = createPiece();
    nextPiece = createPiece();
    
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
    
    gameLoop = requestAnimationFrame(update);
    
    initializeMobileControls();
}

function increaseSpeed() {
    gameSpeed += 0.1;
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
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
        this.life -= 0.02;
        this.scale += 0.05;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
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
        ctx.restore();
    }
}

function createPiece() {
    const randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const piece = {
        x: Math.floor(COLS / 2) - Math.floor(randomShape.shape[0].length / 2),
        y: 0,
        shape: randomShape.shape,
        colors: [],
        name: randomShape.name,
        rotationState: 0
    };

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
        increaseSpeed();
        // Check for matches (including new square explosions)
        // Note: the returned boolean is not used here
        checkForMatches().then((found) => {
            if (found) {
                score += comboCount * 50;
            }
        });
        currentPiece = nextPiece;
        nextPiece = createPiece();
        
        if (!isValidMove(currentPiece, 0, 0)) {
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

// Helper: assign priority to match types
function getMatchPriority(type) {
    if (type === 'color') return 4;
    if (type === 'line') return 3;
    if (type === 'square') return 2;
    return 1; // normal (3 in a row)
}

async function checkForMatches() {
    let matches = findMatches();
    let chainMultiplier = 1;
    let totalClears = 0;
    let hasChainReaction = false;
    
    if (matches.length > 0 && !hasChainReaction) {
        comboCount++;
    }
    
    // Sort matches by our priority (4: color > 3: line > 2: square > 1: normal)
    matches.sort((a, b) => getMatchPriority(b.type) - getMatchPriority(a.type));
    
    while (matches.length > 0) {
        hasChainReaction = true;
        totalClears += matches.length;
        
        if (matches.length > 0) {
            comboCount++;
        }
        
        for (let match of matches) {
            if (match.type === 'square') {
                // For a square match, clear the square plus all adjacent blocks.
                let explosionPositions = getSquareExplosionPositions(match.positions);
                // Add sparkle effect for each explosion cell
                explosionPositions.forEach(pos => {
                    addSparkleEffect(pos.x * BLOCK_SIZE + BLOCK_SIZE/2, pos.y * BLOCK_SIZE + BLOCK_SIZE/2, board[pos.y][pos.x]);
                });
                createSquareExplosionAnimation(match.positions);
                explosionPositions.forEach(pos => {
                    board[pos.y][pos.x] = 0;
                });
            } else {
                // For other matches, add sparkle effects on matched blocks.
                match.positions.forEach(pos => {
                    addSparkleEffect(pos.x * BLOCK_SIZE + BLOCK_SIZE/2, pos.y * BLOCK_SIZE + BLOCK_SIZE/2, board[pos.y][pos.x]);
                });
                
                if (match.type === 'color') {
                    const colorValue = board[match.positions[0].y][match.positions[0].x];
                    match.positions = clearAllBlocksOfColor(colorValue);
                    createColorClearAnimation();
                } else if (match.type === 'line') {
                    const firstPos = match.positions[0];
                    const secondPos = match.positions[1];
                    
                    if (firstPos.y === secondPos.y) {
                        match.positions = clearRow(firstPos.y);
                        createLineClearAnimation(true);
                    } else {
                        match.positions = clearColumn(firstPos.x);
                        createLineClearAnimation(false);
                    }
                }
                
                // Clear the blocks for these matches.
                match.positions.forEach(pos => {
                    board[pos.y][pos.x] = 0;
                });
            }
            
            let baseScore = 0;
            switch (match.type) {
                case 'color':
                    baseScore = 500;
                    break;
                case 'line':
                    baseScore = 300;
                    break;
                case 'square':
                    baseScore = 200;
                    break;
                default:
                    baseScore = 100;
            }
            
            score += (baseScore * chainMultiplier) + (comboCount * 50);
        }
        
        if (totalClears > 1) {
            createComboAnimation(matches.length, totalClears);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
        
        chainMultiplier++;
        
        matches = findMatches();
        if (matches.length > 0) {
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(`Chain x${chainMultiplier}!`, canvas.width/2 - 50, canvas.height/2);
            ctx.restore();
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    if (!hasChainReaction) {
        comboCount = 0;
    }
    
    return matches.length > 0;
}

function clearAllBlocksOfColor(colorValue) {
    const positions = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === colorValue) {
                positions.push({ x, y });
                addSparkleEffect(x * BLOCK_SIZE + BLOCK_SIZE/2, 
                                   y * BLOCK_SIZE + BLOCK_SIZE/2, 
                                   board[y][x]);
            }
        }
    }
    return positions;
}

function findMatches() {
    const matches = [];
    const visited = new Set();

    const getKey = (x, y) => `${x},${y}`;
    const isVisited = (x, y) => visited.has(getKey(x, y));
    const markVisited = (x, y) => visited.add(getKey(x, y));

    // Check for horizontal matches
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS - 2; x++) {
            if (!isVisited(x, y) && board[y][x]) {
                const colorValue = board[y][x];
                let matchLength = 1;
                let currentX = x + 1;

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

    // Check for vertical matches
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS - 2; y++) {
            if (!isVisited(x, y) && board[y][x]) {
                const colorValue = board[y][x];
                let matchLength = 1;
                let currentY = y + 1;

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
    
    // NEW: Check for 2x2 square matches
    for (let y = 0; y < ROWS - 1; y++) {
        for (let x = 0; x < COLS - 1; x++) {
            const val = board[y][x];
            if (val !== 0 &&
                board[y][x+1] === val &&
                board[y+1][x] === val &&
                board[y+1][x+1] === val) {
                matches.push({
                    type: 'square',
                    positions: [
                        { x: x, y: y },
                        { x: x+1, y: y },
                        { x: x, y: y+1 },
                        { x: x+1, y: y+1 }
                    ]
                });
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

// NEW: Return all positions in the explosion area (the square and adjacent cells)
function getSquareExplosionPositions(squarePositions) {
    const positionsSet = new Set();
    squarePositions.forEach(pos => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = pos.x + dx;
                const ny = pos.y + dy;
                if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                    positionsSet.add(nx + ',' + ny);
                }
            }
        }
    });
    const positions = [];
    positionsSet.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        positions.push({ x, y });
    });
    return positions;
}

// NEW: Create an explosion animation for square matches.
function createSquareExplosionAnimation(squarePositions) {
    // Calculate the center of the square (average of positions)
    let sumX = 0, sumY = 0;
    squarePositions.forEach(pos => {
        sumX += pos.x;
        sumY += pos.y;
    });
    const centerX = (sumX / squarePositions.length) * BLOCK_SIZE + BLOCK_SIZE/2;
    const centerY = (sumY / squarePositions.length) * BLOCK_SIZE + BLOCK_SIZE/2;
    const animation = {
        x: centerX,
        y: centerY,
        text: "SQUARE EXPLOSION!",
        life: 1,
        scale: 1,
        color: '#FF4500'
    };
    activeAnimations.push(animation);
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

let lastTime = 0;
let dropCounter = 0;

function update(time) {
    if (gameOver) {
        return;
    }

    if (isPaused) {
        drawPauseScreen();
        gameLoop = requestAnimationFrame(update);
        return;
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
    if (currentPiece) {
        drawPiece(currentPiece);
    }
    
    drawPreviewPiece();
    
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
    
    updateSparkles();
    drawSparkles();
    
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`Score: ${score}`, 12, 32);
    ctx.fillStyle = 'white';
    ctx.fillText(`Score: ${score}`, 10, 30);
    
    if (comboCount > 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(`Combo x${comboCount}!`, 12, 62);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Combo x${comboCount}!`, 10, 60);
    }
    
    document.querySelector('.speed-indicator').textContent = `Speed: ${gameSpeed.toFixed(1)}x`;
}

function drawPauseScreen() {
    ctx.save();
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Pause text
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    
    // Instructions
    ctx.font = 'bold 24px Arial';
    const resumeText = wasManuallyPaused ? 'Press P to Resume' : 'Click to Resume';
    ctx.strokeText(resumeText, canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText(resumeText, canvas.width / 2, canvas.height / 2 + 50);
    
    ctx.restore();
}

function drawPreviewPiece() {
    if (!nextPiece) return;
    
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    const pieceWidth = nextPiece.shape[0].length * BLOCK_SIZE;
    const pieceHeight = nextPiece.shape.length * BLOCK_SIZE;
    
    const offsetX = (previewCanvas.width - pieceWidth) / 2;
    const offsetY = (previewCanvas.height - pieceHeight) / 2;
    
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
    
    document.addEventListener('touchmove', function(e) {
        if (e.target.closest('.d-pad')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    const buttons = dPad.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const key = this.getAttribute('data-key');
            handleKeyEvent(key);
        });
        
        button.addEventListener('touchend', function(e) {
            e.preventDefault();
        });
        
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

// Custom key repeat logic.
const keyRepeatInterval = 100; // in ms
const keysHeld = {};

document.addEventListener('keydown', event => {
    if (gameOver) return;
    
    const key = event.key;
    
    if (key.toLowerCase() === 'p') {
        isPaused = !isPaused;
        wasManuallyPaused = isPaused;
        return;
    }
    
    if (isPaused) return;
    
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(key)) {
        if (!keysHeld[key]) {
            keysHeld[key] = true;
            handleKeyEvent(key);
            keysHeld[key + '_interval'] = setInterval(() => {
                handleKeyEvent(key);
            }, keyRepeatInterval);
        }
    } else if (key === 'ArrowUp') {
        handleKeyEvent(key);
    }
});

document.addEventListener('keyup', event => {
    const key = event.key;
    if (keysHeld[key]) {
        keysHeld[key] = false;
        if (keysHeld[key + '_interval']) {
            clearInterval(keysHeld[key + '_interval']);
            delete keysHeld[key + '_interval'];
        }
    }
});

// Prevent arrow key scrolling.
window.addEventListener('keydown', function(e) {
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}, false);

function rotatePiece() {
    const oldShape = currentPiece.shape;
    const oldColors = currentPiece.colors;
    const oldX = currentPiece.x;
    const oldY = currentPiece.y;
  
    const rotatedShape = [];
    const rotatedColors = [];
    for (let i = 0; i < currentPiece.shape[0].length; i++) {
        rotatedShape.push([]);
        rotatedColors.push([]);
        for (let j = currentPiece.shape.length - 1; j >= 0; j--) {
            rotatedShape[i].push(currentPiece.shape[j][i]);
            rotatedColors[i].push(currentPiece.colors[j][i]);
        }
    }
  
    currentPiece.shape = rotatedShape;
    currentPiece.colors = rotatedColors;
  
    if (currentPiece.name === 'I') {
      if (rotatedShape.length > rotatedShape[0].length) {
        currentPiece.x = oldX + 1;
        currentPiece.y = oldY - 1;
      } else {
        currentPiece.x = oldX - 1;
        currentPiece.y = oldY + 1;
      }
    }
  
    // Check if rotation is valid, if not, try wall kicks
    if (!isValidMove(currentPiece, 0, 0)) {
      // Try to move left (for right wall collision)
      for (let offset = -1; offset >= -3; offset--) {
        if (isValidMove(currentPiece, offset, 0)) {
          currentPiece.x += offset;
          return; // Successfully applied wall kick
        }
      }
      
      // Try to move right (for left wall collision)
      for (let offset = 1; offset <= 3; offset++) {
        if (isValidMove(currentPiece, offset, 0)) {
          currentPiece.x += offset;
          return; // Successfully applied wall kick
        }
      }
      
      // Try to move up (for bottom collision)
      for (let offset = -1; offset >= -3; offset--) {
        if (isValidMove(currentPiece, 0, offset)) {
          currentPiece.y += offset;
          return; // Successfully applied wall kick
        }
      }
      
      // If all wall kicks fail, revert the rotation
      currentPiece.shape = oldShape;
      currentPiece.colors = oldColors;
      currentPiece.x = oldX;
      currentPiece.y = oldY;
      console.log('Rotation reverted – invalid move after trying wall kicks');
    }
}

let lastTimeGlobal = 0;
let dropCounterGlobal = 0;

function clearRow(y) {
    const positions = [];
    for (let x = 0; x < COLS; x++) {
        if (board[y][x] !== 0) {
            positions.push({ x, y });
            addSparkleEffect(x * BLOCK_SIZE + BLOCK_SIZE/2, y * BLOCK_SIZE + BLOCK_SIZE/2, board[y][x]);
        }
    }
    return positions;
}

function clearColumn(x) {
    const positions = [];
    for (let y = 0; y < ROWS; y++) {
        if (board[y][x] !== 0) {
            positions.push({ x, y });
            addSparkleEffect(x * BLOCK_SIZE + BLOCK_SIZE/2, y * BLOCK_SIZE + BLOCK_SIZE/2, board[y][x]);
        }
    }
    return positions;
}

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

// Handle visibility change (tab/window focus)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !gameOver) {
        isPaused = true;
        wasManuallyPaused = false;
    }
});

// Handle canvas click to resume when auto-paused
canvas.addEventListener('click', () => {
    if (isPaused && !wasManuallyPaused && !gameOver) {
        isPaused = false;
    }
});

// Handle blur event for when window loses focus
window.addEventListener('blur', () => {
    if (!gameOver) {
        isPaused = true;
        wasManuallyPaused = false;
    }
});

loadLeaderboard();
startNewGame();
gameLoop = requestAnimationFrame(update);
