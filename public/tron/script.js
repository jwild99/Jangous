// ============================
// CONFIGURATION & CONSTANTS
// ============================

const CONFIG = {
  // Grid settings
  gridWidth: 80,
  gridHeight: 60,
  cellSize: 10,
  
  // Game speed (lower = faster)
  gameSpeed: 80,
  
  // Colors - more realistic neon
  playerColor: '#00e5ff',
  playerColorRGB: { r: 0, g: 229, b: 255 },
  playerGlowColor: 'rgba(0, 229, 255, 0.8)',
  aiColor: '#ff3d3d',
  aiColorRGB: { r: 255, g: 61, b: 61 },
  aiGlowColor: 'rgba(255, 61, 61, 0.8)',
  trailGlow: 25,
  
  // AI settings
  aiLookAhead: 5,
  aiRandomness: 0.1,
  
  // Power-up settings
  powerUpSpawnInterval: 3000,
  powerUpChance: 0.7,
  speedBoostDuration: 3000,
  speedBoostMultiplier: 0.6,
  widerTrailDuration: 5000,
  widerTrailSize: 2,
  
  // Visual effects
  trailFadeLength: 60,
  particleCount: 25,
  cycleSize: 1.5,
  motionBlurAlpha: 0.75,
};

// Power-up types
const POWERUP_TYPES = {
  SPEED_BOOST: {
    name: 'Speed Boost',
    color: '#ffdd00',
    glowColor: 'rgba(255, 221, 0, 0.6)',
    symbol: '\u26A1',
    fontSize: 14
  },
  WIDER_TRAIL: {
    name: 'Wider Trail',
    color: '#00ff66',
    glowColor: 'rgba(0, 255, 102, 0.6)',
    symbol: '\u25A0',
    fontSize: 12
  }
};

// ============================
// GAME STATE
// ============================

let canvas, ctx;
let gameLoop;
let powerUpSpawnTimer;
let gameState = 'menu';
let frameCount = 0;

let playerScore = 0;
let aiScore = 0;

// Particles for effects
let particles = [];

// Light trails history for glow effect
let trailHistory = [];

// Player cycle
let player = {
  x: 20,
  y: 30,
  dx: 1,
  dy: 0,
  trail: [],
  color: CONFIG.playerColor,
  colorRGB: CONFIG.playerColorRGB,
  glowColor: CONFIG.playerGlowColor,
  alive: true,
  speedBoost: false,
  speedBoostTimeout: null,
  widerTrail: false,
  widerTrailTimeout: null
};

// AI cycle
let ai = {
  x: 60,
  y: 30,
  dx: -1,
  dy: 0,
  trail: [],
  color: CONFIG.aiColor,
  colorRGB: CONFIG.aiColorRGB,
  glowColor: CONFIG.aiGlowColor,
  alive: true,
  speedBoost: false,
  speedBoostTimeout: null,
  widerTrail: false,
  widerTrailTimeout: null
};

// Grid to track occupied cells
let grid = [];

// Active power-ups on the grid
let powerUps = [];

// ============================
// INITIALIZATION
// ============================

document.addEventListener('DOMContentLoaded', init);

function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = CONFIG.gridWidth * CONFIG.cellSize;
  canvas.height = CONFIG.gridHeight * CONFIG.cellSize;
  
  // Initialize grid
  resetGrid();
  
  // Event listeners
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', startGame);
  document.getElementById('menuBtn').addEventListener('click', showMenu);
  
  // Keyboard controls
  document.addEventListener('keydown', handleKeyPress);
  
  // Mobile controls
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleMobileControl(btn.dataset.key);
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleMobileControl(btn.dataset.key);
    });
  });
  
  // Update score display
  updateScoreDisplay();
  
  // Draw idle animation
  requestAnimationFrame(drawIdleCanvas);
}

function drawIdleCanvas() {
  if (gameState !== 'menu') return;
  
  frameCount++;
  
  // Clear with dark background
  ctx.fillStyle = 'rgba(0, 8, 12, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw animated perspective grid
  drawPerspectiveGrid();
  
  // Add some ambient particles
  if (frameCount % 10 === 0 && particles.length < 30) {
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 1 - 0.5,
      life: 1,
      decay: 0.005,
      size: Math.random() * 2 + 1,
      color: CONFIG.playerColorRGB
    });
  }
  
  updateParticles();
  drawParticles();
  
  requestAnimationFrame(drawIdleCanvas);
}

