var roomsdiv = document.getElementById("roomsdiv");
var nickname = document.getElementById("nickname");
function getrooms() {
    var req = new XMLHttpRequest();
    var random = Math.floor(Math.random()*1000);

    req.open('GET', 'getrooms?'+random, true);
    req.onreadystatechange = function (aEvt) {
        if (req.readyState == 4) {
            if(req.status == 200) {
                listrooms(JSON.parse(req.responseText));
            } else
                console.log("Błąd podczas ładowania strony\n");
        }
    };
    req.send();
}

function listrooms(rooms) {
    roomsdiv.innerHTML = "";
    rooms.forEach(room => {
        roomsdiv.innerHTML += `<div class="roombutton" onclick="goto('joinroom/${room.id}')">Pokój ${room.id}</div>`;
    });
}

getrooms();
setInterval(getrooms, 5000);

function goto(url) {
    if (nickname.value)
        window.location.pathname = url+"/"+nickname.value;
    else
        alert("Wpisz swój nick!");
}