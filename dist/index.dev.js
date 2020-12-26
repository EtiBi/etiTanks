"use strict";

var express = require('express');

var he = require('he');

var app = express();

var http = require('http').Server(app);

var io = require('socket.io')(http);

var lineclip = require("lineclip");

console.log(lineclip([[-10, -10], [-15, -10]], [0, 0, 20, 20]));
process.env.PWD = process.cwd();
app.use(express["static"](process.env.PWD + '/linked'));
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
app.get('/mapEditor', function (req, res) {
  res.sendFile(__dirname + '/mapEditor.html');
});

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

var players = {};
var spawnPoints = [{
  x: 350,
  y: 350
}, {
  x: 3650,
  y: 350
}, {
  x: 350,
  y: 1650
}, {
  x: 3650,
  y: 1650
}];
var spawnPointsLeft = spawnPoints.slice();
var maxPlayers = 4;
var gameState = "wait";
var powerUps = ["heal", "speed"];
var powerUpsSpawnpoints = [{
  x: 300,
  y: 300,
  power: null
}, {
  x: 3600,
  y: 300,
  power: null
}, {
  x: 300,
  y: 1600,
  power: null
}, {
  x: 3600,
  y: 1600,
  power: null
}];
var mapSave = [{
  type: "bg",
  source: "/grassTexture.jpg"
}, {
  type: "wall",
  x: 0,
  y: 0,
  width: 100,
  height: 2000
}, {
  type: "wall",
  x: 100,
  y: 1900,
  width: 3800,
  height: 100
}, {
  type: "wall",
  x: 3900,
  y: 0,
  width: 100,
  height: 2000
}, {
  type: "wall",
  x: 100,
  y: 0,
  width: 3900,
  height: 100
}, {
  type: "wall",
  x: 100,
  y: 950,
  width: 600,
  height: 100
}, {
  type: "wall",
  x: 3300,
  y: 950,
  width: 600,
  height: 100
}, {
  type: "bush",
  x: 900,
  y: 600
}, {
  type: "bush",
  x: 2500,
  y: 1000
}, {
  type: "bush",
  x: 1300,
  y: 1500
}, {
  type: "woodWall",
  breakable: true,
  x: 2500,
  y: 100,
  width: 50,
  height: 1800,
  hp: 20,
  id: 0
}, {
  type: "crate",
  x: 1925,
  y: 100,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 1
}, {
  type: "crate",
  x: 1925,
  y: 100,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 2
}, {
  type: "crate",
  x: 1925,
  y: 200,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 3
}, {
  type: "crate",
  x: 1925,
  y: 300,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 4
}, {
  type: "crate",
  x: 1925,
  y: 400,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 5
}, {
  type: "crate",
  x: 1925,
  y: 500,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 6
}, {
  type: "crate",
  x: 1925,
  y: 600,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 7
}, {
  type: "crate",
  x: 1925,
  y: 700,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 8
}, {
  type: "crate",
  x: 1925,
  y: 800,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 9
}, {
  type: "crate",
  x: 1925,
  y: 900,
  width: 100,
  height: 100,
  breakable: true,
  hp: 20,
  id: 10
}];
var map = JSON.parse(JSON.stringify(mapSave));
var tankTypes = [{
  name: "sprayer",
  bulletSize: 6,
  bulletDamage: 1,
  shootDelay: 100,
  minBulletDistance: 600,
  maxBulletDistance: 1000,
  bloomDeg: 0.18
}, {
  name: "sniper",
  bulletSize: 20,
  bulletDamage: 5,
  shootDelay: 1000,
  minBulletDistance: 3000,
  maxBulletDistance: 3500,
  bloomDeg: 0
}];
var updateInt;
var deltaTime = 0;
var previousTime = Date.now();
var previousPlayers = "";
var tankSize = 70;
var tankWidth = tankSize * 1.865;
var speedMultiplier = 0.5;
var bullets = [];
var bulletSpeed = 1;
var endTimeout;
var endTimer = 5;
var savePlayers;
var viewBobbing = false;
var powerSpawnTime = 0;

function isHex(h) {
  var a = parseInt(h, 16);
  return a.toString(16) === h.toLowerCase();
}