function drawPerspectiveGrid() {
  const time = Date.now() / 1000;
  const centerX = canvas.width / 2;
  const horizon = canvas.height * 0.3;
  
  // Vertical lines converging to horizon
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  
  for (let i = -20; i <= 20; i++) {
    const x = centerX + i * 50;
    const perspectiveX = centerX + (x - centerX) * 0.1;
    
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(perspectiveX, horizon);
    ctx.stroke();
  }
  
  // Horizontal lines with perspective
  for (let i = 0; i < 15; i++) {
    const y = horizon + Math.pow(i / 15, 2) * (canvas.height - horizon);
    const scale = (y - horizon) / (canvas.height - horizon);
    const alpha = 0.03 + scale * 0.08;
    
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Horizon glow
  const gradient = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 20);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.15)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizon - 20, canvas.width, 40);
}

// ============================
// SCREEN MANAGEMENT
// ============================

function showMenu() {
  gameState = 'menu';
  stopGame();
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.add('hidden');
  updateScoreDisplay();
  requestAnimationFrame(drawIdleCanvas);
}

function showGame() {
  gameState = 'playing';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');
  document.getElementById('gameOverScreen').classList.add('hidden');
  updatePowerUpIndicators();
}

function showGameOver(winner) {
  gameState = 'gameOver';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.remove('hidden');
  
  const titleEl = document.getElementById('winnerText');
  const msgEl = document.getElementById('gameOverMessage');
  
  if (winner === 'player') {
    titleEl.textContent = 'VICTORY';
    titleEl.className = 'title game-over-title winner';
    msgEl.textContent = 'Program derezzed successfully';
    msgEl.style.color = '#0f0';
  } else {
    titleEl.textContent = 'DEREZZED';
    titleEl.className = 'title game-over-title loser';
    msgEl.textContent = 'User cycle terminated';
    msgEl.style.color = '#f44';
  }
}

// ============================
// GAME LOGIC
// ============================

function startGame() {
  resetGrid();
  particles = [];
  trailHistory = [];
  frameCount = 0;
  
  // Reset player
  player.x = 20;
  player.y = 30;
  player.dx = 1;
  player.dy = 0;
  player.trail = [[20, 30]];
  player.alive = true;
  player.speedBoost = false;
  player.widerTrail = false;
  if (player.speedBoostTimeout) clearTimeout(player.speedBoostTimeout);
  if (player.widerTrailTimeout) clearTimeout(player.widerTrailTimeout);
  
  // Reset AI
  ai.x = 60;
  ai.y = 30;
  ai.dx = -1;
  ai.dy = 0;
  ai.trail = [[60, 30]];
  ai.alive = true;
  ai.speedBoost = false;
  ai.widerTrail = false;
  if (ai.speedBoostTimeout) clearTimeout(ai.speedBoostTimeout);
  if (ai.widerTrailTimeout) clearTimeout(ai.widerTrailTimeout);
  
  // Reset power-ups
  powerUps = [];
  
  // Mark starting positions
  grid[player.y][player.x] = 'player';
  grid[ai.y][ai.x] = 'ai';
  
  // Start game
  showGame();
  stopGame();
  
  // Determine game speed
  const currentSpeed = player.speedBoost ? 
    CONFIG.gameSpeed * CONFIG.speedBoostMultiplier : CONFIG.gameSpeed;
  gameLoop = setInterval(update, currentSpeed);
  
  // Start power-up spawning
  powerUpSpawnTimer = setInterval(spawnPowerUp, CONFIG.powerUpSpawnInterval);
}

function stopGame() {
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  if (powerUpSpawnTimer) {
    clearInterval(powerUpSpawnTimer);
    powerUpSpawnTimer = null;
  }
}

