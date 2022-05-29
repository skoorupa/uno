const express = require('express');
const path = require('path');
const WebSocket = require('ws');
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

// app.set("app", path.join(__dirname, "app"));

app.get("/newroom/:nickname", function (req,res) {
    var nickname = req.params["nickname"];
    // create new room's id
    var id = 1;
    var roomids = [];
    game.rooms.forEach(room=>{roomids.push(room.id)});
    roomids = roomids.sort((a, b) => {
        return a - b;
    });
    roomids.forEach(x=>{if(id==x)id++});

    if (id > game.maxrooms) {
        res.send("nope"); // too many rooms
        return;
    }

    var room = {
        id: id
    };

    game.rooms[id] = room;
    res.redirect("/play.html?room="+id+"&nickname="+nickname);
    console.log(game.rooms);

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
    var roomlist = [];
    game.rooms.forEach((room)=>{
        roomlist.push(
            (({ id, host }) => ({ id, host }))(room)
        );
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

const wss = new WebSocket.Server({noServer: true});
console.log("ws server running");

var users = [];
wss.on('connection', function connection(ws) {
    ws.on("message", message => {
        var data;
        try {
            data = JSON.parse(message.toString()); 
        } catch (error) {
            return;
        }
        
        switch(data.type) {
            case "ping":
                ws.send(JSON.stringify({type:"pong"}));
            break;
            case "test-chat-message":
                users.forEach(user => {
                    user.send(message.toString());
                });
                console.log(message.toString());
            break;
            case "test-chat-join":
                var nickname = data.nickname;
                ws.nickname = nickname;
                users.forEach(user => {
                    user.send(JSON.stringify({
                        type: "test-chat-join",
                        nickname: "Serwer",
                        message: nickname+" dołączył do pokoju!"
                    }));
                });
                console.log(nickname+" joined the chat");
            break;
        }
    });
    
    ws.on('close', function () {
        users.splice(users.indexOf(this),1);
        users.forEach(user => {
            user.send(JSON.stringify({
                nickname: "Serwer",
                message: this.nickname+" opuścił pokój!"
            }));
        });
        console.log(this.nickname+" left the chat");
    })
    ws.on('error', function(){
        users.splice(users.indexOf(this),1);
        user.send(JSON.stringify({
            nickname: "Serwer",
            message: this.nickname+" opuścił pokój!"
        }));
        console.log(this.nickname+" left the chat");
    });
    users.push(ws);
});

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