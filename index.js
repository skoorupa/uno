const express = require('express');
const WebSocket = require('ws');
const uno = require('./uno.js');

let app = express();
let port = process.env.PORT || 80;

let game = {
    rooms:[
        // {
            // id: 0,
            // host: "adam",
            // danejakies: ":OOO"
        // }
    ],
    maxrooms:20
};

// 
// EXPRESS
// 

app.get("/newroom/:nickname", function (req,res) {
    var nickname = req.params["nickname"];
    // create new room's id
    var id = 0;
    var roomids = [];
    game.rooms.forEach(room=>{roomids.push(room.id)});
    roomids = roomids.sort((a, b) => {
        return a - b;
    });
    roomids.forEach(x=>{if(id==x)id++});

    if (id >= game.maxrooms) {
        res.send("nope"); // too many rooms
        return;
    }

    var room = {
        players: [],
        roomid: id,
        idcounter: 0,
        cards: [],
        cardsused: [],
        cardsstack: [],
        lastcard: {},
        ingame: 0,
        isStarted: false,
        movemakes: {},
        direction: "cw",
        adding: 0,
        scoreboard: [],
        admin: {}
    };

    game.rooms[id] = room;
    res.redirect("/play.html?room="+id+"&nickname="+nickname);
    console.log(room);

    setTimeout(()=>{
        if (typeof game.rooms[id] != "undefined") {
            if (!game.rooms[id].players) {
                game.rooms.splice(id);
                console.log("removed room %s for idleness", id);
            }
        }
    }, 30000);
});

app.get("/getrooms", function (req,res) {
    // console.log(game.rooms);
    var roomlist = [];
    game.rooms.forEach((room)=>{
        roomlist.push({id: room.roomid, host: room.admin.nickname});
    });
    
    res.send(roomlist);
});

app.get("/joinroom/:id/:nickname", function (req,res) {
    var id = req.params["id"];
    var nickname = req.params["nickname"];
    if (typeof game.rooms[id] != "undefined")
        res.redirect("/play.html?room="+id+"&nickname="+nickname);
    else
        res.send("Nie ma pokoju o nr "+id);
});

// 
// WEBSOCKET
// 

const wss = new WebSocket.Server({noServer: true});
console.log("ws server running");

var allclients = [];
function random (limit) {
    return Math.floor(Math.random() * limit);
}

