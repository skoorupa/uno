function getsearch(arg) {
  var s = location.search.substr(1).split("&");
  var a = {};
  s.forEach(function (item, index) {
    var x = item.split("=");
    a[x[0]] = x[1];
  });

  return a[arg];
}

function checkenter(input, key, f) {
  if(key.key == "Enter") f();
}

function playsound(src) {
  var s = new Audio(src);
  s.play();
}

function getcss(el, p) {
    var style = window.getComputedStyle(el);
    var value = style.getPropertyValue(p);
    if (value.substr(
      value.length-2,
      value.length-1
    ) == "px") {
      value = value.substr(0, value.length-2);
      value = Number(value);
    }
    return value;
}

var roomid = getsearch("room");
var username = decodeURI(getsearch("nickname"));
if (roomid) document.title = roomid + " - graj UNO";

var cardbox = document.getElementById("mojekarty");

var protocol = (window.location.protocol == "https:") ? "wss://" : "ws://";
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
      mycards = msg.yourcards;
      lastcard = msg.lastcard;
      direction = msg.direction;
      movemakes = msg.movemakes;
      players = msg.players;
      if (movemakes==username) playsound("sounds/yourturn.mp3");

      update(msg);
      break;
    case "newmessage":
      document.getElementById("chat").value += msg.content;
      if (msg.notify) {
        playsound("sounds/message.mp3");
      }
      break;
    case "joinedtoroom":
      document.getElementById("players").innerHTML = "";

      cardbox.innerHTML = "";
      var invitetxt = document.createElement("span");
      invitetxt.innerHTML = "zaproś znajomych:";
      var inviteinput = document.createElement("input");
      inviteinput.value = location.origin+"/?inviteid="+roomid;
      inviteinput.setAttribute("readonly","readonly");
      inviteinput.addEventListener("click", function () {
        this.select();
      });
      invitetxt.appendChild(inviteinput);
      cardbox.appendChild(invitetxt);

      msg.content.forEach(function (item, index) {
        var trow = document.createElement("tr");
        var tnickname = document.createElement("td");

        tnickname.innerHTML = item;
        trow.appendChild(tnickname);
        document.getElementById("players").appendChild(trow);
      });
      if (msg.admin == username) {
        var startbtn = document.createElement("button");
        startbtn.innerHTML = "Start";
        startbtn.addEventListener("click", function () {
          connection.send('{"type":"startgame"}');
        });
        cardbox.appendChild(startbtn);
      }
      break;
    case "playerhasquit":
      update(msg);
      break;
    case "nickzajety":
      alert("Ten nick jest już zajęty.");
      connect(roomid, username);
      break;
    case "gameover":
      cardbox.innerHTML = "";
      var invitetxt = document.createElement("span");
      invitetxt.innerHTML = "zaproś znajomych:";
      var inviteinput = document.createElement("input");
      inviteinput.value = location.origin+"/?inviteid="+roomid;
      inviteinput.setAttribute("readonly","readonly");
      inviteinput.addEventListener("click", function () {
        this.select();
      });
      invitetxt.appendChild(inviteinput);
      cardbox.appendChild(invitetxt);

      if (msg.admin == username) {
        var startbtn = document.createElement("button");
        startbtn.innerHTML = "Start";
        startbtn.addEventListener("click", function () {
          connection.send('{"type":"startgame"}');
        });
        cardbox.appendChild(startbtn);
      }

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

var mycards, lastcard, direction;
connect(roomid, username);

function connect(roomid, username) {
  console.log(username);
  if (username==undefined) username = "";

  if(isFinite(roomid) && username.replace(/ /g, "") && username) {
    console.log("wysylam zapytanie");
    if (connection.readyState != 1)
      connection.addEventListener('open', function (event) {
        connection.send(JSON.stringify({
          "type": "joinedtoroom",
          "content": username,
          "roomid": roomid,
          "path": "."+location.pathname
        }));
      });
    else
      connection.send(JSON.stringify({
        "type": "joinedtoroom",
        "content": username,
        "roomid": roomid,
        "path": "."+location.pathname
      }));
  }
}

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
  "Witaj w UNO!\
  Jesteś w pokoju nr "+
  roomid,
700/2, 50);

for (var i = 0; i < miejsca.length; i++)
  ctx.lineTo(miejsca[i][0], miejsca[i][1]);

//ctx.fillText("test", twojemiejsce[0], twojemiejsce[1]+20);
function update(content) {
  cardbox.innerHTML = "";
  ctx.clearRect(0, 0, 700, 700);
  ctx.moveTo(
    miejsca[miejsca.length-1][0],
    miejsca[miejsca.length-1][1]
  );

  for (var i = 0; i < miejsca.length; i++)
    ctx.lineTo(miejsca[i][0], miejsca[i][1]);

  ctx.stroke();
  document.getElementById("players").innerHTML = "";

  var myplayerindex = content.players.findIndex(function (obj) {
    return obj.nickname == username;
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
    document.getElementById("players").appendChild(trow);

    ctx.fillStyle = "black";
    ctx.fillText(item.nickname, miejsca[places[index]][0], miejsca[places[index]][1]+miejsca[places[index]][2]);
    ctx.fillStyle = "#941D01";

    if (item.nickname == movemakes) {
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
    ctx.fillStyle = content.lastcard.newcolor;
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
    "roomid": roomid,
    "username": username,
    "path": "."+location.pathname
  }));
}

function wybierzkarte(card) {
  if (mycards.findIndex(function (obj) {
    return obj.id == card.id;
  }) != -1 &&
  (lastcard.color == card.color ||
  lastcard.content == card.content ||
  lastcard.newcolor == card.color ||
  card.color == "black" ||
  (card.add && lastcard.add)
  )) {
    if (!card.newcolor && card.colorchange) return pokazwyborkart(card);
    connection.send(JSON.stringify({
      "type": "movemade",
      "content": "wybierzkarte",
      "card": card,
      "roomid": roomid,
      "username": username,
      "path": "."+location.pathname
    }));
  }
}

function pokazwyborkart(card) {
  document.getElementById('choosecolor').style.display = "block";
  document.getElementById('choosecolorback').style.display = "block";
  document.getElementById('choosecolorbtn').addEventListener("click", function () {
    wybierzkolor(card);
  });
}

function wybierzkolor(card) {
  document.getElementsByName("kolor").forEach(function (item, index) {
    if(item.checked) card.newcolor = item.value;
  });
  wybierzkarte(card);
  document.getElementById('choosecolor').style.display = "none";
  document.getElementById('choosecolorback').style.display = "none";
}

function sendmsg() {
  var cinput = document.getElementById("chatinput");
  if (roomid && username) {
    connection.send(JSON.stringify({
      "type": "chatmessage",
      "content": cinput.value,
      "roomid": roomid,
      "username": username,
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
