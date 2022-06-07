const urlparams = new URLSearchParams(window.location.search);

var room = {
  roomid: urlparams.get("room"),
  username: urlparams.get("nickname"),
  mycards:[],
  lastcard:null,
  direction:"",
  movemakes:null,
  players:[]
};

if (room.roomid) document.title = room.roomid + " - graj UNO";

const cardbox = document.getElementById("mojekarty");
const leaderboardbox = document.getElementById("leaderboard");

const sounds = {};
sounds.message = new Audio("sounds/message.mp3");
sounds.yourturn = new Audio("sounds/yourturn.mp3");

const protocol = (window.location.protocol == "https:") ? "wss://" : "ws://";
var connection = new WebSocket(protocol+window.location.hostname, ['soap', 'xmpp']);
connection.onmessage = function (event) {
  var msg = JSON.parse(event.data);
  console.log(msg);
  switch (msg.type) {
    case "next":
      // "yourcards": playercards,
      // "lastcard": lastcard,
      // "player": firstplayer.nickname,
      // "direction": "ccw", // counterclockwise
      // "isitmymove": isitmymove
      room.mycards = msg.yourcards;
      room.lastcard = msg.lastcard;
      room.direction = msg.direction;
      room.movemakes = msg.movemakes;
      room.players = msg.players;
      if (room.movemakes==room.username) sounds.yourturn.play();

      updateUI(msg);
      break;
    case "newmessage":
      var chat = document.getElementById("chat");
      chat.innerHTML += msg.content+"<br>";
      chat.scrollTo(0, chat.scrollHeight);
      if (msg.notify) sounds.message.play()
      break;
    case "joinedtoroom":
      updateLeaderboard(msg);
      break;
    case "playerhasquit":
      updateUI(msg);
      break;
    case "nickzajety":
      alert("Ten nick jest już zajęty.");
      break;
    case "gameover":
      updateLeaderboard(msg);

      startbtn.style.display = "block";

      canvas.ctx.clearRect(0, 0, 700, 700);
      canvas.ctx.fillText(
        "Koniec gry!",
      700/2, 50);
      for (var i = 0; i < msg.content.length; i++) {
        canvas.ctx.fillText(
          (i+1)+". "+msg.content[i],
        700/2, 70+22*(i+1));
      }
      break;
    case "ping":
      connection.send(JSON.stringify({
        "type": "pong",
        "random": Math.random()
      }));
      break;
    default:
      console.log("nieznana wiadomość "+msg.type);
      console.log(msg.content);
  }
};

connect();

// share link

var sharelink = document.getElementById("sharelink");
var sharebtn = document.getElementById("sharebtn");
sharelink.value = location.origin+"/?inviteid="+room.roomid;
sharelink.addEventListener("click", function () {
  this.select();
});
sharebtn.addEventListener("click", function () {
  navigator.clipboard.writeText(location.origin+"/?inviteid="+room.roomid);
});

// start btn

var startbtn = document.getElementById("startbtn");
startbtn.addEventListener("click", function () {
  connection.send('{"type":"startgame"}');
});

function updateLeaderboard(msg) {
  leaderboardbox.innerHTML = "";
  console.log("updateLeaderboard");
  console.log(msg);

  msg.players.forEach(function (item, index) {
    var trow = document.createElement("div");
    var tnickname = document.createElement("span");
    var tcards = document.createElement("span");

    trow.classList.add("leaderboard_row");
    tnickname.classList.add("leaderboard_nickname");
    tcards.classList.add("leaderboard_cards");

    tnickname.innerHTML = item.nickname;
    tcards.innerHTML = item.cardsquantity;
    
    trow.appendChild(tnickname);
    if (item.cardsquantity) trow.appendChild(tcards);
    leaderboardbox.appendChild(trow);
  });
  if (msg.admin == room.username && !msg.lastcard)
    startbtn.style.display = "block";
  else 
    startbtn.style.display = "none";
}

