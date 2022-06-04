// var cards = {
//   blue: [],    //19
//   green: [],   //19
//   yellow: [],  //19
//   red: [],     //19
//
//   skip: [],    //8
//   reverse: [], //8
//   newcolor: [],//4
//   add2: [],    //8
//   add4color: []//4
// };

exports.init = function() {
  var cards = [];
  var colors = ["blue","green","yellow","red"];

  colors.forEach(function (item, index) {
    for (var i = 1; i < 20; i++) {
      var card = {};
      card.type = "normal";
      card.color = item;
      card.content = i % 10; // od 1 do 9 i jedno 0
      card.id = card.type+card.content+card.color;
      cards.push(card);
    }
  });

  ["skip","reverse","add2"].forEach(function (item, index) {
    for (var i = 0; i < 8; i++) {
      var card = {};
      card.type = item;
      card.color = colors[i % 4];
      card.content = item;
      card.id = card.type+card.content+card.color;
      if (item == "add2")
        card.add = 2;
      cards.push(card);
    }
  });

  ["newcolor","add4color"].forEach(function (item, index) {
    for (var i = 0; i < 4; i++) {
      var card = {};
      card.type = item;
      card.color = "black";
      card.content = item;
      card.colorchange = true;
      card.newcolor = false;
      card.id = card.type+card.content+card.color;
      if (item == "add4color")
        card.add = 4;
      cards.push(card);
    }
  });

  return cards;
}