function update() {
  if (gameState !== 'playing') return;
  
  frameCount++;
  
  // Move player
  movePlayer();
  
  // Move AI
  moveAI();
  
  // Check collisions
  checkCollisions();
  
  // Check power-up collection
  checkPowerUpCollection();
  
  // Update particles
  updateParticles();
  
  // Render
  render();
  
  // Update power-up indicators
  updatePowerUpIndicators();
  
  // Check for game over
  if (!player.alive || !ai.alive) {
    stopGame();
    
    // Create explosion particles
    if (!player.alive) {
      createExplosion(player.x, player.y, player.colorRGB);
    }
    if (!ai.alive) {
      createExplosion(ai.x, ai.y, ai.colorRGB);
    }
    
    // Update scores
    if (player.alive && !ai.alive) {
      playerScore++;
    } else if (!player.alive && ai.alive) {
      aiScore++;
    }
    
    updateScoreDisplay();
    
    // Continue rendering for explosion effect
    let explosionFrames = 40;
    const explosionLoop = setInterval(() => {
      updateParticles();
      render();
      explosionFrames--;
      if (explosionFrames <= 0) {
        clearInterval(explosionLoop);
        if (player.alive) {
          showGameOver('player');
        } else {
          showGameOver('ai');
        }
      }
    }, 25);
  }
}

function movePlayer() {
  if (!player.alive) return;
  
  player.x += player.dx;
  player.y += player.dy;
  
  if (!isInBounds(player.x, player.y) || grid[player.y][player.x]) {
    player.alive = false;
    return;
  }
  
  player.trail.push([player.x, player.y]);
  markTrailOnGrid(player.x, player.y, 'player', player.widerTrail);
  
  // Create trail particles
  if (Math.random() < 0.4) {
    createTrailParticle(player.x, player.y, player.colorRGB);
  }
}

function moveAI() {
  if (!ai.alive) return;
  
  decideAIMove();
  
  ai.x += ai.dx;
  ai.y += ai.dy;
  
  if (!isInBounds(ai.x, ai.y) || grid[ai.y][ai.x]) {
    ai.alive = false;
    return;
  }
  
  ai.trail.push([ai.x, ai.y]);
  markTrailOnGrid(ai.x, ai.y, 'ai', ai.widerTrail);
  
  if (Math.random() < 0.4) {
    createTrailParticle(ai.x, ai.y, ai.colorRGB);
  }
}

function markTrailOnGrid(x, y, owner, wide) {
  grid[y][x] = owner;
  
  if (wide) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const newX = x + dx;
        const newY = y + dy;
        if (isInBounds(newX, newY) && !grid[newY][newX]) {
          grid[newY][newX] = owner;
        }
      }
    }
  }
}

function checkCollisions() {
  // Handled in move functions
}

// ============================
// POWER-UP SYSTEM
// ============================

