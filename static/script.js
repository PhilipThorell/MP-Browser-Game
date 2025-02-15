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

var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

socket.on("updateClients", function(data) { // Listen for updates about all clients
    clients = data; // Update the local list of all client positions
    player = clients[socket.id];
});

function emitPlayerPosition() { // Emit position updates to the server
    socket.emit("updatePosition", {
        x: player.x,
        y: player.y,
        name: player.name,
        color: player.color,
        hp: player.hp,
        score: player.score,
        alive: player.alive
    });
}
socket.on("updateBullets", function(data) {
    bullets = data; // Update the local list of all client positions
});
function emitBulletPosition(bullet) {
    socket.emit("updateBulletPosition", bullet);
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
function calculateVelocity(bulletX, bulletY) {
    let deltaX = mouseX - bulletX;
    let deltaY = mouseY - bulletY;
    let angleRadians = Math.atan2(deltaY, deltaX);
    let vx = bulletSpeed * Math.cos(angleRadians);
    let vy = bulletSpeed * Math.sin(angleRadians);
    return { vx, vy };
}
function moveBullets() {
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
function shoot() {
    bulletX = player.x;
    bulletY = player.y;
    let velocity = calculateVelocity(bulletX, bulletY);
    return { x: bulletX, y: bulletY, vx: velocity.vx, vy: velocity.vy };
}
function gameLoop() {
    if (!gameStarted) return; // Don't run if the game hasn't started
    requestAnimationFrame(gameLoop);

    if (!player.alive) {
        socket.emit("clientPressedPlay", name);
    }

    let currentTime = Date.now();

    if (keys[" "] && currentTime - lastShootTime >= bulletCooldown) {
        newBullet = shoot();
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
    moveBullets();
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
