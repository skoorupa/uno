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
      prepare(msg);
      break;
    case "playerhasquit":
      updateUI(msg);
      break;
    case "nickzajety":
      alert("Ten nick jest już zajęty.");
      break;
    case "gameover":
      prepare(msg);

      ctx.clearRect(0, 0, 700, 700);
      ctx.fillText(
        "Koniec gry!",
      700/2, 50);
      for (var i = 0; i < msg.content.length; i++) {
        ctx.fillText(
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

var sharelink = document.getElementById("sharelink")
var sharebtn = document.getElementById("sharebtn")
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

function prepare(msg) {
  leaderboardbox.innerHTML = "";
  cardbox.innerHTML = "";

  msg.players.forEach(function (item, index) {
    var trow = document.createElement("tr");
    var tnickname = document.createElement("td");

    tnickname.innerHTML = item;
    trow.appendChild(tnickname);
    leaderboardbox.appendChild(trow);
  });
  if (msg.admin == room.username) {
    startbtn.style.display = "block";
  }
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

var c = document.getElementById("c");
ctx = c.getContext("2d");

var mnoznik  = 700/10-10;
var srednica = 8;
var margin = (700 - (mnoznik*srednica))/2;
var miejsca = [
  [4*mnoznik+margin, 8*mnoznik+margin, 30],
  [1*mnoznik+margin, 7*mnoznik+margin, 20],
  [0*mnoznik+margin, 5*mnoznik+margin, 20],
  [0*mnoznik+margin, 3*mnoznik+margin, 20],
  [1*mnoznik+margin, 1*mnoznik+margin, 20],
  [4*mnoznik+margin, 0*mnoznik+margin,-10],
  [7*mnoznik+margin, 1*mnoznik+margin, 20],
  [8*mnoznik+margin, 3*mnoznik+margin, 20],
  [8*mnoznik+margin, 5*mnoznik+margin, 20],
  [7*mnoznik+margin, 7*mnoznik+margin, 20]
];

var twojemiejsce = [4 *mnoznik+margin, 8*mnoznik+margin, 30];

ctx.font="22px Arial";
ctx.textAlign="center";
ctx.textBaseline="hanging";

ctx.fillText(
  "Witaj w UNO! Jesteś w pokoju nr "+
  room.roomid,
700/2, 50);

function updateUI(content) {
  cardbox.innerHTML = "";
  ctx.clearRect(0, 0, 700, 700);
  ctx.moveTo(
    miejsca[miejsca.length-1][0],
    miejsca[miejsca.length-1][1]
  );

  // for (var i = 0; i < miejsca.length; i++)
  //   ctx.lineTo(miejsca[i][0], miejsca[i][1]);

  // ctx.stroke();
  leaderboardbox.innerHTML = "";

  var myplayerindex = content.players.findIndex(function (obj) {
    return obj.nickname == room.username;
  });

  var places = placeevenly(content.players.length);

  content.players.turnLeft(myplayerindex).forEach(function (item, index) {
    var trow = document.createElement("tr");
    var tnickname = document.createElement("td");
    var tcards = document.createElement("td");

    tnickname.innerHTML = item.nickname;
    tcards.innerHTML = item.cardsquantity;
    trow.appendChild(tnickname);
    trow.appendChild(tcards);
    leaderboardbox.appendChild(trow);

    ctx.fillStyle = "black";
    ctx.fillText(item.nickname, miejsca[places[index]][0], miejsca[places[index]][1]+miejsca[places[index]][2]);
    ctx.fillStyle = "#941D01";

    if (item.nickname == room.movemakes) {
      var w = ctx.measureText(item.nickname).width;
      ctx.strokeRect(
        miejsca[places[index]][0] - w/2 - 10,
        miejsca[places[index]][1]+miejsca[places[index]][2] - 5,
        w+20,
        30
      );
    }
    var ilekart = item.cardsquantity;

    if (ilekart % 2 == 0) {
      for (var i = 0; i < ilekart/2; i++) {
        ctx.fillRect(
          miejsca[places[index]][0] - 8*(i)-1-6,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
        ctx.fillRect(
          miejsca[places[index]][0] + 8*(i)+1,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
        ctx.strokeRect(
          miejsca[places[index]][0] - 8*(i)-1-6,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
        ctx.strokeRect(
          miejsca[places[index]][0] + 8*(i)+1,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
      }
    } else {
      ctx.fillRect(
        miejsca[places[index]][0] - 3,
        miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
      );
      ctx.strokeRect(
        miejsca[places[index]][0] - 3,
        miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
      );
      for (var i = 0; i < (ilekart-1)/2; i++) {
        ctx.fillRect(
          miejsca[places[index]][0] - 8*(i)-5-6,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
        ctx.fillRect(
          miejsca[places[index]][0] + 8*(i)+5,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
        ctx.strokeRect(
          miejsca[places[index]][0] - 8*(i)-5-6,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
        ctx.strokeRect(
          miejsca[places[index]][0] + 8*(i)+5,
          miejsca[places[index]][1]+miejsca[places[index]][2]-20, 6, 7
        );
      }
    }
  });

  if (content.lastcard.colorchange) {
    var colors = {
      "red": "#ff0000",
      "blue": "#256fa1",
      "yellow": "#c8be2e",
      "green": "#25a049"
    }
    ctx.fillStyle = colors[content.lastcard.newcolor];
    ctx.fillRect(700/2-15-10, 700/2-25-10, 50, 70);
  }

  var lastcardimg = document.createElement("img");
  lastcardimg.setAttribute("src", "img/"+content.lastcard.color+content.lastcard.content+".png");
  lastcardimg.onload = function () {
    ctx.drawImage(lastcardimg, 700/2-15, 700/2-25, 30, 50);
  }

  content.yourcards.forEach(function (item, index) {
    var cardimg = document.createElement("img");
    cardimg.setAttribute("src", "img/"+item.color+item.content+".png");
    cardimg.addEventListener("click", function () {
      wybierzkarte(item)
    });
    cardbox.appendChild(cardimg);
  });

  var newcardimg = document.createElement("img");
  newcardimg.setAttribute("src", "img/dobierzkarte.png");
  newcardimg.addEventListener("click", function () {
    dobierzkarte()
  });
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

Array.prototype.turnLeft = function (count) {
  var array = this.slice();
  for (var i = 0; i < count; i++) {
    var movedobj = array[0];
    array = array.concat(movedobj)
    array.splice(0,1);
  }
  return array;
};

function placeevenly(x) {
  var a = 10 % x;
  var b = Math.floor(10 / x);
  var r = [0];
  console.log(a+"a "+b+"b");
  for (var i=1;i<x;i++) {
    if(a && i!=(Math.floor(b/2)+1)) {
      r[i] = r[i-1] + b + 1;
      a--;
    }
    else r[i] = r[i-1]+b;
  }
  return r;
}
