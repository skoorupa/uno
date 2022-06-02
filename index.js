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

class Room {
    constructor(id) {
        this.players = [];
        this.roomid = id;
        this.idcounter = 0;
        this.cards = uno.init();
        this.cardsused = [];
        this.cardsstack = [];
        this.lastcard = {};
        this.ingame = 0;
        this.isStarted = false;
        this.movemakes = {};
        this.direction = "cw";
        this.adding = 0;
        this.scoreboard = [];
        this.admin = {};
    }

    get allNicknames() {
        let result = [];
        this.players.forEach(player => {
            result.push(player.nickname);
        });
        return result;
    }

    get nicknamesAndCards() {
        let result = [];
        this.players.forEach(player => {
            if (player.cards)
                result.push({nickname:player.nickname, cardsquantity:player.cards.length});
            else
                result.push({nickname:player.nickname, cardsquantity:0});
        });
        return result;
    }

    addPlayer(ws, nickname = "") {
        if (this.isStarted || !nickname.replace(/ /g, "")) return;
        if (this.players.find(function (obj) {
            return obj.nickname == nickname;
        })) {
            console.log(`->${this.roomid}: nickname repeated (${nickname})`);

            return {
                "type": "nickzajety"
            };
        }
        console.log(`->${this.roomid}: new player: ${nickname}`);
        ws.nickname = nickname;
        ws.roomid = this.roomid;
        ws.id = this.idcounter;
        this.idcounter++;

        this.players.push(ws);

        if (Object.keys(this.admin).length===0)
            this.admin = ws;
    }

    sendToEveryPlayer(msg) {
       this.players.forEach(player => {
           player.send(JSON.stringify(msg));
       });
    }

    sendGameInfo(type = "next", additional = {}) {
        var a = {
            "type": type,
            "admin": this.admin,
            "lastcard": this.lastcard,
            "movemakes": this.movemakes.nickname,
            "direction": this.direction,
            "players": this.nicknamesAndCards
        };

        this.players.forEach(player => {
            player.send(JSON.stringify({
                ...a,
                "yourcards": player.cards,
                "isitmymove": player.isitmymove,
                ...additional
            }));
        });
    }

    removePlayer(user) {
        if (user.cards) this.cards.push(...user.cards);
        this.players.splice(
            this.players.indexOf(user),
        1);
            
        // if removed user is an admin
        if (user.nickname == this.admin.nickname && this.players.length) {
            var r = random(this.players.length);
            var newadmin = this.players[r];
            this.sendToEveryPlayer({
                "type": "newmessage",
                "content": `${newadmin.nickname} zostaje adminem`
            });
        }

        // TODO: pick next player if it was removed one's turn 

        // if (this.isitmymove) {
        //     this.nextplayer = getnextplayer(this);
        // }

        if (this.isStarted) {
            this.sendGameInfo("playerhasquit", {
                "who": user.nickname
            });
        } else {
            this.sendToEveryPlayer({
                "type":"joinedtoroom",
                "players": this.allNicknames,
                "admin": this.admin.nickname
            });
        }

        this.sendToEveryPlayer({
            "type":"newmessage",
            "content": `${user.nickname} odszedł z pokoju`,
            "notify": true
        });

        if (this.players)
            if (!this.players[0]) {
                game.rooms.splice(this, 1);
                console.log("->"+this.roomid+": deleted (everyone has left)");
            }
    }

    isAdmin(user) {
        return user.nickname == this.admin.nickname;
    }

    get nextPlayer() {
        var mmpos = this.mmpos;
        while (this.cardsused) {
            if (this.direction == "cw") {
                mmpos++;
                if (mmpos >= this.players.length)
                    mmpos = 0;
            } else {
                mmpos--;
                if (mmpos < 0)
                    mmpos = this.players.length-1;
            }
            if (this.players[mmpos].cards.length != 0 || this.cardsused == 0)
                return this.players[mmpos];
        }
    }

    goToNextPlayer() {
        if (this.nextPlayer.block) {
            this.nextPlayer.block--;
            this.movemakes = this.nextPlayer;
            this.mmpos = this.players.indexOf(this.nextPlayer);
            this.goToNextPlayer();
        } else {
            this.movemakes = this.nextPlayer;
            this.mmpos = this.players.indexOf(this.nextPlayer);
        }
    }

