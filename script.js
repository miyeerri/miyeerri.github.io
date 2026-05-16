/**
 * STRAWBERRY WHIMSY - CORE ENGINE
 * Fixed: Loading Screen Failsafe & Asset Management
 */

const IMAGE_URLS = {
    player: "https://i.imgur.com/96Wa6H8.png",
    momo: "https://i.imgur.com/Rrb8puu.png",
    pippin: "https://i.imgur.com/9V9ajUi.png",
    sunny: "https://i.imgur.com/G7Ynpp0.png",
    minty: "https://i.imgur.com/6pEJphN.png",
    house: "https://i.imgur.com/VGMpLp8.png",
    berry: "https://i.imgur.com/hRGRObU.png",
    bigBerry: "https://i.imgur.com/tPoPo2H.png"
};

const ROLES = {
    momo: "Bunny,somehow like regina from mean girls.",
    pippin: "Rat, is jealous of minty and wants to be like the rat from ratatouille.",
    sunny: "Dog? Strawberry? Do not eat.",
    minty: "Rabbit, the animal version of magda gessler."
};

const DIALOGUES = {
    momo: ["Momo: oh who is you..", "Momo: Nvm lets just go get the gift.."],
    pippin: ["Pippin: happy birthday dude", "lets go find the gift dude, i hate minty btw."],
    sunny: ["Sunny: happy birthday girl!!", "Sunny: collect the berries and you will get a little something *noticing*."],
    minty: ["Minty: i made you cake broski, happy bday", "Minty: ill give it to you later, now collect the berries bro"]
};

// Global State
let canvas, ctx, player;
const worldSize = 3000;
const images = {};
const keys = {};
let followers = [], berries = [], houses = [], npcs = [];
let activeDiag = null, diagIdx = 0, score = 0, winBerry = null, camera = {x:0, y:0};
let gameLoopId, lastTime = 0;

/**
 * FAILSAFE BOOTLOADER
 * This ensures the loading screen ALWAYS disappears
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log("System: Initialization started...");
    
    // FORCE HIDE LOADING AFTER 2 SECONDS NO MATTER WHAT
    const forceStartTrigger = setTimeout(() => {
        console.warn("System: Loading took too long. Forcing start...");
        finalizeLoading();
    }, 2000);

    const loadPromises = Object.keys(IMAGE_URLS).map(key => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = IMAGE_URLS[key];
            img.onload = () => { images[key] = img; resolve(); };
            img.onerror = () => { 
                console.error(`System: Failed to load ${key}.`);
                resolve(); // Still resolve so it doesn't freeze the loading screen!
            };
        });
    });

    Promise.all(loadPromises).then(() => {
        clearTimeout(forceStartTrigger);
        console.log("System: All assets ready.");
        finalizeLoading();
    });
});
    
    // Safety Timer: If images take too long, force start in 4 seconds
    const forceStartTrigger = setTimeout(() => {
        console.warn("System: Loading took too long. Forcing start...");
        finalizeLoading();
    }, 4000);

    const loadPromises = Object.keys(IMAGE_URLS).map(key => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Prevents some browser security hangs
            img.src = IMAGE_URLS[key];
            img.onload = () => { images[key] = img; resolve(); };
            img.onerror = () => { 
                console.error(`System: Failed to load ${key}. Skipping.`);
                resolve(); // Resolve anyway to unblock the screen
            };
        });
    });

    Promise.all(loadPromises).then(() => {
        clearTimeout(forceStartTrigger);
        console.log("System: All assets ready.");
        finalizeLoading();
    });
});

function finalizeLoading() {
    buildMenu();
    const loader = document.getElementById('loading-screen');
    const menu = document.getElementById('menu-scene');
    
    if (loader) loader.classList.add('hidden');
    if (menu) menu.classList.remove('hidden');
}

/**
 * UI & MENU LOGIC
 */