function connect() {
  if (room.username==undefined) return;

  if(isFinite(room.roomid) && room.username.replace(/ /g, "") && room.username) {
    console.log("wysylam zapytanie");
    if (connection.readyState != 1)
      connection.addEventListener('open', function (event) {
        connection.send(JSON.stringify({
          "type": "joinedtoroom",
          "content": room.username,
          "roomid": room.roomid,
          "path": "."+location.pathname
        }));
      });
    else
      connection.send(JSON.stringify({
        "type": "joinedtoroom",
        "content": room.username,
        "roomid": room.roomid,
        "path": "."+location.pathname
      }));
  }
}

//
// CANVAS
//

class Canvas {
  constructor(canvas, d) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.height = canvas.height;
    this.width = canvas.width;
    this.multiplier = this.height/10 - 10;
    this.diameter = d;
    this.margin = (this.height - this.multiplier*this.diameter)/2;

    function spot(a,b,c, canvas) {
      return [a*canvas.multiplier+canvas.margin, b*canvas.multiplier+canvas.margin, c]
    }
    this.spots = [
      spot(4, 8, 30, this),
      spot(1, 7, 20, this),
      spot(0, 5, 20, this),
      spot(0, 3, 20, this),
      spot(1, 1, 20, this),
      spot(4, 0,-10, this),
      spot(7, 1, 20, this),
      spot(8, 3, 20, this),
      spot(8, 5, 20, this),
      spot(7, 7, 20, this)
    ];
  }
}

var canvas = new Canvas(document.getElementById('c'), 8);

canvas.ctx.font="22px Arial";
canvas.ctx.textAlign="center";
canvas.ctx.textBaseline="hanging";

canvas.ctx.fillText(
  "Witaj w UNO! Jesteś w pokoju nr "+
  room.roomid,
700/2, 50);

function updateUI(msg) {
  cardbox.innerHTML = "";
  leaderboardbox.innerHTML = "";
  startbtn.style.display = "none";
  canvas.ctx.clearRect(0, 0, 700, 700);
  canvas.ctx.moveTo(
    canvas.spots[canvas.spots.length-1][0],
    canvas.spots[canvas.spots.length-1][1]
  );

  //

  // for (var i = 0; i < canvas.spots.length; i++)
  //   canvas.ctx.lineTo(canvas.spots[i][0], canvas.spots[i][1]);

  // canvas.ctx.stroke();

  //

  var myplayerindex = msg.players.findIndex(function (obj) {
    return obj.nickname == room.username;
  });

  var places = placeevenly(msg.players.length);
  updateLeaderboard(msg);

  msg.players.turnLeft(myplayerindex).forEach(function (item, index) {
    canvas.ctx.fillStyle = "black";
    canvas.ctx.fillText(item.nickname, canvas.spots[places[index]][0], canvas.spots[places[index]][1]+canvas.spots[places[index]][2]);
    canvas.ctx.fillStyle = "#941D01";

    if (item.nickname == room.movemakes) {
      var w = canvas.ctx.measureText(item.nickname).width;
      canvas.ctx.strokeRect(
        canvas.spots[places[index]][0] - w/2 - 10,
        canvas.spots[places[index]][1]+canvas.spots[places[index]][2] - 5,
        w+20,
        30
      );
    }
    var ilekart = item.cardsquantity;

    var c = canvas.spots[places[index]][1]+canvas.spots[places[index]][2]-20;
    if (ilekart % 2 == 0) {
      for (var i = 0; i < ilekart/2; i++) {
        var a = canvas.spots[places[index]][0] - 8*(i)-1-6;
        var b = canvas.spots[places[index]][0] + 8*(i)+1;
        canvas.ctx.fillRect(a, c, 6, 7);
        canvas.ctx.fillRect(b, c, 6, 7);
        canvas.ctx.strokeRect(a, c, 6, 7);
        canvas.ctx.strokeRect(b, c, 6, 7);
      }
    } else {
      var x = canvas.spots[places[index]][0] - 3;
      canvas.ctx.fillRect(x, c, 6, 7);
      canvas.ctx.strokeRect(x, c, 6, 7);
      for (var i = 0; i < (ilekart-1)/2; i++) {
        var a = canvas.spots[places[index]][0] - 8*(i)-5-6;
        var b = canvas.spots[places[index]][0] + 8*(i)+5;
        canvas.ctx.fillRect(a, c, 6, 7);
        canvas.ctx.fillRect(b, c, 6, 7);
        canvas.ctx.strokeRect(a, c, 6, 7);
        canvas.ctx.strokeRect(b, c, 6, 7);
      }
    }
  });

  if (msg.lastcard.colorchange) {
    var colors = {
      "red": "#ff0000",
      "blue": "#256fa1",
      "yellow": "#c8be2e",
      "green": "#25a049"
    }
    canvas.ctx.fillStyle = colors[msg.lastcard.newcolor];
    canvas.ctx.fillRect(700/2-15-10, 700/2-25-10, 50, 70);
  }

  var lastcardimg = document.createElement("img");
  lastcardimg.setAttribute("src", "img/"+msg.lastcard.color+msg.lastcard.content+".png");
  lastcardimg.onload = function () {
    canvas.ctx.drawImage(lastcardimg, 700/2-15, 700/2-25, 30, 50);
  }

  msg.yourcards.forEach(function (item, index) {
    var cardimg = document.createElement("img");
    cardimg.setAttribute("src", "img/"+item.color+item.content+".png");

    if (msg.isitmymove)
      cardimg.addEventListener("click", function () {
        wybierzkarte(item)
      });
    cardbox.appendChild(cardimg);
  });

  var newcardimg = document.createElement("img");
  newcardimg.setAttribute("src", "img/dobierzkarte.png");
  if (msg.isitmymove)
    newcardimg.addEventListener("click",dobierzkarte);
  cardbox.appendChild(newcardimg);
}