function spawnPowerUp() {
  if (gameState !== 'playing') return;
  
  if (Math.random() > CONFIG.powerUpChance) return;
  
  let attempts = 0;
  let x, y;
  
  while (attempts < 50) {
    x = Math.floor(Math.random() * CONFIG.gridWidth);
    y = Math.floor(Math.random() * CONFIG.gridHeight);
    
    const distToPlayer = Math.abs(x - player.x) + Math.abs(y - player.y);
    const distToAI = Math.abs(x - ai.x) + Math.abs(y - ai.y);
    
    if (!grid[y][x] && distToPlayer > 5 && distToAI > 5) {
      break;
    }
    attempts++;
  }
  
  if (attempts >= 50) return;
  
  const types = Object.keys(POWERUP_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  
  powerUps.push({
    x,
    y,
    type,
    config: POWERUP_TYPES[type],
    spawnTime: Date.now()
  });
}

function checkPowerUpCollection() {
  powerUps = powerUps.filter(powerUp => {
    if (player.alive && player.x === powerUp.x && player.y === powerUp.y) {
      applyPowerUp(player, powerUp.type);
      createPowerUpCollectEffect(powerUp.x, powerUp.y, powerUp.config.color);
      return false;
    }
    
    if (ai.alive && ai.x === powerUp.x && ai.y === powerUp.y) {
      applyPowerUp(ai, powerUp.type);
      createPowerUpCollectEffect(powerUp.x, powerUp.y, powerUp.config.color);
      return false;
    }
    
    return true;
  });
}

function applyPowerUp(cycle, type) {
  if (type === 'SPEED_BOOST') {
    cycle.speedBoost = true;
    
    if (cycle.speedBoostTimeout) {
      clearTimeout(cycle.speedBoostTimeout);
    }
    
    cycle.speedBoostTimeout = setTimeout(() => {
      cycle.speedBoost = false;
      cycle.speedBoostTimeout = null;
      
      if (cycle === player && gameState === 'playing') {
        stopGame();
        const currentSpeed = CONFIG.gameSpeed;
        gameLoop = setInterval(update, currentSpeed);
      }
    }, CONFIG.speedBoostDuration);
    
    if (cycle === player && gameState === 'playing') {
      stopGame();
      powerUpSpawnTimer = setInterval(spawnPowerUp, CONFIG.powerUpSpawnInterval);
      const currentSpeed = CONFIG.gameSpeed * CONFIG.speedBoostMultiplier;
      gameLoop = setInterval(update, currentSpeed);
    }
  } else if (type === 'WIDER_TRAIL') {
    cycle.widerTrail = true;
    
    if (cycle.widerTrailTimeout) {
      clearTimeout(cycle.widerTrailTimeout);
    }
    
    cycle.widerTrailTimeout = setTimeout(() => {
      cycle.widerTrail = false;
      cycle.widerTrailTimeout = null;
    }, CONFIG.widerTrailDuration);
  }
}

function updatePowerUpIndicators() {
  const speedIndicator = document.getElementById('speedIndicator');
  const trailIndicator = document.getElementById('trailIndicator');
  
  if (speedIndicator) {
    speedIndicator.classList.toggle('active', player.speedBoost);
  }
  if (trailIndicator) {
    trailIndicator.classList.toggle('active', player.widerTrail);
  }
}

// ============================
// AI LOGIC
// ============================

function decideAIMove() {
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];
  
  const oppositeDir = directions.findIndex(d => 
    d.dx === -ai.dx && d.dy === -ai.dy
  );
  directions.splice(oppositeDir, 1);
  
  const currentDir = { dx: ai.dx, dy: ai.dy };
  if (isDirectionSafe(ai.x, ai.y, currentDir, CONFIG.aiLookAhead)) {
    if (Math.random() > CONFIG.aiRandomness) {
      return;
    }
  }
  
  const safeDirections = directions.filter(dir => 
    isDirectionSafe(ai.x, ai.y, dir, CONFIG.aiLookAhead)
  );
  
  if (safeDirections.length > 0) {
    const chosen = safeDirections[Math.floor(Math.random() * safeDirections.length)];
    ai.dx = chosen.dx;
    ai.dy = chosen.dy;
  } else {
    const anyDirection = directions[Math.floor(Math.random() * directions.length)];
    ai.dx = anyDirection.dx;
    ai.dy = anyDirection.dy;
  }
}

function isDirectionSafe(x, y, dir, steps) {
  for (let i = 1; i <= steps; i++) {
    const checkX = x + dir.dx * i;
    const checkY = y + dir.dy * i;
    
    if (!isInBounds(checkX, checkY) || grid[checkY][checkX]) {
      return false;
    }
  }
  return true;
}

// ============================
// INPUT HANDLING
// ============================

function handleKeyPress(e) {
  if (gameState !== 'playing') return;
  
  const key = e.key.toLowerCase();
  
  if ((key === 'w' || key === 'arrowup') && player.dy === 0) {
    player.dx = 0;
    player.dy = -1;
  } else if ((key === 's' || key === 'arrowdown') && player.dy === 0) {
    player.dx = 0;
    player.dy = 1;
  } else if ((key === 'a' || key === 'arrowleft') && player.dx === 0) {
    player.dx = -1;
    player.dy = 0;
  } else if ((key === 'd' || key === 'arrowright') && player.dx === 0) {
    player.dx = 1;
    player.dy = 0;
  }
}

function handleMobileControl(direction) {
  if (gameState !== 'playing') return;
  
  if (direction === 'up' && player.dy === 0) {
    player.dx = 0;
    player.dy = -1;
  } else if (direction === 'down' && player.dy === 0) {
    player.dx = 0;
    player.dy = 1;
  } else if (direction === 'left' && player.dx === 0) {
    player.dx = -1;
    player.dy = 0;
  } else if (direction === 'right' && player.dx === 0) {
    player.dx = 1;
    player.dy = 0;
  }
}

// ============================
// PARTICLE SYSTEM
// ============================