wss.on('connection', function connection(ws) {
    allclients[allclients.length] = ws;
    ws.on('message', function (message) {
        console.log('received: %s', message);
        var msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            return;
        }
        var user = this;
        switch (msg.type) {
            case "joinedtoroom":
                if (!game.rooms[msg.roomid] || game.rooms[msg.roomid].isStarted || !msg.content.replace(/ /g, "")) return;
                if (game.rooms[msg.roomid].players.find(function (obj) {
                    return obj.nickname == msg.content;
                })) {
                    user.send(JSON.stringify({
                        "type": "nickzajety"
                    }));
                    console.log("->"+msg.roomid+": nickname repeated");
                    return;
                }
                console.log("->"+msg.roomid+": new player "+msg.content);
                room = game.rooms[msg.roomid];

                user.nickname = msg.content;
                user.roomid = msg.roomid;
                user.id = room.idcounter;
                room.idcounter++;

                // user.isAlive = true;
                // user.on("pong", function () {
                //   this.isAlive = true;
                // });

                user.on("close", function () {
                    console.log("->"+this.roomid+": "+this.nickname+" has left");
                    var whoquit = this.nickname;
                    var roomid = this.roomid;
                    var room = game.rooms[roomid];
                    var playerinfos = [];

                    if (this.cards)
                        this.cards.forEach(function (card, index) {
                            room.cards.push(card);
                        });

                    if (room)
                        room.players.splice(
                            room.players.indexOf(this),
                        1);

                    if (whoquit == room.admin.nickname && room.players.length) {
                    var r = random(room.players.length);
                    var newadmin = room.players[r];
                    room.players.forEach(function (player, index) {
                        player.send(JSON.stringify({
                        "type":"newmessage",
                        "content": "\n"+newadmin.nickname+" zostaje adminem"
                        }));
                    });
                    }

                    room.players.forEach(function (player, index) {
                    if (player.cards)
                        playerinfos.push({nickname:player.nickname, cardsquantity:player.cards.length});
                    else
                        playerinfos.push({nickname:player.nickname, cardsquantity:0});
                    });

                    if (room) {
                    if (room.isStarted) {
                        room.players.forEach(function (player, index) {
                        player.send(JSON.stringify({
                            "type": "playerhasquit",
                            "who": whoquit,
                            "admin": room.admin,
                            "yourcards": player.cards,
                            "lastcard": room.lastcard,
                            "movemakes": room.movemakes.nickname,
                            "direction": room.direction,
                            "isitmymove": player.isitmymove,
                            "players": playerinfos
                        }));
                        });
                    } else {
                        var playerinfos = [];
                        game.rooms[user.roomid].players.forEach(function (player, index) {
                        playerinfos.push(player.nickname)
                        });
                        game.rooms[user.roomid].players.forEach(function (player, index) {
                        player.send(JSON.stringify({
                            "type":"joinedtoroom",
                            "content": playerinfos,
                            "admin": game.rooms[user.roomid].admin.nickname
                        }));
                        });
                    }

                    game.rooms[user.roomid].players.forEach(function (player, index) {
                        player.send(JSON.stringify({
                        "type":"newmessage",
                        "content": "\n"+whoquit+" odszedł z pokoju",
                        "notify": true
                        }));
                    });

                    if (game.rooms[roomid].players)
                        if (!game.rooms[roomid].players[0]) {
                        game.rooms.splice(game.rooms[roomid], 1);
                        console.log("->"+user.roomid+": deleted (everyone has left)");
                        }
                    }
                });

                setTimeout(() => {
                    user.send(JSON.stringify({
                        "type":"ping",
                        "random": Math.random()
                    }));
                }, 30000);

                room.players.push(user);
                if (Object.keys(room.admin).length===0)
                    room.admin = user;

                console.log("admin::::"+room.admin.nickname);

                var playerinfos = [];
                room.players.forEach(function (player, index) {
                    playerinfos.push(player.nickname)
                });
                room.players.forEach(function (player, index) {
                    player.send(JSON.stringify({
                    "type":"joinedtoroom",
                    "content": playerinfos,
                    "admin": room.admin.nickname
                    }));
                });
                room.players.forEach(function (player, index) {
                    player.send(JSON.stringify({
                    "type":"newmessage",
                    "content": "\n"+user.nickname+" dołączył do pokoju",
                    "notify": true
                    }));
                });
                break;
            case "startgame":
                console.log(`->${user.roomid}: ${user.nickname} tries to start game`);
                room = game.rooms[user.roomid];
                if (room.isStarted) return;

                // var filecontent = JSON.parse(data.toString());
                if (user.nickname == room.admin.nickname) {
                    console.log("->"+user.roomid+": starting game");
                    room.cards = [];
                    room.cardsused = [];
                    room.cardsstack = [];
                    room.lastcard = {};
                    room.ingame = room.players.length;
                    room.isStarted = false;
                    room.movemakes = {};
                    room.direction = "cw";
                    room.adding = 0;
                    room.scoreboard = [];

                    room.cards = uno.init();
                    var lastcard = room.cards[random(19 * 4 - 1)];

                    room.cardsstack.push(lastcard);
                    room.cards.splice(
                        room.cards.indexOf(lastcard),
                    1);
                    room.mmpos = random(room.players.length)
                    var firstplayer = room.players[room.mmpos];
                    console.log("->"+user.roomid+": first move belongs to "+firstplayer.nickname);
                    var playerinfos = [];

                    room.players.forEach(function (player, index) {
                    var playercards = [];
                    for (var i = 0; i < 7; i++) {
                        var newcard = room.cards[random(room.cards.length)];
                        playercards.push(newcard);
                        room.cardsused.push(newcard);
                        room.cards.splice(
                        room.cards.indexOf(newcard),
                        1);
                    }
                    // filecontent.players.forEach(function (fileplayer, index) {
                    //     if (player.nickname == fileplayer.nickname) { // ram == file
                    //     fileplayer.cards = playercards;
                    //     }
                    // });

                    player.isitmymove = false;
                    if (player.nickname == firstplayer.nickname) player.isitmymove = true;

                    player.cards = playercards;
                    playerinfos.push({nickname:player.nickname, cardsquantity:player.cards.length});
                    });

                    room.lastcard = lastcard;
                    room.movemakes = firstplayer;
                    room.direction = "cw";
                    room.ingame = room.players.length;
                    room.isStarted = true;

                    // filecontent.cards = game.rooms[user.roomid].cards;
                    // filecontent.cardsused = game.rooms[user.roomid].cardsused;
                    // filecontent.lastcard = lastcard;
                    // filecontent.movemakes = firstplayer.nickname;
                    // filecontent.direction = "cw";
                    // filecontent.ingame = game.rooms[user.roomid].players.length;
                    // filecontent.isStarted = true;

                    room.players.forEach(function (player, index) {
                    player.send(JSON.stringify({
                        "type": "next",
                        "yourcards": player.cards,
                        "lastcard": room.lastcard,
                        "movemakes": room.movemakes.nickname,
                        "direction": "cw", // clockwise
                        "isitmymove": player.isitmymove,
                        "players": playerinfos
                    }));
                    player.send(JSON.stringify({
                        "type":"newmessage",
                        "content": "\nrozpoczęto rozgrywkę"
                    }));
                    });

                    // filecontent.players.forEach(function (item, index) {
                    //   item.cards =
                    // });
                    // fs.writeFileSync("pokoje/"+user.roomid+".json", JSON.stringify(filecontent));
                } else console.log("->"+user.roomid+": falstart "+user.nickname);
                // });
                break;
            case "movemade":
                // var filecontent = JSON.parse(fs.readFileSync("pokoje/"+user.roomid+".json"));
                var room = game.rooms[user.roomid];
                if (!msg.card) msg.card = {};
                if (user.nickname != room.movemakes.nickname) return;
                else if (
                room.lastcard.color ==
                msg.card.color ||

                room.lastcard.content ==
                msg.card.content ||

                msg.card.colorchange ==
                true ||

                room.lastcard.newcolor ==
                msg.card.color ||

                (msg.card.add && room.lastcard.add) ||

                msg.content == "dobierzkarte"
                ) {
                console.log("->"+user.roomid+": "+user.nickname+" move finished");
                console.log("->"+user.roomid+": "+user.nickname+"'s move: "+msg.content);

                var nextplayer = {};
                var playerinfos = [];

                var player = room.players[
                    room.players.indexOf(user)
                ];

                switch (msg.content) {
                    case "dobierzkarte":
                    if (!room.adding) room.adding = 1;

                    while (room.adding) {
                        if (room.cards == 0) {
                        room.cards = room.cardsstack.splice(0);
                        room.cardsstack = [];
                        }

                        var r = random(room.cards.length);
                        player.cards.push(room.cards[r]);
                        room.cardsused.push(room.cards[r]);
                        room.cards.splice(r, 1);
                        room.adding--;
                    }
                    break;
                    case "wybierzkarte":
                    console.log(msg.card);
                    if (player.cards.find(function (obj) {
                        return obj.id == msg.card.id
                    })) {
                        switch (msg.card.type) {
                        case "normal":
                        case "newcolor":
                            // tu nic
                            break;
                        case "skip":
                            nextplayer = getnextplayer(room);
                            break;
                        case "reverse":
                            if (room.direction == "cw")
                            room.direction = "ccw"
                            else if (room.direction == "ccw")
                            room.direction = "cw"
                            break;
                            case "add2":
                            room.adding += 2;
                            break;
                            case "add4color":
                            room.adding += 4;
                            break;
                        default:
                            console.log("->"+user.roomid+": unknown card type: "+msg.card.type);
                            return;
                        }
                        player.cards.splice(
                        player.cards.findIndex(function (obj) {
                            return obj.id == msg.card.id;
                        })
                        , 1);
                        if (room.lastcard.newcolor)
                        room.lastcard.newcolor = "";

                        room.lastcard = msg.card;
                        // filecontent.lastcard = msg.card;

                        room.cardsstack.push(msg.card);
                        room.cardsused.splice(
                        room.cardsused.indexOf(msg.card),
                        1); // DEBUG: to może powodować błędy, może trzeba bedzie uzyc .find

                        if (
                        room.adding &&
                        msg.card.type != "add2" &&
                        msg.card.type != "add4color"
                        ) {
                        while (room.adding) {
                            if (room.cards == 0) {
                            room.cards = room.cardsstack.splice(0);
                            room.cardsstack = [];
                            }

                            var r = random(room.cards.length);
                            player.cards.push(room.cards[r]);
                            room.cardsused.push(room.cards[r]);
                            room.cards.splice(r, 1);
                            room.adding--;
                        }
                        }
                    } else console.log("->"+user.roomid+": "+user.nickname+" wanted to use card that doesn't compare");
                    break;
                    default:
                    console.log("->"+user.roomid+": unknown card content from "+user.nickname+" : "+msg.content);
                }

                console.log(
                    user.roomid+": "+
                    room.cards.length+" | "+
                    room.cardsused.length+" | "+
                    room.cardsstack.length+" -> "+
                    (room.cards.length+
                    room.cardsused.length+
                    room.cardsstack.length)
                );
                if ((room.cards.length+
                room.cardsused.length+
                room.cardsstack.length) != 108)
                    console.log("->"+user.roomid+": !!!!!!!!!!");

                if (room.movemakes.cards.length == 0) {
                    room.ingame--;
                    room.scoreboard.push(user.nickname);
                    console.log("->"+user.roomid+": "+user.nickname+" has used all of his/her cards");
                    if (room.ingame <= 1) {
                    var lastplayer = room.players.find(function (obj) {
                        return room.scoreboard.indexOf(obj.nickname)==-1;
                    });
                    if (lastplayer) {
                        room.scoreboard.push(lastplayer.nickname);
                    }
                    room.isStarted = false;
                    // var playerinfos0 = [];
                    // room.players.forEach(function (player, index) {
                    //   playerinfos0.push(
                    //     {
                    //       nickname: player.nickname,
                    //       place: room.scoreboard[player.nickname]
                    //     }
                    //   );
                    // });


                    room.players.forEach(function (player, index) {
                        player.send(JSON.stringify({
                        "type":"gameover",
                        "content": room.scoreboard,
                        "admin": room.admin.nickname
                        }));
                    });
                    console.log("->"+user.roomid+": game has ended");
                    }
                }

                nextplayer = getnextplayer(room);

                // filecontent.players.forEach(function (fileplayer, index) {
                //     if (user.nickname == fileplayer.nickname) { // ram == file
                //     fileplayer.cards = player.cards;
                //     }
                // });

                room.players.forEach(function (player, index) {
                    playerinfos.push({nickname:player.nickname, cardsquantity:player.cards.length});
                });

                room.movemakes = nextplayer;

                if (room.isStarted)
                    room.players.forEach(function (player, index) {
                    player.send(JSON.stringify({
                        "type": "next",
                        "yourcards": player.cards,
                        "lastcard": room.lastcard,
                        "movemakes": room.movemakes.nickname,
                        "direction": room.direction,
                        "isitmymove": player.isitmymove,
                        "players": playerinfos
                    }));
                    });

                // filecontent.cards = game.rooms[user.roomid].cards;
                // filecontent.cardsused = game.rooms[user.roomid].cardsused;
                // filecontent.lastcard = game.rooms[user.roomid].lastcard;
                // filecontent.movemakes = game.rooms[user.roomid].movemakes.nickname;
                // filecontent.direction = game.rooms[user.roomid].direction;

                console.log("->"+user.roomid+": "+nextplayer.nickname+" has the next move");
                }
                break;
            case "chatmessage":
                if (!user.roomid) return;
                // fs.readFile("pokoje/"+user.roomid+"chat.txt", function (err, data) {=
                var newcontent = '\n'+user.nickname+": "+msg.content;
                game.rooms[user.roomid].players.forEach(function (player, index) {
                    player.send(JSON.stringify({
                    "type": "newmessage",
                    "content": newcontent,
                    "notify": true
                    }));
                });
                // fs.writeFileSync("pokoje/"+user.roomid+"chat.txt", content+newcontent);
                // });
                break;
            case "pong":
                setTimeout(() => {
                    user.send(JSON.stringify({
                        "type":"ping",
                        "random": Math.random()
                    }));
                }, 30000);
                break;
            default:
                console.log("unknown message: "+msg.type);
        }
    });
    allclients[allclients.length-1].on('error', function(e){
      allclients.splice(allclients.indexOf(this),1);
    });
});
  
wss.on('close', function close() {
    console.log('disconnected');
});

function sendall(y,x) {
    y.forEach(function (u, index) {
        u.send(x);
    });
}

function getnextplayer(room) {
    if (room.direction == "cw") {
        room.mmpos++;
        if (room.mmpos >= room.players.length)
            room.mmpos = 0;
    } else {
        room.mmpos--;
        if (room.mmpos < 0)
            room.mmpos = room.players.length-1;
    }

    if (room.players[room.mmpos].cards.length == 0 && room.cardsused != 0)
        return getnextplayer(room)
    else
        return room.players[room.mmpos];
}

app.use(express.static('public'));

const server = app.listen(port, function(err) {
    if (err) console.log(err);
    console.log('http server running on port '+port);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, socket => {
        wss.emit('connection', socket, request);
    });
});