function buildMenu() {
    const grid = document.getElementById('char-grid');
    if(!grid) return;
    grid.innerHTML = "";
    Object.keys(ROLES).forEach(id => {
        grid.innerHTML += `
            <div class="char-card">
                <img src="${IMAGE_URLS[id] || ''}" alt="${id}">
                <h3>${id}</h3>
                <p>${ROLES[id]}</p>
            </div>`;
    });
}

function toggleChars(show) {
    const scene = document.getElementById('chars-scene');
    if(scene) scene.classList.toggle('hidden', !show);
}

function startGame() {
    document.getElementById('menu-scene').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    canvas = document.getElementById('gameCanvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    
    // Reset World
    resize();
    houses = []; berries = []; npcs = []; followers = [];
    score = 0; winBerry = null; activeDiag = null;
    
    document.getElementById('f-count').innerText = "0";
    document.getElementById('b-count').innerText = "0";
    
    player = { x: 1500, y: 1500, speed: 400, size: 60, history: [] };
    
    // SPAWN HOUSES (Safety Checked)
    for(let i = 0; i < 22; i++) {
        let hx, hy, overlap;
        let attempts = 0;
        do {
            overlap = false;
            hx = Math.random() * 2600 + 200;
            hy = Math.random() * 2600 + 200;
            if (hx < 1800 && hx + 200 > 1200 && hy < 1800 && hy + 180 > 1200) overlap = true;
            for (let h of houses) {
                if (hx < h.x + h.w + 50 && hx + 200 > h.x - 50 && hy < h.y + h.h + 50 && hy + 180 > h.y - 50) overlap = true;
            }
            attempts++;
        } while (overlap && attempts < 50);
        houses.push({x: hx, y: hy, w: 200, h: 180});
    }

    // SPAWN ITEMS
    const getClearSpot = (size) => {
        let x, y, hit, attempts = 0;
        do {
            hit = false;
            x = Math.random() * 2600 + 200;
            y = Math.random() * 2600 + 200;
            for (let h of houses) {
                if (x < h.x + h.w + 20 && x + size > h.x - 20 && y < h.y + h.h + 20 && y + size > h.y - 20) hit = true;
            }
            attempts++;
        } while (hit && attempts < 50);
        return {x, y};
    };

    for(let i=0; i<10; i++) {
        let pos = getClearSpot(40);
        berries.push({x: pos.x, y: pos.y, active: true, offset: Math.random()*10});
    }
    
    Object.keys(ROLES).forEach(id => {
        let pos = getClearSpot(60);
        npcs.push({id, x: pos.x, y: pos.y, active: true, offset: Math.random()*10});
    });

    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
    
    lastTime = performance.now();
    gameLoopId = requestAnimationFrame(loop);
}

/**
 * ENGINE LOOP
 */
function update(dt) {
    if(activeDiag) return;

    let dx = 0, dy = 0;
    let frameSpeed = player.speed * dt;

    if(keys['w'] || keys['arrowup']) dy -= frameSpeed;
    if(keys['s'] || keys['arrowdown']) dy += frameSpeed;
    if(keys['a'] || keys['arrowleft']) dx -= frameSpeed;
    if(keys['d'] || keys['arrowright']) dx += frameSpeed;

    if (dx !== 0 && dy !== 0) {
        let length = Math.sqrt(dx*dx + dy*dy);
        dx = (dx/length) * frameSpeed; dy = (dy/length) * frameSpeed;
    }

    const nx = player.x + dx;
    const ny = player.y + dy;

    let blocked = nx < 30 || nx > worldSize - 30 || ny < 30 || ny > worldSize - 30;
    houses.forEach(h => {
        if(nx+20 > h.x && nx-20 < h.x+h.w && ny+30 > h.y+h.h-40 && ny+10 < h.y+h.h) blocked = true;
    });

    if(!blocked) {
        player.x = nx; player.y = ny;
        if(dx !== 0 || dy !== 0) {
            player.history.unshift({x: player.x, y: player.y});
            if(player.history.length > 300) player.history.pop();
        }
    }

    camera.x = player.x - canvas.width/2;
    camera.y = player.y - canvas.height/2;

    berries.forEach(b => {
        if(b.active && Math.hypot(player.x - b.x, player.y - b.y) < 50) {
            b.active = false; score++;
            document.getElementById('b-count').innerText = score;
            checkWinState();
        }
    });

    npcs.forEach(n => {
        if(n.active && Math.hypot(player.x - n.x, player.y - n.y) < 70) {
            n.active = false;
            activeDiag = n; diagIdx = 0;
            followers.push(n);
            document.getElementById('f-count').innerText = followers.length;
            document.getElementById('diag-portrait').src = IMAGE_URLS[n.id];
            document.getElementById('diag-text').innerText = DIALOGUES[n.id][0];
            document.getElementById('dialogue-ui').classList.remove('hidden');
            checkWinState();
        }
    });

    if(winBerry && Math.hypot(player.x - winBerry.x, player.y - winBerry.y) < 100) {
        document.getElementById('end-scene').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        winBerry = null;
    }
}

function checkWinState() {
    if(score >= 10 && followers.length >= 4 && !winBerry) {
        winBerry = {x: 1500, y: 1500};
        document.getElementById('quest-alert').classList.remove('hidden');
        setTimeout(() => document.getElementById('quest-alert').classList.add('hidden'), 4000);
    }
}

function advanceDialogue() {
    if(!activeDiag) return;
    diagIdx++;
    if(diagIdx >= DIALOGUES[activeDiag.id].length) {
        activeDiag = null;
        document.getElementById('dialogue-ui').classList.add('hidden');
    } else {
        document.getElementById('diag-text').innerText = DIALOGUES[activeDiag.id][diagIdx];
    }
}

/**
 * RENDERER
 */
function draw() {
    ctx.fillStyle = "#e0f7c2"; 
    ctx.fillRect(0,0,canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Ground Pattern
    ctx.strokeStyle = "rgba(164, 208, 116, 0.4)";
    for(let i=0; i<=worldSize; i+=150) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, worldSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(worldSize, i); ctx.stroke();
    }

    const time = performance.now() / 200;

    houses.forEach(h => {
        if(images.house) ctx.drawImage(images.house, h.x, h.y, h.w, h.h);
    });

    berries.forEach(b => {
        if(b.active && images.berry) {
            ctx.drawImage(images.berry, b.x-20, b.y-20 + Math.sin(time+b.offset)*8, 40, 40);
        }
    });

    npcs.forEach(n => {
        if(n.active && images[n.id]) {
            ctx.drawImage(images[n.id], n.x-30, n.y-30 + Math.sin(time+n.offset)*5, 60, 60);
        }
    });
    
    followers.forEach((f, i) => {
        let pos = player.history[(i+1)*15] || {x: player.x, y: player.y};
        if(images[f.id]) ctx.drawImage(images[f.id], pos.x-25, pos.y-25 + Math.sin(time+i)*5, 50, 50);
    });

    if(images.player) ctx.drawImage(images.player, player.x-30, player.y-30, 60, 60);

    if(winBerry && images.bigBerry) {
        ctx.drawImage(images.bigBerry, winBerry.x-75, winBerry.y-75 + Math.sin(time)*15, 150, 150);
    }

    ctx.restore();

    // Compass
    if(winBerry && !activeDiag) {
        const angle = Math.atan2(winBerry.y - player.y, winBerry.x - player.x);
        ctx.save();
        ctx.translate(canvas.width/2, 80);
        ctx.rotate(angle);
        ctx.fillStyle = "#ff6b81";
        ctx.beginPath(); ctx.moveTo(25,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill();
        ctx.restore();
    }
}

function loop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;
    update(dt);
    draw();
    gameLoopId = requestAnimationFrame(loop);
}

function resize() {
    if(canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