function createTrailParticle(x, y, colorRGB) {
  particles.push({
    x: x * CONFIG.cellSize + CONFIG.cellSize / 2,
    y: y * CONFIG.cellSize + CONFIG.cellSize / 2,
    vx: (Math.random() - 0.5) * 2.5,
    vy: (Math.random() - 0.5) * 2.5,
    life: 1,
    decay: 0.04,
    size: Math.random() * 3 + 1.5,
    color: colorRGB
  });
}

function createExplosion(x, y, colorRGB) {
  for (let i = 0; i < CONFIG.particleCount; i++) {
    const angle = (Math.PI * 2 / CONFIG.particleCount) * i + Math.random() * 0.3;
    const speed = Math.random() * 6 + 3;
    particles.push({
      x: x * CONFIG.cellSize + CONFIG.cellSize / 2,
      y: y * CONFIG.cellSize + CONFIG.cellSize / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.015,
      size: Math.random() * 8 + 4,
      color: colorRGB
    });
  }
  
  // Add white flash particles
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    particles.push({
      x: x * CONFIG.cellSize + CONFIG.cellSize / 2,
      y: y * CONFIG.cellSize + CONFIG.cellSize / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03,
      size: Math.random() * 4 + 2,
      color: { r: 255, g: 255, b: 255 }
    });
  }
}

function createPowerUpCollectEffect(x, y, color) {
  const rgb = hexToRGB(color);
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    particles.push({
      x: x * CONFIG.cellSize + CONFIG.cellSize / 2,
      y: y * CONFIG.cellSize + CONFIG.cellSize / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03,
      size: Math.random() * 5 + 2,
      color: rgb
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.vx *= 0.97;
    p.vy *= 0.97;
    return p.life > 0;
  });
}