function dobierzkarte() {
  connection.send(JSON.stringify({
    "type": "movemade",
    "content": "dobierzkarte",
    "roomid": room.roomid,
    "username": room.username,
    "path": "."+location.pathname
  }));
}

function wybierzkarte(card) {
  if (room.mycards.findIndex(function (obj) {
    return obj.id == card.id;
  }) != -1 &&
  (room.lastcard.color == card.color ||
  room.lastcard.content == card.content ||
  room.lastcard.newcolor == card.color ||
  card.color == "black" ||
  (card.add && room.lastcard.add)
  )) {
    if (!card.newcolor && card.colorchange) return pokazwyborkart(card);
    connection.send(JSON.stringify({
      "type": "movemade",
      "content": "wybierzkarte",
      "card": card,
      "roomid": room.roomid,
      "username": room.username,
      "path": "."+location.pathname
    }));
  }
}

function pokazwyborkart(card) {
  document.getElementById('choosecolorback').style.display = "block";
  document.getElementById('choosecolor').addEventListener("change", function () {
    wybierzkolor(card);
  }, {once: true});
}

function wybierzkolor(card) {
  card.newcolor = document.getElementById('choosecolor').kolor.value;
  wybierzkarte(card);
  document.getElementById('choosecolorback').style.display = "none";
  document.getElementById('choosecolor').reset()
}

document.getElementById("chatinput").addEventListener("keydown", Event=>{
  if (Event.key == "Enter") sendmsg();
});

function sendmsg() {
  var cinput = document.getElementById("chatinput");
  if (cinput.value == "") return;
  if (room.roomid && room.username) {
    connection.send(JSON.stringify({
      "type": "chatmessage",
      "content": cinput.value,
      "roomid": room.roomid,
      "username": room.username,
      "path": "."+location.pathname
    }));
    cinput.value = "";
  }
}

Array.prototype.turnLeft = function(count=1) {
  for (var i=0;i<count;i++) this.push(this.shift());
  return this;
};

function placeevenly(x, y=10) {
  var r = [0];
  var a = 0;
  var j = y/x;
  for (var i=1;i<x;i++) {
  	r.push(r[i-1]+j);
  }
  
  return r.map(item=>{return Math.floor(item)});
}
