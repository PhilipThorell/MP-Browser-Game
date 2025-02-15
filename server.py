from flask import Flask, render_template, request
from flask_socketio import SocketIO
import random
import math
import time


app = Flask(__name__)
socketio = SocketIO(app)

colors = ["#1E90FF", "red", "purple", "orange", "green", "pink", "cyan", "grey", "white", "brown"]
color_list = colors[:]  # makes a copy
names = ["Tom", "Bob", "Chewbacca", "KeshaEUW", "Yoda", "Draven", "Thresh", "Ekko", "Kalista", "kid"]
name_list = names[:]  # makes a copy

clients = {}   # dict[str, dict[str, int | str]]
bullets = {}   # dict[str, list[dict[str, int]]]
powerups = {}  # dict[str, dict[str, int]]

canvas_width = 1905  # 1905 for full-screen --  750 for half-screen
canvas_height = 890  # 890 for full-screen  --  800 for half-screen

player_radius = 30
player_speed = 3

bullet_radius = 15
bullet_speed = 680  # pixels per second
bullet_damage = 27
bullet_color = "yellow"
bullet_cooldown = 400  # milliseconds

powerup_radius = 17

thread = None

"""
                FIX HEALTH POWERUP
                FIX URF POWERUP
                FIX BIG-CANON-BULLETS POWERUP
                
                FIX AT START MENU OPTIONS TO PLAY PVP OR PVE
"""


def calculate_bullet_pos_and_collision(delta_time):
    for clientId in bullets:
        if not bullets[clientId]:
            continue
        for i, bullet in enumerate(bullets[clientId]):
            if not bullet:
                continue
            bullet["x"] += bullet["vx"] * delta_time
            bullet["y"] += bullet["vy"] * delta_time

            # if bullet goes off-screen then remove it
            if (bullet["x"] < 0 - bullet_radius or bullet["x"] > canvas_width + bullet_radius or
               bullet["y"] < 0 - bullet_radius or bullet["y"] > canvas_height + bullet_radius):
                bullets[clientId].pop(i)
                continue

            for clientId2 in clients:
                # if clientId2 is the same as the clients bullet then skip
                if clientId2 == clientId or not clients[clientId2]["alive"]:
                    continue

                # Calculate the distance between the bullet and the player
                dx = bullet["x"] - clients[clientId2]["x"]
                dy = bullet["y"] - clients[clientId2]["y"]
                distance = math.sqrt(dx ** 2 + dy ** 2)

                if distance < bullet_radius + player_radius:
                    bullets[clientId].pop(i)
                    clients[clientId2]["hp"] -= bullet_damage
                    if clients[clientId2]["hp"] <= 0:
                        clients[clientId]["score"] += 1
                        clients[clientId2]["x"] = random.randint(50, canvas_width - 50)
                        clients[clientId2]["y"] = random.randint(50, canvas_height - 50)
                        clients[clientId2]["hp"] = 100


def powerup_collision():
    for clientId in clients:
        client = clients[clientId]
        for powerup_name in powerups:
            powerup = powerups[powerup_name]
            if not powerup:
                continue
            dx = powerup["x"] - client["x"]
            dy = powerup["y"] - client["y"]
            distance = math.sqrt(dx ** 2 + dy ** 2)

            if distance < powerup_radius + player_radius:
                powerups[powerup_name] = {}
                clients[clientId][powerup_name] = True


def spawn_multi_shot_buff():
    x = random.randint(50, canvas_width - 50)
    y = random.randint(50, canvas_height - 50)

    powerups["multi_shot"] = {
        "x": x,
        "y": y,
        "size": powerup_radius,
        "color1": "red",
        "color2": "blue"
    }


def server_update():
    """Continuously updates for every client in a single loop."""
    last_time = time.time()
    last_spawn_time = time.time()
    while True:
        current_time = time.time()
        delta_time = current_time - last_time
        last_time = current_time

        if not powerups:
            if current_time - last_spawn_time >= 10:
                spawn_multi_shot_buff()
                last_spawn_time = current_time

        calculate_bullet_pos_and_collision(delta_time)
        powerup_collision()
        socketio.emit("updateClients", clients)
        socketio.emit("updateBullets", bullets)
        socketio.emit("updatePowerups", powerups)
        socketio.sleep(0.004)  # ~240 updates per second


@app.route("/")
def home_page():
    return render_template("index.html",
                           canvas_width=canvas_width,
                           canvas_height=canvas_height,
                           player_radius=player_radius,
                           player_speed=player_speed,
                           bullet_radius=bullet_radius,
                           bullet_speed=bullet_speed,
                           bullet_damage=bullet_damage,
                           bullet_color=bullet_color,
                           bullet_cooldown=bullet_cooldown)


@socketio.on("connect")
def handle_connect():
    print(f"Client: {request.sid} connected")
    global thread
    if thread is None:
        thread = socketio.start_background_task(target=server_update)

    if not color_list:  # if color_list is empty -> reset it
        color_list.extend(colors)
    color_idx = random.randint(0, len(color_list) - 1)
    color = color_list.pop(color_idx)

    clients[request.sid] = {
        "x": random.randint(50, canvas_width - 50),
        "y": random.randint(50, canvas_height - 50),
        "name": "PlaceHolderName",
        "color": color,
        "hp": 100,
        "score": 0,
        "alive": False,
        "multishot": False
    }
    bullets[request.sid] = []  # give client their own bullets list


@socketio.on("clientPressedPlay")
def handle_client_attributes(name_data):
    print(f"Client: {request.sid} pressed play")
    if name_data:
        name = name_data
    else:
        if not name_list:  # if name_list is empty -> refill it
            name_list.extend(names)
        name_idx = random.randint(0, len(name_list) - 1)
        name = name_list.pop(name_idx)

    clients[request.sid]["name"] = name
    clients[request.sid]["alive"] = True


@socketio.on("updatePosition")
def handle_update_position(data):
    clients[request.sid]["x"] = data["x"]  # Update the client's position
    clients[request.sid]["y"] = data["y"]


@socketio.on("updateBulletPosition")
def handle_update_bullet_position(data):
    if data:
        if type(data) is list:
            print("adding bullet list")
            [bullets[request.sid].append(bullet) for bullet in data]
        else:
            bullets[request.sid].append(data)  # Update the bullets position


@socketio.on("disconnect")
def handle_disconnect():
    print(f"Client: {request.sid} disconnected")
    if request.sid in clients:
        del clients[request.sid]  # Remove the client from the clients and bullets list
    if request.sid in bullets:
        del bullets[request.sid]


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
