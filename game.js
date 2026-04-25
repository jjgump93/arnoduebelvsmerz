const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const beersLabel = document.getElementById('beers');
const highscoreLabel = document.getElementById('highscore');
const promilleLabel = document.getElementById('promille');
const pipiLabel = document.getElementById('pipi');
const statusLabel = document.getElementById('status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.querySelector('.overlay-inner h2');
const overlayText = document.querySelector('.overlay-inner p');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const tileSize = 32;
const mapCols = 21;
const mapRows = 15;
const maxPromille = 4.0;
const targetBeerCount = 8;
const targetWaterCount = 4;
const offsetX = 40;

const tileMap = [
    '111111111111111111111',
    '100000000000000000001',
    '100111110111011110001',
    '100000000000000000001',
    '101011111101111110101',
    '100010000100000010001',
    '111010111101111010111',
    '100000000000000000001',
    '111010111101111010111',
    '100010000100000010001',
    '101011111101111110101',
    '100000000000000000001',
    '100111110111011110001',
    '100000000000000000001',
    '111111111111111111111'
];

let player = { x: 1, y: 1, dx: 0, dy: 0, px: 1, py: 1 };
let ai = { x: 19, y: 13, dx: 0, dy: 0, px: 19, py: 13 };
let beers = new Set();
let water = new Set();
let kebab = new Set();
let vomiting = new Set();
let promille = 0.0;
let beerCount = 0;
let isGameOver = false;
let lastTime = 0;
let loadedImages = {};
let intendedDx = 0;
let intendedDy = 0;
let freezeTime = 0;
let lastPipiDecrease = 0;
let vomitStepsRemaining = 0;
let lastVomitDecrease = 0;
let pipi = 0.0;
const maxPipi = 1.0;
let gameOverReason = '';
let gameStarted = false;
let highscore = 0;
const leftToilet = { x: 1, y: 7 };
const rightToilet = { x: 19, y: 7 };

const imageSources = {
    pacman: 'assets/pacman.png',
    ai: 'assets/merz.gif',
    beer: 'assets/Asatra-Rakete.png',
    water: 'assets/water.png',
    kebab: 'assets/kebab.png',
    vomiting: 'assets/vomiting.png',
    toilet: 'assets/toilet.png',
    wall: 'assets/wall.svg',
    vomit: 'assets/vomit.png',
    drunk: 'assets/drunk.png',
    peed: 'assets/peed.png'
};

function loadImages(sources) {
    const entries = Object.entries(sources);
    let loaded = 0;
    return new Promise((resolve) => {
        entries.forEach(([key, src]) => {
            const img = new Image();
            img.onload = () => {
                loadedImages[key] = img;
                loaded += 1;
                if (loaded === entries.length) resolve();
            };
            img.src = src;
        });
    });
}

function resetGame() {
    player = { x: 1, y: 1, dx: 0, dy: 0, px: 1, py: 1 };
    ai = { x: 19, y: 13, dx: 0, dy: 0, px: 19, py: 13 };
    isGameOver = false;
    promille = 0.0;
    beerCount = 0;
    pipi = 0.0;
    beers = new Set();
    water = new Set();
    kebab = new Set();
    vomiting = new Set();
    overlay.classList.add('hidden');
    highscoreLabel.textContent = highscore.toString();
    beersLabel.textContent = beerCount.toString();
    promilleLabel.textContent = promille.toFixed(1);
    pipiLabel.textContent = pipi.toFixed(1);
    intendedDx = 0;
    intendedDy = 0;
    freezeTime = 0;
    gameOverReason = '';
    lastPipiDecrease = 0;
    vomitStepsRemaining = 0;
    lastVomitDecrease = 0;

    fillBeers();
    fillWater();
}

function showIntroScreen() {
    overlayTitle.textContent = 'Ready to start drinking?';
    overlayText.textContent = 'Drink beers, manage your Promille and Pipi, and don\'t get caught by the chansellor! Have water or even better, a Döner before you get too drunk. Use the bathroom before your bladder is too full. You can vomit if you get too drunk, but it comes at a price. Can you survive the bender?';
    const overlayImg = document.querySelector('.overlay-inner img');
    overlayImg.src = 'assets/pacman.png';
    startBtn.style.display = 'inline-block';
    restartBtn.style.display = 'none';
    overlay.classList.remove('hidden');
}

function showGameOverScreen() {
    const overlayImg = document.querySelector('.overlay-inner img');
    if (gameOverReason === 'drunk') {
        overlayImg.src = 'assets/drunk.png';
    } else if (gameOverReason === 'peed') {
        overlayImg.src = 'assets/peed.png';
    } else {
        overlayImg.src = 'assets/vomit.png'; // for caught
    }
    startBtn.style.display = 'none';
    restartBtn.style.display = 'inline-block';
    overlay.classList.remove('hidden');
}

function startGame() {
    gameStarted = true;
    overlay.classList.add('hidden');
}

function getAvailableBeerTiles() {
    const emptyTiles = [];

    for (let y = 0; y < mapRows; y += 1) {
        for (let x = 0; x < mapCols; x += 1) {
            const tile = tileMap[y][x];
            const key = `${x},${y}`;
            if (tile !== '1' && !beers.has(key) && !water.has(key) && !kebab.has(key) && !vomiting.has(key) && !(x === player.x && y === player.y) && !(x === ai.x && y === ai.y) && !(x === leftToilet.x && y === leftToilet.y) && !(x === rightToilet.x && y === rightToilet.y)) {
                emptyTiles.push({ x, y });
            }
        }
    }

    return emptyTiles;
}

function spawnBeer() {
    const emptyTiles = getAvailableBeerTiles();
    if (emptyTiles.length === 0) return;
    const next = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    beers.add(`${next.x},${next.y}`);
}

function spawnWater() {
    const emptyTiles = getAvailableBeerTiles(); // reuse, but avoid beers and water
    const available = emptyTiles.filter(tile => !water.has(`${tile.x},${tile.y}`) && !kebab.has(`${tile.x},${tile.y}`));
    if (available.length === 0) return;
    const next = available[Math.floor(Math.random() * available.length)];
    water.add(`${next.x},${next.y}`);
}

function spawnKebab() {
    if (kebab.size > 0) return;
    const emptyTiles = getAvailableBeerTiles();
    const available = emptyTiles.filter(tile => !kebab.has(`${tile.x},${tile.y}`));
    if (available.length === 0) return;
    const next = available[Math.floor(Math.random() * available.length)];
    kebab.add(`${next.x},${next.y}`);
}

function spawnVomiting() {
    if (vomiting.size > 0) return;
    const emptyTiles = getAvailableBeerTiles();
    const available = emptyTiles.filter(tile => !vomiting.has(`${tile.x},${tile.y}`));
    if (available.length === 0) return;
    const next = available[Math.floor(Math.random() * available.length)];
    vomiting.add(`${next.x},${next.y}`);
}

function fillBeers() {
    while (beers.size < targetBeerCount) {
        spawnBeer();
    }
}

function fillWater() {
    while (water.size < targetWaterCount) {
        spawnWater();
    }
}

function canMove(x, y) {
    if (x < 0 || x >= mapCols || y < 0 || y >= mapRows) return false;
    return tileMap[y][x] !== '1';
}

function eatItem(x, y) {
    const key = `${x},${y}`;
    if (beers.has(key)) {
        beers.delete(key);
        promille += 0.3;
        pipi += 0.1;
        beerCount += 1;
        beersLabel.textContent = beerCount.toString();
        promilleLabel.textContent = promille.toFixed(1);
        pipiLabel.textContent = pipi.toFixed(1);
        if (Math.random() < 0.2) { // 20% chance to spawn kebab
            spawnKebab();
        }
        if (Math.random() < 0.1) { // 10% chance to spawn vomiting
            spawnVomiting();
        }
        if (promille >= maxPromille || pipi >= maxPipi) {
            if (promille >= maxPromille) gameOverReason = 'drunk';
            else gameOverReason = 'peed';
            triggerGameOver();
        } else {
            fillBeers();
        }
    } else if (water.has(key)) {
        water.delete(key);
        promille = Math.max(0, promille - 0.1);
        promilleLabel.textContent = promille.toFixed(1);
        fillWater();
    } else if (kebab.has(key)) {
        kebab.delete(key);
        promille = Math.max(0, promille - 0.5);
        promilleLabel.textContent = promille.toFixed(1);
    } else if (vomiting.has(key)) {
        vomiting.delete(key);
        vomitStepsRemaining = Math.round(Math.min(promille, 1.0) * 10);
        lastVomitDecrease = performance.now();
    }
}

function triggerGameOver() {
    isGameOver = true;
    player.dx = 0;
    player.dy = 0;
    ai.dx = 0;
    ai.dy = 0;
    let newHighscore = false;
    if (beerCount > highscore) {
        highscore = beerCount;
        localStorage.setItem('highscore', highscore);
        highscoreLabel.textContent = highscore.toString();
        newHighscore = true;
    }
    if (gameOverReason === 'drunk') {
        overlayTitle.textContent = 'Wasted!';
        overlayText.innerHTML = `Dude, your promille level was too high! Try to get a water, a kebab, or a vomiting spot!<br><br>You had ${beerCount} beers!${newHighscore ? '<br>New highscore!' : ''}`;
    } else if (gameOverReason === 'peed') {
        overlayTitle.textContent = 'You peed yourself! How discusting!';
        overlayText.innerHTML = `Try to use the bathroom before your pipi level goes above 1.0L!<br><br>You had ${beerCount} beers!${newHighscore ? '<br>New highscore!' : ''}`;
    } else {
        overlayTitle.textContent = '"Get back to work, Germany needs you, you lazy cunt!"';
        overlayText.innerHTML = `You had ${beerCount} beers!${newHighscore ? '<br>New highscore!' : ''}`;
    }
    showGameOverScreen();
}

function update(delta) {
    if (!gameStarted || isGameOver) return;
    const speed = 6;
    // Apply impairment based on promille
    const impairment = Math.min(promille / 4.0, 1.0);
    if (Math.random() < impairment * 0.4) { // up to 40% chance at max promille
        const dirs = [
            { dx: 0, dy: -1 }, // up
            { dx: 0, dy: 1 }, // down
            { dx: -1, dy: 0 }, // left
            { dx: 1, dy: 0 }, // right
            { dx: 0, dy: 0 } // stop
        ];
        const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
        player.dx = randomDir.dx;
        player.dy = randomDir.dy;
    } else {
        player.dx = intendedDx;
        player.dy = intendedDy;
    }

    // Freeze check
    const currentTime = performance.now();
    if (currentTime < freezeTime) {
        player.dx = 0;
        player.dy = 0;
    }

    // Gradual vomiting: reduce promille 0.1 per 0.1s, freeze player throughout
    if (vomitStepsRemaining > 0) {
        if (currentTime - lastVomitDecrease >= 100) {
            promille = Math.max(0, promille - 0.1);
            vomitStepsRemaining -= 1;
            promilleLabel.textContent = promille.toFixed(1);
            lastVomitDecrease = currentTime;
        }
        player.dx = 0;
        player.dy = 0;
    }

    player.px += player.dx * speed * delta;
    player.py += player.dy * speed * delta;

    if (player.dx !== 0 || player.dy !== 0) {
        const targetX = Math.round(player.px);
        const targetY = Math.round(player.py);

        if (canMove(targetX, targetY)) {
            player.x = targetX;
            player.y = targetY;
        } else {
            player.px = player.x;
            player.py = player.y;
        }
    }

    eatItem(player.x, player.y);

    // Check toilet
    if ((player.x === leftToilet.x && player.y === leftToilet.y) || (player.x === rightToilet.x && player.y === rightToilet.y)) {
        const currentTime = performance.now();
        if (currentTime - lastPipiDecrease >= 100) { // 100ms = 0.1s
            pipi = Math.max(0, pipi - 0.1);
            pipiLabel.textContent = pipi.toFixed(1);
            lastPipiDecrease = currentTime;
        }
    }

    // AI movement
    updateAI(delta);

    // Check collision
    if (ai.x === player.x && ai.y === player.y) {
        gameOverReason = 'caught';
        triggerGameOver();
    }
}

function getNextMove(startX, startY, targetX, targetY) {
    const open = [{ x: startX, y: startY, g: 0, h: Math.abs(startX - targetX) + Math.abs(startY - targetY), f: 0, parent: null }];
    const closed = new Set();

    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const current = open.shift();

        if (current.x === targetX && current.y === targetY) {
            // Reconstruct path to get next move
            let node = current;
            while (node.parent && node.parent.parent) {
                node = node.parent;
            }
            return { dx: node.x - startX, dy: node.y - startY };
        }

        closed.add(`${current.x},${current.y}`);

        const neighbors = [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 }
        ];

        for (const n of neighbors) {
            if (!canMove(n.x, n.y) || closed.has(`${n.x},${n.y}`)) continue;

            const g = current.g + 1;
            const h = Math.abs(n.x - targetX) + Math.abs(n.y - targetY);
            const f = g + h;

            const existing = open.find(o => o.x === n.x && o.y === n.y);
            if (!existing || g < existing.g) {
                if (existing) {
                    existing.g = g;
                    existing.f = f;
                    existing.parent = current;
                } else {
                    open.push({ x: n.x, y: n.y, g, h, f, parent: current });
                }
            }
        }
    }

    return { dx: 0, dy: 0 }; // No path found
}

