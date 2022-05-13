process.stdin.setEncoding("utf8");

let http = require("http");
let express = require("express"); /* Accessing express module */
let app = express(); /* app is a request handler function */
let fs = require("fs");
let bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
var globalUsername = "";

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};

if (process.argv.length != 3) {
  process.stdout.write(`Usage ${process.argv[1]} portNumber`);
  process.exit(1);
}
let portNumber = process.argv[2];

http.createServer(app).listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`);

let prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
  let dataInput = process.stdin.read();
  if (dataInput !== null) {
    let command = dataInput.trim();
    if (command === "stop") {
      console.log("Shutting down the server");
      process.exit(0);
    } else {
      console.log(`Invalid command: ${command}`);
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (request, response) => {
  response.render("index");
});

app.get("/searchRecipe", (request, response) => {
  let variables = {
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("search_page", variables);
});

app.get("/findUserRecipes", (request, response) => {
  let variables = {
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("search_user", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/processSearchRecipe", async (request, response) => {
  let { username, queryTerm } = request.body;
  globalUsername = username;
  //   This is an array that is returned by API when we search for a recipe
  recipeQueries = searchRecipes(queryTerm);
  recipeCheckboxes = generateRecipeChecklist(recipeQueries);

  let variables = {
    username: username,
    email: email,
    recipeResults: recipeCheckboxes,
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };

  response.render("results", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/viewRecipeBook", async (request, response) => {
  let { username, recipe1 } = request.body;
  if (username === undefined) {
    console.log("NO USERNAME FOUND");
    const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });
    let user;
    try {
      await client.connect();
      await insertOrUpdateUser(client, databaseAndCollection, globalUsername);
    } catch (e) {
      console.error(e);
    } finally {
      await client.close();
    }
    let variables = {
      recipeList: 1,
      homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
    };
    response.render("applicantsData", variables);
  } else {
    globalUsername = username;
    console.log("NO RECIPE1 FOUND");
    const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });
    let user;
    try {
      await client.connect();
      await insertOrUpdateUser(client, databaseAndCollection, globalUsername);
    } catch (e) {
      console.error(e);
    } finally {
      await client.close();
    }
    let variables = {
      recipeList: 1,
      homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
    };
    response.render("applicantsData", variables);
  }
});

async function insertOrUpdateUser(
  client,
  databaseAndCollection,
  inputUser,
  addRecipes
) {
  let filter = { username: inputUser };
  const cursor = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .findOne(filter);
  if (cursor) {
    getUserRecipes = cursor.recipeList;
    getUserRecipes = getUserRecipes.concat(addRecipes);
    const result = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .update(filter, {
        $set: {
          recipeList: getUserRecipes,
        },
      });
  } else {
    let variables = {
      username: inputUser,
      recipeList: addRecipes,
    };
    const result2 = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .insertOne(variables);
  }
}

async function lookUpMany(client, databaseAndCollection, gpa) {
  let filter = { gpa: { $gte: gpa } };
  const cursor = client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find(filter);

  const result = await cursor.toArray();
  return result;
}

/* SAMSON YOUR PART IS DOWN HERE */
function searchRecipes(recipeTerm) {
  /* Return array of five or so recipe Objects */
}

function generateRecipeChecklist(recipeList) {
  /* <li>Curry Udon <input type="checkbox" name="recipe1" class="recipe-results"/><br></li> */
  let checklistHTML = "";
  let counter = 0;
  recipeList.forEach(
    (elem, index) =>
      (checklistHTML += `<li>${elem}<input type="checkbox" name="recipe1" value="${index}" class="recipe-results"/><br></li>`)
  );
  return checklistHTML;
}
