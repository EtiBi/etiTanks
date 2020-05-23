var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var lineclip = require("lineclip");
console.log(lineclip([[-10, -10], [-15, -10]], [0, 0, 20, 20]));
process.env.PWD = process.cwd();
app.use(express.static(process.env.PWD + '/linked'));
app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
})
function randomBetween(min,max){
	return Math.floor(Math.random()*max-min)+min;
}
var players = {};
const spawnPoints = [{x: 500, y: 500}, {x: 3700, y: 500}, {x: 300, y: 1500}, {x: 1000, y: 1000}];
var spawnPointsLeft = spawnPoints.slice();
const maxPlayers = 4;
var gameState = "wait";
var map = [{type:"bg", source: "/grassTexture.jpg"}, {type: "wall", x: 0, y:0, width: 100, height: 2000}, {type: "wall", x: 100, y:1900, width: 3800, height: 100}, {type: "wall", x: 3900, y:0, width: 100, height: 2000}, {type: "wall", x: 100, y:0, width: 3900, height: 100}, {type: "wall", x: 100, y:950, width: 600, height: 100},{type: "wall", x: 3300, y:950, width: 600, height: 100}, {type: "bush", x: 900, y:600}, {type: "bush", x: 2500, y:1000}, {type: "bush", x: 1300, y:1500},{type: "wall", x: 2000, y:950, width: 50, height: 300},{type: "wall", x: 3000, y:950, width: 50, height: 300}, {type: "woodWall", breakable: true, x: 2500, y:100, width: 50, height: 1800, hp: 20, id: randomBetween(0, 1000000000)}];
var updateInt;
var deltaTime = 0;
var previousTime = Date.now();
var previousPlayers = "";
const tankSize = 70;
const tankWidth = tankSize*1.865;
var speedMultiplier = 0.5;
const bloomDeg = 0.18;
var bullets = [];
const bulletSpeed = 1;
function checkChanged(first, second){	
	if(JSON.stringify(first) == JSON.stringify(second)){
    	return false;
    }else{
    	return true;
    }
}
function checkCollision(){
	var collArgs = Object.values(arguments)[0];
	var r = false;
	map.filter(x=>x.type == "wall"||x.type == "woodWall").forEach(function(item, index){
		//console.log(lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]).length !==0);
		//return lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]);
		if(lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]).length !== 0){
			r = true;
		}
	});
	return r;
}
function updateBullets(deltaTime){
	var r = false;
	
	for(var i = bullets.length-1;i>=0;i--){
		var xAdd = Math.cos(bullets[i].angle)*deltaTime*bulletSpeed;
		var yAdd = Math.sin(bullets[i].angle)*deltaTime*bulletSpeed;
		var d = false;
		Object.keys(players).forEach(function(item, index){
			var tankBorders = [players[item].xPos-tankWidth, players[item].yPos-tankSize, players[item].xPos, players[item].yPos];
			if(lineclip([[bullets[i].xPos, bullets[i].yPos], [bullets[i].xPos+xAdd, bullets[i].yPos+yAdd]], tankBorders).length !== 0){
				players[item].health--;
				d=true;
			}
		});
		map.filter(x=>x.type == "wall"||x.type == "woodWall").forEach(function(item, index){
			//console.log(lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]).length !==0);
			//return lineclip.polyline(collArgs, [item.x, item.y, item.width+item.x, item.height+item.y]);
			if(lineclip([[bullets[i].xPos, bullets[i].yPos], [bullets[i].xPos+xAdd, bullets[i].yPos+yAdd]], [item.x, item.y, item.width+item.x, item.height+item.y]).length !== 0){
				if(item.breakable){
					item.hp--;
				}
				d = true;
			}
			
		});
		if(d){
			bullets.splice(i, 1);
		}else{
			bullets[i].xPos += xAdd;
			bullets[i].yPos += yAdd;
			if(Math.sqrt(Math.pow(bullets[i].xPos-bullets[i].startX, 2)+Math.pow(bullets[i].yPos-bullets[i].startY, 2)) > bullets[i].distance){
				bullets.splice(i, 1);
			}
		}
		r = true;
	}
	return r;
}
function update(){
	deltaTime = Date.now()-previousTime;
	var changed = false;
	var bulletsChanged = updateBullets(deltaTime);
	if(previousPlayers === ""){
		previousPlayers = JSON.parse(JSON.stringify(players));
	}
	//console.log("bullets: ", bullets);
	//All borders = var tankBorders = [[players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos-tankSize-deltaTime*speedMultiplier], [players[item].xPos, players[item].yPos-tankSize-deltaTime*speedMultiplier], [players[item].xPos, players[item].yPos+deltaTime*speedMultiplier], [players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos+deltaTime*speedMultiplier], [players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos-tankSize-deltaTime*speedMultiplier]];
	Object.keys(players).forEach(function(item, index){
		if(players[item].shooting){
			var bulletDir = players[item].turretRotation-Math.PI/2 + Math.random() * (bloomDeg + bloomDeg) - bloomDeg;
			var bulletX = Math.cos(players[item].turretRotation-Math.PI/2)*100+players[item].xPos-75;
			var bulletY = Math.sin(players[item].turretRotation-Math.PI/2)*100+players[item].yPos-30;
			bullets.push({angle: bulletDir, xPos: bulletX, yPos: bulletY, startX: bulletX, startY: bulletY, distance: randomBetween(600, 1000)})
		}
		if(players[item].moveLeft){
			var tankBorders = [[players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos-tankSize], [players[item].xPos, players[item].yPos-tankSize], [players[item].xPos, players[item].yPos], [players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos], [players[item].xPos-tankWidth-deltaTime*speedMultiplier, players[item].yPos-tankSize]];
			//io.to("gameRoom").emit("drawLines", tankBorders)
			//console.log(lineclip(tankBorders, [0, 0, 100, 2000]))
			//console.log(checkCollision(tankBorders))
			if(!checkCollision(tankBorders)){
				players[item].xPos -= deltaTime*speedMultiplier;
				changed = true;
			}
		}
		if(players[item].moveForward){
			var tankBorders = [[players[item].xPos-tankWidth, players[item].yPos-tankSize-deltaTime*speedMultiplier], [players[item].xPos, players[item].yPos-tankSize-deltaTime*speedMultiplier], [players[item].xPos, players[item].yPos], [players[item].xPos-tankWidth, players[item].yPos], [players[item].xPos-tankWidth, players[item].yPos-tankSize-deltaTime*speedMultiplier]];
			//io.to("gameRoom").emit("drawLines", tankBorders)
			if(!checkCollision(tankBorders))
				players[item].yPos -= deltaTime*speedMultiplier;
				changed = true;
		}
		if(players[item].moveBack){
			var tankBorders = [[players[item].xPos-tankWidth, players[item].yPos-tankSize], [players[item].xPos, players[item].yPos-tankSize], [players[item].xPos, players[item].yPos+deltaTime*speedMultiplier], [players[item].xPos-tankWidth, players[item].yPos+deltaTime*speedMultiplier], [players[item].xPos-tankWidth, players[item].yPos-tankSize]];
			//io.to("gameRoom").emit("drawLines", tankBorders)
			if(!checkCollision(tankBorders))
				players[item].yPos += deltaTime*speedMultiplier;
				changed = true;
		}
		if(players[item].moveRight){
			var tankBorders = [[players[item].xPos-tankWidth, players[item].yPos-tankSize], [players[item].xPos+deltaTime*speedMultiplier, players[item].yPos-tankSize], [players[item].xPos+deltaTime*speedMultiplier, players[item].yPos], [players[item].xPos-tankWidth, players[item].yPos], [players[item].xPos-tankWidth, players[item].yPos-tankSize]];
			//io.to("gameRoom").emit("drawLines", tankBorders)
			if(!checkCollision(tankBorders))
				players[item].xPos += deltaTime*speedMultiplier;
				changed = true;
		}
		if(changed){
			players[item].tankRotation = Math.atan2(previousPlayers[item].yPos-players[item].yPos, previousPlayers[item].xPos-players[item].xPos);
			changed = false;
		}
	});
	if(checkChanged(previousPlayers, players) || bulletsChanged){
		io.to("gameRoom").emit("newPlayersPos", players, bullets);
		previousPlayers = JSON.parse(JSON.stringify(players));
	}
	var filterMap = map.filter(x=>x.breakable&&x.hp<=0);
	if(filterMap.length >= 1){
		io.to("gameRoom").emit("removeFromMap", map.filter(x=>x.breakable&&x.hp<=0));
		map = map.filter(x=>!(x.breakable&&x.hp<=0));
	}
	var filterPlayers = Object.entries(players).filter(x=>x[1].health<=0);
	filterPlayers.forEach(function(item, index){
		io.to(item[0]).emit("died");
		delete players[item[0]];
	});
	if(Object.keys(players).length === 1){

	}else if(Object.keys(players).length === 1){
		//d
	}
	previousTime = Date.now();
}
io.on('connection', function(socket){
	socket.on("shooting", function(state){
		if(players[socket.id]!==undefined){
			players[socket.id].shooting = state;
		}else{
			console.log("shooting change failed");
		}
	})
	socket.on("changeTurretAngle", function(newAngle){
		if(players[socket.id]!==undefined){
			players[socket.id].turretRotation = newAngle;
			//console.log(players[socket.id].turretRotation)
		}else{
			console.log("turret rotation fail");
		}
	});
	socket.on("moveLeft", function(booState){
		if(gameState == "play" && players[socket.id]!==undefined){
			players[socket.id].moveLeft = booState;
		}
	});
	socket.on("moveForward", function(booState){
		if(gameState == "play" && players[socket.id]!==undefined){
			players[socket.id].moveForward = booState;
		}
	});
	socket.on("moveBack", function(booState){
		if(gameState == "play" && players[socket.id]!==undefined){
			players[socket.id].moveBack = booState;
		}
	});
	socket.on("moveRight", function(booState){
		if(gameState == "play" && players[socket.id]!==undefined){
			players[socket.id].moveRight = booState;
		}
	});
	if(gameState == "wait"){
		if(Object.keys(players).length<4){
			socket.join("gameRoom");
			players[socket.id] = {name: "Bob", color:"#0000ff", xPos: spawnPointsLeft[0].x, yPos: spawnPointsLeft[0].y, turretRotation: 0, tankRotation: 0, shooting: false, health: 100, maxHealth: 100};
			spawnPointsLeft.splice(0, 1);
			socket.emit("initYourself", players[socket.id])
			socket.broadcast.emit('newPlayer', players[socket.id]);
			if(Object.keys(players).length==1){
				console.log("host")
				players[socket.id].host = true;
				socket.emit("host");
			}
		}else{
			socket.emit("gameFull");
		}
	}else{
		socket.emit("gameAlreadyStarted");
	}
	io.to("gameRoom").emit("updatePlayers", players);
	socket.on("startGame", function(){
		var currPlayer = players[socket.id];
		if(currPlayer !== undefined){
			if(currPlayer.host){
				console.log("startGame");
				gameState = "play";
				io.to("gameRoom").emit("startGame", map);
				previousTime = Date.now();
				io.to("gameRoom").emit("newPlayersPos", players, bullets);
				updateInt = setInterval(update, 20);
			}else{
				socket.emit("notHost");
			}
		}
	});
	socket.on("changeColor", function(newColor){
		try{
			console.log("changeColor", newColor)
			players[socket.id].color = newColor;
			io.to("gameRoom").emit("updatePlayers", players);
		}catch(err){
			console.log(err);
		}
	});
	socket.on("changeName", function(newName){
		try{
			players[socket.id].name = newName;
			io.to("gameRoom").emit("updatePlayers", players);
		}catch(err){
			console.log(err);
		}
	})
	socket.on('disconnect', function() {
		if(players[socket.id]){
			if(gameState == "wait"){
				spawnPointsLeft.push(spawnPoints.find(x=>x.x == players[socket.id].xPos && x.y == players[socket.id].yPos));
				if(players[socket.id].host){
					delete players[socket.id];
					io.to(Object.keys(players)[0]).emit("host")
				}
			}
		}
		io.emit("playerLeft", socket.id);
		delete players[socket.id];
		if(gameState == "play"){
			if(Object.keys(players).length == 0){
				gameState == "wait";
			}
		}
	});
});
http.listen(2828, function(){
	console.log('listening on port:2828');
});