    start() {
        if (this.isStarted) return;
        this.cards = uno.init();
        this.cardsused = [];
        this.cardsstack = [];
        this.lastcard = {};
        this.ingame = this.players.length;
        this.movemakes = {};
        this.direction = "cw";
        this.adding = 0;
        this.blocking = 0;
        this.scoreboard = [];

        var firstcard = this.cards[random(19 * 4)];
        this.cardsstack.push(firstcard);
        this.cards.splice(
            this.cards.indexOf(firstcard),
        1);

        this.mmpos = random(this.players.length);
        var firstplayer = this.players[this.mmpos];
        console.log("->"+this.roomid+": first move belongs to "+firstplayer.nickname);

        this.players.forEach(player => {
            // draw cards for everyone
            var playercards = [];
            for (var i = 0; i < 7; i++) {
                var newcard = this.cards[random(this.cards.length)];
                playercards.push(newcard);
                this.cardsused.push(newcard);
                this.cards.splice(
                    this.cards.indexOf(newcard),
                1);
            }

            player.isitmymove = false;
            if (player.nickname == firstplayer.nickname) player.isitmymove = true;

            player.cards = playercards;
        });

        this.lastcard = firstcard;
        this.movemakes = firstplayer;
        this.isStarted = true;

        this.sendGameInfo();
    }

    // movemade

    canBePlaced(card) {
        if (card.content != "skip" && this.blocking) return false;
        if (!card.add && this.adding) return false;

        if (card.color == this.lastcard.color) return true;
        if (card.content == this.lastcard.content) return true;
        if (card.colorchange == true) return true;
        if (card.color == this.lastcard.newcolor) return true;
        if (msg.card.add && this.lastcard.add) return true;
        return false;
    }

    move(user, msg) {
        if (user.nickname != this.movemakes.nickname) return;
        if (this.blocking && msg.card.content != "skip" && msg.content == "dobierzkarte") {
            user.block = this.blocking-1;
            this.blocking = 0;

            this.goToNextPlayer();
            console.log("move makes:"+this.movemakes.nickname);
            if (this.isStarted) {
                this.sendGameInfo();
            }
        } else if (
            this.canBePlaced(msg.card) ||
            msg.content == "dobierzkarte"
        ) {
            console.log("->"+user.roomid+": "+user.nickname+" move finished");
            console.log("->"+user.roomid+": "+user.nickname+"'s move: "+msg.card);

            // var nextplayer = {};
            // var playerinfos = [];
            // var player = user;

            switch (msg.content) {
                case "dobierzkarte":
                    this.drawCard(user);
                    break;
                case "wybierzkarte":
                    this.placeCard(user, msg.card)
                    break;
            }

            // debug purposes - check if amount of cards is correct
            // TODO: what if we run out of cards?

            console.log(
                this.roomid+": "+
                this.cards.length+" | "+
                this.cardsused.length+" | "+
                this.cardsstack.length+" -> "+
                (this.cards.length+
                this.cardsused.length+
                this.cardsstack.length)
            );
            if ((this.cards.length+
            this.cardsused.length+
            this.cardsstack.length) != 108)
                console.log("->"+user.roomid+": !!!!!!!!!!");

            // end of debug

            this.goToNextPlayer();
            console.log("move makes:"+this.movemakes.nickname);
            if (this.isStarted) {
                this.sendGameInfo();
            }
        }
    }

    drawCard(user) {
        if (!this.adding) this.adding = 1;
        while (this.adding) {
            if (this.cards == 0) {
                this.cards = this.cardsstack.splice(0); // copy of cardsstack
                this.cardsstack = [];
            }

            var r = random(this.cards.length);
            user.cards.push(this.cards[r]);
            this.cardsused.push(this.cards[r]);
            this.cards.splice(r, 1);
            this.adding--;
        }
    }

    placeCard(user, card) {
        console.log(card);
        if (!user.cards.find(function (obj) {
            return obj.id == card.id
        })) {
            console.log("->"+this.roomid+": "+user.nickname+" wanted to use card that doesn't compare");
            return false;
        }

        switch (card.type) {
            case "normal":
            case "newcolor":
                // nic
                break;
            case "skip":
                // nextplayer = getnextplayer();
                this.blocking += 1;
                break;
            case "reverse":
                this.direction = (this.direction == "cw") ? "ccw" : "cw";
                break
            case "add2":
                this.adding += 2;
                break;
            case "add4color":
                this.adding += 4;
                break;
            default:
                console.log("->"+user.roomid+": unknown card type: "+msg.card.type);
                return;
        }

        user.cards.splice(
            user.cards.findIndex(function (obj) {
                return obj.id == card.id;
            })
        , 1);

        this.lastcard = card;
        this.cardsstack.push(card);
        this.cardsused.splice(
            this.cardsused.indexOf(card),
        1);

        if (this.adding && card.type != "add2" && card.type != "add4color") {
            this.drawCard(user);
        }
    }
}

// 
// EXPRESS
// 