function endCounter() {
  io.to("gameRoom").emit("endTimer", endTimer);
  endTimer--;

  if (endTimer == -1) {
    endTimer = 5;
    spawnPointsLeft = spawnPoints.slice();
    bullets = [];
    map = JSON.parse(JSON.stringify(mapSave));
    Object.keys(players).forEach(function (item, index) {
      // players[item].health = players[item].maxHealth;
      // players[item].shooting = false;
      // players[item].xPos = spawnPointsLeft[0].x;
      // players[item].yPos = spawnPointsLeft[0].y;
      players = JSON.parse(JSON.stringify(savePlayers));
      spawnPointsLeft.splice(0, 1);
    });
    io.to("gameRoom").emit("resetAll");
    gameState = "wait";
    io.to("gameRoom").emit("initYourself");

    for (var socketId in players) {
      if (players[socketId].host) {
        io.to(socketId).emit("host");
        break;
      }
    }
  }
}

function checkChanged(first, second) {
  if (JSON.stringify(first) == JSON.stringify(second)) {
    return false;
  } else {
    return true;
  }
}

function checkCollision() {
  var collArgs = Object.values(arguments)[0];
  var r = false;
  map.filter(function (x) {
    return x.type == "wall" || x.type == "woodWall" || x.type == "crate";
  }).forEach(function (item, index) {
    //console.log(lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]).length !==0);
    //return lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]);
    if (lineclip.polyline(collArgs, [item.x, item.y, item.width + item.x, item.height + item.y]).length !== 0) {
      r = true;
    }
  });
  return r;
}

function updateBullets(deltaTime) {
  var r = false;

  for (var i = bullets.length - 1; i >= 0; i--) {
    var xAdd = Math.cos(bullets[i].angle) * deltaTime * bulletSpeed;
    var yAdd = Math.sin(bullets[i].angle) * deltaTime * bulletSpeed;
    var d = false;
    var ballBorders = [[bullets[i].xPos - bullets[i].bs, bullets[i].yPos], [bullets[i].xPos, bullets[i].yPos - bullets[i].bs], [bullets[i].xPos + xAdd + bullets[i].bs, bullets[i].yPos + yAdd], [bullets[i].xPos + xAdd, bullets[i].yPos + yAdd + bullets[i].bs]];
    Object.keys(players).forEach(function (item, index) {
      var tankBorders = [players[item].xPos - tankWidth, players[item].yPos - tankSize, players[item].xPos, players[item].yPos];

      if (lineclip(ballBorders, tankBorders).length !== 0) {
        players[item].health -= bullets[i].dmg;
        d = true;
      }
    });
    map.filter(function (x) {
      return x.type == "wall" || x.type == "woodWall" || x.type == "crate";
    }).forEach(function (item, index) {
      //console.log(lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]).length !==0);
      //return lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]);
      if (lineclip(ballBorders, [item.x, item.y, item.width + item.x, item.height + item.y]).length !== 0) {
        if (item.breakable) {
          item.hp -= bullets[i].dmg;
        }

        d = true;
      }
    });

    if (d) {
      bullets.splice(i, 1);
    } else {
      bullets[i].xPos += xAdd;
      bullets[i].yPos += yAdd;

      if (Math.sqrt(Math.pow(bullets[i].xPos - bullets[i].startX, 2) + Math.pow(bullets[i].yPos - bullets[i].startY, 2)) > bullets[i].distance) {
        bullets.splice(i, 1);
      }
    }

    r = true;
  }

  return r;
}