function updateAI(delta) {
    const speed = 3;

    const nextMove = getNextMove(ai.x, ai.y, player.x, player.y);
    ai.dx = nextMove.dx;
    ai.dy = nextMove.dy;

    ai.px += ai.dx * speed * delta;
    ai.py += ai.dy * speed * delta;

    if (ai.dx !== 0 || ai.dy !== 0) {
        const targetX = Math.round(ai.px);
        const targetY = Math.round(ai.py);

        if (canMove(targetX, targetY)) {
            ai.x = targetX;
            ai.y = targetY;
        } else {
            ai.px = ai.x;
            ai.py = ai.y;
        }
    }
}


function drawTile(x, y, img) {
    ctx.drawImage(img, x * tileSize + offsetX, y * tileSize, tileSize, tileSize);
}

function draw() {
    // Bar-themed background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#2a1f1a');
    gradient.addColorStop(1, '#1a1410');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < mapRows; y += 1) {
        for (let x = 0; x < mapCols; x += 1) {
            const char = tileMap[y][x];
            if (char === '1') {
                drawTile(x, y, loadedImages.wall);
            } else {
                // Wooden bar floor with subtle variation
                const woodColor = (x + y) % 2 === 0 ? '#3d2f28' : '#4a3b33';
                ctx.fillStyle = woodColor;
                ctx.fillRect(x * tileSize + offsetX, y * tileSize, tileSize, tileSize);
                // Add subtle grid lines for bar aesthetic
                ctx.strokeStyle = '#2a1f1a';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x * tileSize + offsetX, y * tileSize, tileSize, tileSize);
            }

            if (beers.has(`${x},${y}`)) {
                drawTile(x, y, loadedImages.beer);
            }

            if (water.has(`${x},${y}`)) {
                drawTile(x, y, loadedImages.water);
            }

            if (kebab.has(`${x},${y}`)) {
                drawTile(x, y, loadedImages.kebab);
            }

            if (vomiting.has(`${x},${y}`)) {
                const scale = 1.2;
                const size = tileSize * scale;
                const offset = (tileSize - size) / 2;
                ctx.drawImage(
                    loadedImages.vomiting,
                    x * tileSize + offset + offsetX,
                    y * tileSize + offset,
                    size,
                    size
                );
            }

            if ((x === leftToilet.x && y === leftToilet.y) || (x === rightToilet.x && y === rightToilet.y)) {
                drawTile(x, y, loadedImages.toilet);
            }
        }
    }

    const angle = performance.now() / 120;
    ctx.save();
    const centerX = (player.px + 0.5) * tileSize + offsetX;
    const centerY = (player.py + 0.5) * tileSize;
    ctx.translate(centerX, centerY);
    ctx.rotate(angle * 0.08);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(
        loadedImages.pacman,
        player.px * tileSize + offsetX,
        player.py * tileSize,
        tileSize,
        tileSize
    );
    ctx.restore();

    // Draw AI
    ctx.save();
    ctx.drawImage(
        loadedImages.ai,
        ai.px * tileSize + offsetX,
        ai.py * tileSize,
        tileSize,
        tileSize
    );
    ctx.restore();

    // Draw promille scale
    const promilleScaleX = 0;
    const promilleScaleWidth = 40;
    const promilleScaleHeight = 480;
    // Background (bar wood color)
    ctx.fillStyle = '#2a1f1a';
    ctx.fillRect(promilleScaleX, 0, promilleScaleWidth, promilleScaleHeight);
    // Border
    ctx.strokeStyle = '#8b6f47';
    ctx.lineWidth = 2;
    ctx.strokeRect(promilleScaleX, 0, promilleScaleWidth, promilleScaleHeight);
    // Fill
    const promilleFillHeight = (promille / maxPromille) * promilleScaleHeight;
    ctx.fillStyle = '#ff4444'; // Red for alcohol
    ctx.fillRect(promilleScaleX, promilleScaleHeight - promilleFillHeight, promilleScaleWidth, promilleFillHeight);
    // Label
    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Promille', promilleScaleX + promilleScaleWidth / 2, 15);

    // Draw pipi scale
    const scaleX = 712;
    const scaleWidth = 40;
    const scaleHeight = 480;
    // Background (bar wood color)
    ctx.fillStyle = '#2a1f1a';
    ctx.fillRect(scaleX, 0, scaleWidth, scaleHeight);
    // Border
    ctx.strokeStyle = '#8b6f47';
    ctx.lineWidth = 2;
    ctx.strokeRect(scaleX, 0, scaleWidth, scaleHeight);
    // Fill
    const fillHeight = (pipi / maxPipi) * scaleHeight;
    ctx.fillStyle = '#ffdd44'; // Brighter yellow for urine
    ctx.fillRect(scaleX, scaleHeight - fillHeight, scaleWidth, fillHeight);
    // Label
    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pipi', scaleX + scaleWidth / 2, 15);

    if (isGameOver) {
        ctx.fillStyle = 'rgba(1, 2, 8, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffe463';
        ctx.font = '24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Too many beers! Time to vomit.', (offsetX + 336), canvas.height / 2 - 14);
    }
}

function loop(timestamp) {
    const delta = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(delta);
    draw();

    requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
    if (isGameOver) return;
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
    }

    if (key === 'arrowup' || key === 'w') {
        intendedDx = 0;
        intendedDy = -1;
    } else if (key === 'arrowdown' || key === 's') {
        intendedDx = 0;
        intendedDy = 1;
    } else if (key === 'arrowleft' || key === 'a') {
        intendedDx = -1;
        intendedDy = 0;
    } else if (key === 'arrowright' || key === 'd') {
        intendedDx = 1;
        intendedDy = 0;
    }
});

restartBtn.addEventListener('click', () => {
    resetGame();
    startGame();
});

startBtn.addEventListener('click', () => {
    resetGame();
    startGame();
});

loadImages(imageSources).then(() => {
    highscore = parseInt(localStorage.getItem('highscore')) || 0;
    highscoreLabel.textContent = highscore.toString();
    resetGame();
    showIntroScreen();
    requestAnimationFrame(loop);
});