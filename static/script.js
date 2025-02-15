const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");


let lastShootTime = 0;
mouseX = 0;
mouseY = 0;
let gameStarted = false;

let blink = 0;

const keys = {};

let clients = {};
let bullets = {};
let powerups = {};

var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

socket.on("updateClients", function(data) { // Listen for updates about all clients
    clients = data; // Update the local list of all client positions
    player = clients[socket.id];
});
function emitPlayerPosition() { // Emit position updates to the server
    socket.emit("updatePosition", {
        x: player.x,
        y: player.y,
    });
}
socket.on("updateBullets", function(data) {
    bullets = data; // Update the local list of all client positions
});
function emitBulletPosition(bullet) {
    socket.emit("updateBulletPosition", bullet);
}
socket.on("updatePowerups", function(data) {
    powerups = data; // Update the local list of all client positions
});


function drawLeaderboard() {
    /**
     * Draws the leaderboard for the client.
     * @param {number} a - The first number.
     * @param {number} b - The second number.
     * @returns None.
     */
    y = 10;
    idx = 1;
    for (let clientId in clients) {
        const client = clients[clientId];
        if (client.alive == false) continue;

        ctx.font = "20px Arial";
        ctx.fillStyle = client.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${idx}. ${clients[clientId].name} ${clients[clientId].score}`, 10, y);
        y += 25;
        idx++;
    }
}
function drawBullets() {
    for (let clientId in bullets) {
        for (let i = 0; i < bullets[clientId].length; i++) {
            // Draw bullet
            ctx.beginPath();
            ctx.arc(bullets[clientId][i].x, bullets[clientId][i].y, bulletRadius, 0, Math.PI * 2);
            ctx.fillStyle = bulletColor;
            ctx.fill();
        }
    }
}
function drawClients() {
    for (let clientId in clients) {
        const client = clients[clientId];
        if (!client.alive) {
            continue;
        } else {
            ctx.beginPath();
            ctx.arc(client.x, client.y, playerRadius, 0, Math.PI * 2);
            ctx.fillStyle = client.color;
            ctx.fill();

            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${client.hp} HP`, client.x, client.y + playerRadius + 10);
        }
    }
}
function drawPowerups() {
    for (let powerup in powerups) {
        let x = powerups[powerup].x;
        let y = powerups[powerup].y;
        let radius = powerups[powerup].size;

        // Draw white outline
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2); // Slightly larger for outline
        ctx.fillStyle = "white";
        ctx.fill();

        // Clip the circle area so we don't draw outside of it
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();

        // Draw the first triangle (Red - Top Left)
        ctx.beginPath();
        ctx.moveTo(x - radius, y - radius); // Top-left corner
        ctx.lineTo(x + radius, y + radius); // Bottom-right corner
        ctx.lineTo(x - radius, y + radius); // Bottom-left corner
        ctx.closePath();
        ctx.fillStyle = powerups[powerup].color1;
        ctx.fill();

        // Draw the second triangle (Blue - Bottom Right)
        ctx.beginPath();
        ctx.moveTo(x - radius, y - radius); // Top-left corner
        ctx.lineTo(x + radius, y - radius); // Top-right corner
        ctx.lineTo(x + radius, y + radius); // Bottom-right corner
        ctx.closePath();
        ctx.fillStyle = powerups[powerup].color2;
        ctx.fill();

        ctx.restore(); // Restore canvas state after clipping
    }
}
function calculateVelocity(bulletX, bulletY, angle=0) {
    let deltaX = mouseX - bulletX;
    let deltaY = mouseY - bulletY;
    let angleRadians = Math.atan2(deltaY, deltaX);
    if (angle == 2) {
        angleRadians += 15 * (Math.PI / 180); // angle of the side shots == 15
    } else if (angle == 3) {
        angleRadians -= 15 * (Math.PI / 180);
    }
    let vx = bulletSpeed * Math.cos(angleRadians);
    let vy = bulletSpeed * Math.sin(angleRadians);
    return { vx, vy };
}
function shoot() {
    bulletX = player.x;
    bulletY = player.y;
    let velocity = calculateVelocity(bulletX, bulletY);
    return { x: bulletX, y: bulletY, vx: velocity.vx, vy: velocity.vy };
}
function multi_shoot() {
    bulletX = player.x;
    bulletY = player.y;
    let velocity1 = calculateVelocity(bulletX, bulletY);
    bullet1 = { x: bulletX, y: bulletY, vx: velocity1.vx, vy: velocity1.vy };

    let velocity2 = calculateVelocity(bulletX, bulletY, 2);
    bullet2 = { x: bulletX, y: bulletY, vx: velocity2.vx, vy: velocity2.vy };

    let velocity3 = calculateVelocity(bulletX, bulletY, 3);
    bullet3 = { x: bulletX, y: bulletY, vx: velocity3.vx, vy: velocity3.vy };

    return [bullet1, bullet2, bullet3];
}
function gameLoop() {
    if (!gameStarted) return; // Don't run if the game hasn't started
    requestAnimationFrame(gameLoop);

    if (!player.alive) {
        socket.emit("clientPressedPlay", name);
    }

    let currentTime = Date.now();

    console.log(player.multishot);
    console.log(player.x);

    if (keys[" "] && currentTime - lastShootTime >= bulletCooldown) {
        if (player.multishot) {
            newBullet = multi_shoot();
        } else {
            newBullet = shoot();
        }
        emitBulletPosition(newBullet); // Send the updated bullets position to the server
        lastShootTime = currentTime;
    }
    if (keys["w"]) player.y -= playerSpeed;
    if (keys["s"]) player.y += playerSpeed;
    if (keys["a"]) player.x -= playerSpeed;
    if (keys["d"]) player.x += playerSpeed;

    if (player.x - playerRadius < 0) player.x = 0 + playerRadius;
    if (player.x + playerRadius > canvas.width) player.x = canvas.width - playerRadius;
    if (player.y - playerRadius < 0) player.y = 0 + playerRadius;
    if (player.y + playerRadius > canvas.height) player.y = canvas.height - playerRadius;

    emitPlayerPosition(); // Send the updated player position to the server

    // clear canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    drawLeaderboard();
    drawPowerups();
    drawBullets();
    drawClients();
}

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});

document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

document.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
});

document.getElementById("play-button").addEventListener("click", function () {
    const inputField = document.getElementById("usernameInput");
    name = inputField.value;
    socket.emit("clientPressedPlay", name);

    // Hide the start menu
    document.getElementById("start-menu").style.display = "none";
    gameStarted = true;

    // Start the game loop
    gameLoop();
});