function update() {
  deltaTime = Date.now() - previousTime;
  var changed = false;
  var bulletsChanged = updateBullets(deltaTime);

  if (previousPlayers === "") {
    previousPlayers = JSON.parse(JSON.stringify(players));
  } //console.log("bullets: ", bullets);
  //All borders = var tankBorders = [[players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos-tankSize-deltaTime*speedMultiplier], [players[item].xPos, players[item].yPos-tankSize-deltaTime*speedMultiplier], [players[item].xPos, players[item].yPos+deltaTime*speedMultiplier], [players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos+deltaTime*speedMultiplier], [players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos-tankSize-deltaTime*speedMultiplier]];


  Object.keys(players).forEach(function (item, index) {
    if (players[item].speedTimeout <= Date.now()) {
      players[item].speed = 0.5;
    }

    var tankType = tankTypes.find(function (x) {
      return x.name == players[item].tankType;
    });
    powerUpsSpawnpoints.filter(function (_ref) {
      var power = _ref.power;
      return power !== null;
    }).forEach(function (power, powerIndex) {
      var tankBorders = [players[item].xPos - tankWidth, players[item].yPos - tankSize, players[item].xPos, players[item].yPos];

      if (lineclip([[power.x, power.y], [power.x + 100, power.y], [power.x + 100, power.y + 100], [power.x, power.y + 100], [power.x, power.y]], tankBorders).length !== 0) {
        switch (power.power) {
          case "heal":
            players[item].health + 50 <= players[item].maxHealth ? players[item].health += 50 : players[item].health = players[item].maxHealth;
            break;

          case "speed":
            players[item].speed = 1;
            players[item].speedTimeout = Date.now() + 5000;
            break;
        }

        power.power = null;
        io.emit("powerUpsChanged", powerUpsSpawnpoints);
      }
    });

    if (players[item].shooting && Date.now() - players[item].previousShotTime >= tankType.shootDelay) {
      var bulletDir = players[item].turretRotation - Math.PI / 2 + Math.random() * (tankType.bloomDeg + tankType.bloomDeg) - tankType.bloomDeg;
      var bulletX = Math.cos(players[item].turretRotation - Math.PI / 2) * 120 + players[item].xPos - 75;
      var bulletY = Math.sin(players[item].turretRotation - Math.PI / 2) * 120 + players[item].yPos - 30;
      var bs = tankType.bulletSize;
      var dmg = tankType.bulletDamage;
      var dist = randomBetween(tankType.minBulletDistance, tankType.maxBulletDistance);

      if (viewBobbing) {
        io.to("gameRoom").emit("drawLines", [[bulletX, bulletY], [bulletX + Math.cos(bulletDir) * dist, bulletY + Math.sin(bulletDir) * dist]]);
      }

      bullets.push({
        angle: bulletDir,
        xPos: bulletX,
        yPos: bulletY,
        startX: bulletX,
        startY: bulletY,
        bs: bs,
        dmg: dmg,
        distance: dist
      });
      players[item].previousShotTime = Date.now();
    }

    if (viewBobbing) {
      io.to("gameRoom").emit("drawLines", [[players[item].xPos - tankWidth, players[item].yPos - tankSize], [players[item].xPos, players[item].yPos - tankSize], [players[item].xPos, players[item].yPos], [players[item].xPos - tankWidth, players[item].yPos], [players[item].xPos - tankWidth, players[item].yPos - tankSize]], true);
    }

    speedMultiplier = players[item].speed;

    if (players[item].joystickMove) {
      var tankBorders = [[players[item].xPos - tankWidth - deltaTime * speedMultiplier * Math.cos(players[item].joystickMoveAngle), players[item].yPos - tankSize - deltaTime * speedMultiplier * Math.sin(players[item].joystickMoveAngle)], [players[item].xPos - deltaTime * speedMultiplier * Math.cos(players[item].joystickMoveAngle), players[item].yPos - tankSize - deltaTime * speedMultiplier * Math.sin(players[item].joystickMoveAngle)], [players[item].xPos - deltaTime * speedMultiplier * Math.cos(players[item].joystickMoveAngle), players[item].yPos - deltaTime * speedMultiplier * Math.sin(players[item].joystickMoveAngle)], [players[item].xPos - tankWidth - deltaTime * speedMultiplier * Math.cos(players[item].joystickMoveAngle), players[item].yPos - deltaTime * speedMultiplier * Math.sin(players[item].joystickMoveAngle)], [players[item].xPos - tankWidth - deltaTime * speedMultiplier * Math.cos(players[item].joystickMoveAngle), players[item].yPos - tankSize - deltaTime * speedMultiplier * Math.sin(players[item].joystickMoveAngle)]]; //io.to("gameRoom").emit("drawLines", tankBorders)

      if (!checkCollision(tankBorders)) {
        players[item].xPos -= deltaTime * speedMultiplier * Math.cos(players[item].joystickMoveAngle);
        players[item].yPos -= deltaTime * speedMultiplier * Math.sin(players[item].joystickMoveAngle);
        changed = true;
      }
    } else {
      if (players[item].moveLeft) {
        var tankBorders = [[players[item].xPos - tankWidth - deltaTime * speedMultiplier, players[item].yPos - tankSize], [players[item].xPos, players[item].yPos - tankSize], [players[item].xPos, players[item].yPos], [players[item].xPos - tankWidth - deltaTime * speedMultiplier, players[item].yPos], [players[item].xPos - tankWidth - deltaTime * speedMultiplier, players[item].yPos - tankSize]]; //io.to("gameRoom").emit("drawLines", tankBorders)
        //console.log(lineclip(tankBorders, [0, 0, 100, 2000]))
        //console.log(checkCollision(tankBorders))

        if (!checkCollision(tankBorders)) {
          players[item].xPos -= deltaTime * speedMultiplier;
          changed = true;
        }
      }

      if (players[item].moveForward) {
        var tankBorders = [[players[item].xPos - tankWidth, players[item].yPos - tankSize - deltaTime * speedMultiplier], [players[item].xPos, players[item].yPos - tankSize - deltaTime * speedMultiplier], [players[item].xPos, players[item].yPos], [players[item].xPos - tankWidth, players[item].yPos], [players[item].xPos - tankWidth, players[item].yPos - tankSize - deltaTime * speedMultiplier]]; //io.to("gameRoom").emit("drawLines", tankBorders)

        if (!checkCollision(tankBorders)) players[item].yPos -= deltaTime * speedMultiplier;
        changed = true;
      }

      if (players[item].moveBack) {
        var tankBorders = [[players[item].xPos - tankWidth, players[item].yPos - tankSize], [players[item].xPos, players[item].yPos - tankSize], [players[item].xPos, players[item].yPos + deltaTime * speedMultiplier], [players[item].xPos - tankWidth, players[item].yPos + deltaTime * speedMultiplier], [players[item].xPos - tankWidth, players[item].yPos - tankSize]]; //io.to("gameRoom").emit("drawLines", tankBorders)

        if (!checkCollision(tankBorders)) players[item].yPos += deltaTime * speedMultiplier;
        changed = true;
      }

      if (players[item].moveRight) {
        var tankBorders = [[players[item].xPos - tankWidth, players[item].yPos - tankSize], [players[item].xPos + deltaTime * speedMultiplier, players[item].yPos - tankSize], [players[item].xPos + deltaTime * speedMultiplier, players[item].yPos], [players[item].xPos - tankWidth, players[item].yPos], [players[item].xPos - tankWidth, players[item].yPos - tankSize]]; //io.to("gameRoom").emit("drawLines", tankBorders)

        if (!checkCollision(tankBorders)) players[item].xPos += deltaTime * speedMultiplier;
        changed = true;
      }
    }

    if (changed) {
      players[item].tankRotation = Math.atan2(previousPlayers[item].yPos - players[item].yPos, previousPlayers[item].xPos - players[item].xPos);
      changed = false;
    }
  });

  if (Date.now() >= powerSpawnTime) {
    powerSpawnTime = Date.now() + randomBetween(10, 14) * 1000;
    var ran = Math.random();
    var filtered = powerUpsSpawnpoints.filter(function (x) {
      return x.power == null;
    });

    if (filtered.length > 0) {
      filtered[Math.floor(Math.random() * filtered.length)].power = powerUps[Math.floor(Math.random() * powerUps.length)];
    }

    io.emit("powerUpsChanged", powerUpsSpawnpoints);
  }

  if (checkChanged(previousPlayers, players) || bulletsChanged) {
    io.to("gameRoom").emit("newPlayersPos", players, bullets);
    previousPlayers = JSON.parse(JSON.stringify(players));
  }

  var filterMap = map.filter(function (x) {
    return x.breakable && x.hp <= 0;
  });

  if (filterMap.length >= 1) {
    io.to("gameRoom").emit("removeFromMap", map.filter(function (x) {
      return x.breakable && x.hp <= 0;
    }));
    map = map.filter(function (x) {
      return !(x.breakable && x.hp <= 0);
    });
  }

  if (Object.keys(players).length === 1) {
    io.to(Object.keys(players)[0]).emit("died");
    clearInterval(updateInt);
    endCounter();
    endTimeout = setTimeout(endCounter, 1000);
    endTimeout = setTimeout(endCounter, 2000);
    endTimeout = setTimeout(endCounter, 3000);
    endTimeout = setTimeout(endCounter, 4000);
    endTimeout = setTimeout(endCounter, 5000);
  } else if (Object.keys(players).length === 0) {//draw
  }

  var filterPlayers = Object.entries(players).filter(function (x) {
    return x[1].health <= 0;
  });
  filterPlayers.forEach(function (item, index) {
    io.to(item[0]).emit("died");
    delete players[item[0]];
  });
  previousTime = Date.now();
}