app.get("/newroom/:nickname", function (req,res) {
    var nickname = req.params["nickname"];
    // create new room's id
    var id = 0;
    var roomids = [];
    game.rooms.forEach(room=>{roomids.push(room.roomid)});
    roomids = roomids.sort();
    roomids.forEach(x=>{
        if(id==x)id++
    });

    if (id >= game.maxrooms) {
        res.send("nope"); // too many rooms
        return;
    }

    game.rooms[id] = new Room(id);
    res.redirect("/play.html?room="+id+"&nickname="+nickname);
    console.log(game.rooms[id]);

    setTimeout(()=>{
        if (typeof game.rooms[id] != "undefined") {
            if (!game.rooms[id].players) {
                game.rooms.splice(id);
                console.log("removed room %s for idleness", id);
            }
        }
    }, 5000);
});

app.get("/getrooms", function (req,res) {
    // console.log(game.rooms);
    var roomlist = [];
    game.rooms.forEach((room)=>{
        if (!room.isStarted)
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
        var msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            return;
        }
        if (msg.type != "pong") console.log('received: %s', message);
        var user = this;
        switch (msg.type) {
            case "joinedtoroom":
                room = game.rooms[msg.roomid];
                if (!room) return;

                var result = room.addPlayer(user, msg.content);
                if (result) return user.send(JSON.stringify(result));

                // user.isAlive = true;
                // user.on("pong", function () {
                //   this.isAlive = true;
                // });

                user.on("close", function () {
                    console.log("->"+this.roomid+": "+this.nickname+" has left");
                    room.removePlayer(this);
                });

                setTimeout(() => {
                    user.send(JSON.stringify({
                        "type":"ping",
                        "random": Math.random()
                    }));
                }, 30000);

                room.sendToEveryPlayer({
                    "type":"joinedtoroom",
                    "players": room.allNicknames,
                    "admin": room.admin.nickname
                });
                room.sendToEveryPlayer({
                    "type":"newmessage",
                    "content": `${user.nickname} dołączył do pokoju`,
                    "notify": true
                });
                break;
            case "startgame":
                if (!user.nickname) return;
                console.log(`->${user.roomid}: ${user.nickname} tries to start game`);
                room = game.rooms[user.roomid];
                if (room.isStarted) return;
                if (room.isAdmin(user)) {
                    room.start();
                    room.sendToEveryPlayer({
                        "type":"newmessage",
                        "content": "rozpoczęto rozgrywkę"
                    })
                }
                break;
            case "movemade":
                var room = game.rooms[user.roomid];
                if (!msg.card) msg.card = {};
                room.move(user, msg);
                // if (user.nickname != room.movemakes.nickname) return;
                // else if (
                //     room.lastcard.color ==
                //     msg.card.color ||

                //     room.lastcard.content ==
                //     msg.card.content ||

                //     msg.card.colorchange ==
                //     true ||

                //     room.lastcard.newcolor ==
                //     msg.card.color ||

                //     (msg.card.add && room.lastcard.add) ||

                //     msg.content == "dobierzkarte"
                // ) {
                // console.log("->"+user.roomid+": "+user.nickname+" move finished");
                // console.log("->"+user.roomid+": "+user.nickname+"'s move: "+msg.content);

                // var nextplayer = {};
                // var playerinfos = [];

                // // var player = room.players[
                // //     room.players.indexOf(user)
                // // ];
                // var player = user;

                // switch (msg.content) {
                //     case "dobierzkarte":
                //     if (!room.adding) room.adding = 1;

                //     while (room.adding) {
                //         if (room.cards == 0) {
                //         room.cards = room.cardsstack.splice(0);
                //         room.cardsstack = [];
                //         }

                //         var r = random(room.cards.length);
                //         player.cards.push(room.cards[r]);
                //         room.cardsused.push(room.cards[r]);
                //         room.cards.splice(r, 1);
                //         room.adding--;
                //     }
                //     break;
                //     case "wybierzkarte":
                //     console.log(msg.card);
                //     if (player.cards.find(function (obj) {
                //         return obj.id == msg.card.id
                //     })) {
                //         switch (msg.card.type) {
                //         case "normal":
                //         case "newcolor":
                //             // tu nic
                //             break;
                //         case "skip":
                //             nextplayer = getnextplayer(room);
                //             break;
                //         case "reverse":
                //             if (room.direction == "cw")
                //             room.direction = "ccw"
                //             else if (room.direction == "ccw")
                //             room.direction = "cw"
                //             break;
                //             case "add2":
                //             room.adding += 2;
                //             break;
                //             case "add4color":
                //             room.adding += 4;
                //             break;
                //         default:
                //             console.log("->"+user.roomid+": unknown card type: "+msg.card.type);
                //             return;
                //         }
                //         player.cards.splice(
                //         player.cards.findIndex(function (obj) {
                //             return obj.id == msg.card.id;
                //         })
                //         , 1);
                //         if (room.lastcard.newcolor)
                //         room.lastcard.newcolor = "";

                //         room.lastcard = msg.card;
                //         // filecontent.lastcard = msg.card;

                //         room.cardsstack.push(msg.card);
                //         room.cardsused.splice(
                //         room.cardsused.indexOf(msg.card),
                //         1); // DEBUG: to może powodować błędy, może trzeba bedzie uzyc .find

                //         if (
                //         room.adding &&
                //         msg.card.type != "add2" &&
                //         msg.card.type != "add4color"
                //         ) {
                //         while (room.adding) {
                //             if (room.cards == 0) {
                //             room.cards = room.cardsstack.splice(0);
                //             room.cardsstack = [];
                //             }

                //             var r = random(room.cards.length);
                //             player.cards.push(room.cards[r]);
                //             room.cardsused.push(room.cards[r]);
                //             room.cards.splice(r, 1);
                //             room.adding--;
                //         }
                //         }
                //     } else console.log("->"+user.roomid+": "+user.nickname+" wanted to use card that doesn't compare");
                //     break;
                //     default:
                //     console.log("->"+user.roomid+": unknown card content from "+user.nickname+" : "+msg.content);
                // }

                // console.log(
                //     user.roomid+": "+
                //     room.cards.length+" | "+
                //     room.cardsused.length+" | "+
                //     room.cardsstack.length+" -> "+
                //     (room.cards.length+
                //     room.cardsused.length+
                //     room.cardsstack.length)
                // );
                // if ((room.cards.length+
                // room.cardsused.length+
                // room.cardsstack.length) != 108)
                //     console.log("->"+user.roomid+": !!!!!!!!!!");

                // if (room.movemakes.cards.length == 0) {
                //     room.ingame--;
                //     room.scoreboard.push(user.nickname);
                //     console.log("->"+user.roomid+": "+user.nickname+" has used all of his/her cards");
                //     if (room.ingame <= 1) {
                //     var lastplayer = room.players.find(function (obj) {
                //         return room.scoreboard.indexOf(obj.nickname)==-1;
                //     });
                //     if (lastplayer) {
                //         room.scoreboard.push(lastplayer.nickname);
                //     }
                //     room.isStarted = false;

                //     var playerinfos = [];
                //     room.players.forEach(function (player, index) {
                //         playerinfos.push(player.nickname)
                //     });
                //     room.players.forEach(function (player, index) {
                //         player.send(JSON.stringify({
                //         "type":"gameover",
                //         "content": room.scoreboard,
                //         "players": playerinfos,
                //         "admin": room.admin.nickname
                //         }));
                //     });
                //     console.log("->"+user.roomid+": game has ended");
                //     }
                // }

                // nextplayer = getnextplayer(room);

                // // filecontent.players.forEach(function (fileplayer, index) {
                // //     if (user.nickname == fileplayer.nickname) { // ram == file
                // //     fileplayer.cards = player.cards;
                // //     }
                // // });

                // room.players.forEach(function (player, index) {
                //     playerinfos.push({nickname:player.nickname, cardsquantity:player.cards.length});
                // });

                // room.movemakes = nextplayer;

                // if (room.isStarted)
                //     room.players.forEach(function (player, index) {
                //     player.send(JSON.stringify({
                //         "type": "next",
                //         "yourcards": player.cards,
                //         "lastcard": room.lastcard,
                //         "movemakes": room.movemakes.nickname,
                //         "direction": room.direction,
                //         "isitmymove": player.isitmymove,
                //         "players": playerinfos
                //     }));
                //     });

                // // filecontent.cards = game.rooms[user.roomid].cards;
                // // filecontent.cardsused = game.rooms[user.roomid].cardsused;
                // // filecontent.lastcard = game.rooms[user.roomid].lastcard;
                // // filecontent.movemakes = game.rooms[user.roomid].movemakes.nickname;
                // // filecontent.direction = game.rooms[user.roomid].direction;

                // console.log("->"+user.roomid+": "+nextplayer.nickname+" has the next move");
                // }
                break;
            case "chatmessage":
                if (!user.roomid || msg.content == "") return;
                var newcontent = '\n'+user.nickname+": "+msg.content;
                game.rooms[user.roomid].players.forEach(function (player, index) {
                    player.send(JSON.stringify({
                    "type": "newmessage",
                    "content": newcontent,
                    "notify": true
                    }));
                });
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