function hexToRGB(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

// ============================
// RENDERING
// ============================

function render() {
  // Motion blur effect - fade previous frame
  ctx.fillStyle = `rgba(0, 8, 12, ${CONFIG.motionBlurAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw subtle grid
  drawGameGrid();
  
  // Draw bloom layer (pre-glow)
  drawBloomLayer();
  
  // Draw trails with advanced effects
  drawTrailAdvanced(player);
  drawTrailAdvanced(ai);
  
  // Draw particles
  drawParticles();
  
  // Draw power-ups
  drawPowerUps();
  
  // Draw cycles (light bikes)
  drawCycleAdvanced(player);
  drawCycleAdvanced(ai);
}

function drawGameGrid() {
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  
  for (let x = 0; x <= canvas.width; x += CONFIG.cellSize * 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  for (let y = 0; y <= canvas.height; y += CONFIG.cellSize * 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawBloomLayer() {
  // Draw soft glow behind trails
  ctx.save();
  ctx.filter = 'blur(15px)';
  ctx.globalAlpha = 0.3;
  
  // Player trail bloom
  if (player.trail.length > 1) {
    ctx.fillStyle = player.glowColor;
    const recentTrail = player.trail.slice(-20);
    recentTrail.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(
        x * CONFIG.cellSize + CONFIG.cellSize / 2,
        y * CONFIG.cellSize + CONFIG.cellSize / 2,
        CONFIG.cellSize * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }
  
  // AI trail bloom
  if (ai.trail.length > 1) {
    ctx.fillStyle = ai.glowColor;
    const recentTrail = ai.trail.slice(-20);
    recentTrail.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(
        x * CONFIG.cellSize + CONFIG.cellSize / 2,
        y * CONFIG.cellSize + CONFIG.cellSize / 2,
        CONFIG.cellSize * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }
  
  ctx.restore();
}

function drawTrailAdvanced(cycle) {
  if (cycle.trail.length < 2) return;
  
  const trailLength = cycle.trail.length;
  const rgb = cycle.colorRGB;
  
  // Draw trail segments as connected light walls
  for (let i = 1; i < trailLength; i++) {
    const [x1, y1] = cycle.trail[i - 1];
    const [x2, y2] = cycle.trail[i];
    
    if (!isInBounds(x1, y1) || !isInBounds(x2, y2)) continue;
    
    // Calculate opacity based on position
    const fadeStart = Math.max(0, trailLength - CONFIG.trailFadeLength);
    let alpha = i < fadeStart ? 0.25 : 0.25 + (0.75 * (i - fadeStart) / CONFIG.trailFadeLength);
    
    if (!cycle.alive) alpha *= 0.35;
    
    const px1 = x1 * CONFIG.cellSize + CONFIG.cellSize / 2;
    const py1 = y1 * CONFIG.cellSize + CONFIG.cellSize / 2;
    const px2 = x2 * CONFIG.cellSize + CONFIG.cellSize / 2;
    const py2 = y2 * CONFIG.cellSize + CONFIG.cellSize / 2;
    
    // Draw glow
    ctx.shadowBlur = CONFIG.trailGlow * alpha;
    ctx.shadowColor = cycle.color;
    
    // Draw light wall segment
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    ctx.lineWidth = CONFIG.cellSize * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();
    
    // Draw bright core
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = CONFIG.cellSize * 0.3;
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();
  }
  
  ctx.shadowBlur = 0;
}

function drawCycleAdvanced(cycle) {
  if (!cycle.alive) return;
  
  const x = cycle.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const y = cycle.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  const size = CONFIG.cellSize * CONFIG.cycleSize;
  const rgb = cycle.colorRGB;
  
  // Calculate rotation based on direction
  const angle = Math.atan2(cycle.dy, cycle.dx);
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Draw outer glow
  ctx.shadowBlur = 35;
  ctx.shadowColor = cycle.color;
  
  // Draw light bike shape (elongated diamond)
  ctx.fillStyle = cycle.color;
  ctx.beginPath();
  ctx.moveTo(size * 0.6, 0);
  ctx.lineTo(0, -size * 0.35);
  ctx.lineTo(-size * 0.4, 0);
  ctx.lineTo(0, size * 0.35);
  ctx.closePath();
  ctx.fill();
  
  // Draw bright cockpit
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(size * 0.15, 0, size * 0.2, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw engine glow at back
  const engineGradient = ctx.createRadialGradient(-size * 0.3, 0, 0, -size * 0.3, 0, size * 0.3);
  engineGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`);
  engineGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
  engineGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = engineGradient;
  ctx.beginPath();
  ctx.arc(-size * 0.3, 0, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawParticles() {
  particles.forEach(p => {
    const alpha = p.life;
    ctx.shadowBlur = 12 * alpha;
    ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
    
    // Create gradient for particle
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * alpha);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.4, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`);
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha * 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function drawPowerUps() {
  const time = Date.now();
  
  powerUps.forEach(powerUp => {
    const x = powerUp.x * CONFIG.cellSize + CONFIG.cellSize / 2;
    const y = powerUp.y * CONFIG.cellSize + CONFIG.cellSize / 2;
    const pulse = 1 + Math.sin((time - powerUp.spawnTime) / 150) * 0.25;
    const rotation = (time - powerUp.spawnTime) / 1000;
    
    ctx.save();
    ctx.translate(x, y);
    
    // Draw pulsing glow
    ctx.shadowBlur = 30 * pulse;
    ctx.shadowColor = powerUp.config.color;
    
    // Draw rotating outer ring
    ctx.strokeStyle = powerUp.config.color;
    ctx.lineWidth = 2;
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.cellSize * 1.2 * pulse, 0, Math.PI * 1.5);
    ctx.stroke();
    
    ctx.rotate(-rotation * 2);
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.cellSize * 0.9 * pulse, 0.5, Math.PI * 1.8);
    ctx.stroke();
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(x, y);
    
    // Draw inner glow
    const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, CONFIG.cellSize * pulse);
    innerGradient.addColorStop(0, powerUp.config.color);
    innerGradient.addColorStop(0.4, powerUp.config.glowColor);
    innerGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.cellSize * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw symbol
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${powerUp.config.fontSize}px Orbitron, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerUp.config.symbol, 0, 0);
    
    ctx.restore();
    ctx.shadowBlur = 0;
  });
}

// ============================
// UTILITY FUNCTIONS
// ============================

function resetGrid() {
  grid = Array(CONFIG.gridHeight).fill(null).map(() => 
    Array(CONFIG.gridWidth).fill(null)
  );
}

function isInBounds(x, y) {
  return x >= 0 && x < CONFIG.gridWidth && y >= 0 && y < CONFIG.gridHeight;
}

function updateScoreDisplay() {
  document.getElementById('playerScore').textContent = playerScore;
  document.getElementById('aiScore').textContent = aiScore;
  document.getElementById('playerScoreLive').textContent = playerScore;
  document.getElementById('aiScoreLive').textContent = aiScore;
}