io.on('connection', function (socket) {
  io.emit("hellooo");
  socket.on("shooting", function (state) {
    if (players[socket.id] !== undefined) {
      players[socket.id].shooting = state;
    } else {
      console.log("shooting change failed");
    }
  });
  socket.on("changeTurretAngle", function (newAngle) {
    if (players[socket.id] !== undefined) {
      players[socket.id].turretRotation = newAngle; //console.log(players[socket.id].turretRotation)
    } else {
      console.log("turret rotation fail");
    }
  });
  socket.on("moveLeft", function (booState) {
    if (gameState == "play" && players[socket.id] !== undefined) {
      players[socket.id].moveLeft = booState;
    }
  });
  socket.on("moveForward", function (booState) {
    if (gameState == "play" && players[socket.id] !== undefined) {
      players[socket.id].moveForward = booState;
    }
  });
  socket.on("moveBack", function (booState) {
    if (gameState == "play" && players[socket.id] !== undefined) {
      players[socket.id].moveBack = booState;
    }
  });
  socket.on("moveRight", function (booState) {
    if (gameState == "play" && players[socket.id] !== undefined) {
      players[socket.id].moveRight = booState;
    }
  });
  socket.on("setTankType", function (toType) {
    if (players[socket.id] !== undefined) {
      players[socket.id].tankType = toType;
    }
  });
  socket.on("setMoveJoystick", function (x) {
    if (players[socket.id] !== undefined) {
      players[socket.id].joystickMove = x;
    }
  });
  socket.on("setMoveAngleJoystick", function (x) {
    if (players[socket.id] !== undefined) {
      players[socket.id].joystickMoveAngle = x;
    }
  });

  if (gameState == "wait") {
    if (Object.keys(players).length < 4) {
      socket.join("gameRoom");
      players[socket.id] = {
        name: "Bob",
        tankType: "sprayer",
        color: "#0000ff",
        xPos: spawnPointsLeft[0].x,
        yPos: spawnPointsLeft[0].y,
        turretRotation: 0,
        tankRotation: 0,
        shooting: false,
        health: 100,
        maxHealth: 100,
        previousShotTime: Date.now(),
        speed: 0.5,
        joystickMoveAngle: 0,
        joystickMove: false
      };
      spawnPointsLeft.splice(0, 1);
      socket.emit("initYourself", players[socket.id]);
      socket.broadcast.emit('newPlayer', players[socket.id]);

      if (Object.keys(players).length == 1) {
        console.log("host");
        players[socket.id].host = true;
        socket.emit("host");
      }
    } else {
      socket.emit("gameFull");
    }
  } else {
    socket.emit("gameAlreadyStarted");
  }

  io.to("gameRoom").emit("updatePlayers", players);
  socket.on("startGame", function (options) {
    var currPlayer = players[socket.id];

    if (currPlayer !== undefined) {
      if (currPlayer.host) {
        if (Object.keys(players).length > 1) {
          powerSpawnTime = Date.now() + 10000;
          savePlayers = JSON.parse(JSON.stringify(players));
          console.log("startGame");
          io.to("gameRoom").emit("onlyLights", options.lightOption);
          viewBobbing = options.bobbingOption;
          gameState = "play";
          io.to("gameRoom").emit("startGame", map);
          previousTime = Date.now();
          io.to("gameRoom").emit("newPlayersPos", players, bullets);
          updateInt = setInterval(update, 20);
        } else {
          socket.emit("notEnoughPlayers");
        }
      } else {
        socket.emit("notHost");
      }
    }
  });
  socket.on("changeColor", function (newColor) {
    try {
      if (isHex(newColor)) {
        console.log("changeColor", newColor);
        console.log("socketId", socket.id);
        players[socket.id].color = "#" + newColor;
        io.to("gameRoom").emit("updatePlayers", players);
      }
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("changeName", function (newName) {
    try {
      players[socket.id].name = he.encode(newName);
      io.to("gameRoom").emit("updatePlayers", players);
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("sendMessage", function (msg) {
    var returnMsg = {
      content: he.encode(msg),
      from: players[socket.id].name,
      color: players[socket.id].color,
      bgColor: "whitesmoke"
    };
    io.to("gameRoom").emit("receiveMessage", returnMsg);
  });
  socket.on('disconnect', function () {
    console.log("Player disconnected");

    if (players[socket.id]) {
      if (gameState == "wait") {
        spawnPointsLeft.push(spawnPoints.find(function (x) {
          return x.x == players[socket.id].xPos && x.y == players[socket.id].yPos;
        }));

        if (players[socket.id].host) {
          console.log("Host disconnected");
          delete players[socket.id];

          if (Object.values(players)[0] !== undefined) {
            console.log(Object.values(players)[0].name);
            io.to(Object.keys(players)[0]).emit("host");
            players[Object.keys(players)[0]].host = true;
          }
        }
      }
    }

    io.emit("playerLeft", socket.id);

    if (gameState == "play") {
      if (Object.keys(players).length == 0) {
        gameState == "wait";
      }

      if (players[socket.id].host) {
        delete players[socket.id];
        io.to(Object.keys(players)[0]).emit("host");
      }
    }

    delete players[socket.id];
  });
});
http.listen(2828, function () {
  console.log('listening on port:2828');
});