process.stdin.setEncoding("utf8");

import fetch from "node-fetch"
import http from "http"
import express from "express" 
import bodyParser from "body-parser"
import { MongoClient, ServerApiVersion } from "mongodb"
import path from "path"
import dotenv from "dotenv"
import {fileURLToPath} from 'url';
import AsyncLock from "async-lock"

var lock = new AsyncLock()

const dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dirname, ".env") });
let app = express();
var globalUsername = "";
var globalItems;
var recipeIds = []
var recipesWithInformation = []
var titles = []

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
let portNumber = process.env.PORT || process.argv[2];

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

app.set("views", path.resolve(dirname, "Templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use( express.static( "public" ) );

app.get("/", (request, response) => {
  response.render("index");
});

app.get("/searchRecipe", (request, response) => {
  let variables = {
    homeWebpage: `<a href="/">HOME</a>`,
  };
  response.render("search_page", variables);
});

app.get("/findUserRecipes", (request, response) => {
  let variables = {
    homeWebpage: `<a href="/">HOME</a>`,
  };
  response.render("search_user", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/processSearchRecipe", async (request, response) => {
  let { username, queryTerm } = request.body;
  globalUsername = username;
  titles = []
  //   This is an array that is returned by API when we search for a recipe
  lock.acquire("", async function() {
    await searchRecipes(queryTerm);
  }, []).then(function() {
    let recipeQueries = recipesWithInformation;
    globalItems = recipeQueries;
    var recipeCheckboxes = generateRecipeChecklist(recipeQueries);

    let variables = {
      username: username,
      searchTerm: queryTerm,
      recipeResults: recipeCheckboxes,
      homeWebpage: `<a href="/">HOME</a>`,
    };

    response.render("results", variables);
  });
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
    let foundUser;
    let getRecipeObjects = []
    for (let i = 0; i < recipe1.length; i++) {
        getRecipeObjects.push(globalItems[Number(recipe1[i])])
    }
    try {
      await client.connect();
      await insertOrUpdateUser(client, databaseAndCollection, globalUsername, getRecipeObjects);
      foundUser = await lookUpOneEntry(client, databaseAndCollection, globalUsername);
    } catch (e) {
      console.error(e);
    } finally {
      await client.close();
    }
    let variables = {
      recipeList: generateRecipeBook(foundUser),
      homeWebpage: `<a href="/">HOME</a>`,
    };
    response.render("recipebook", variables);
  } else {
    globalUsername = username;
    console.log("NO RECIPE1 FOUND");
    const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });
    let foundUser;
    try {
      await client.connect();
      foundUser = await lookUpOneEntry(client, databaseAndCollection, globalUsername);
    } catch (e) {
      console.error(e);
    } finally {
      await client.close();
    }
    if (foundUser === null || foundUser === undefined) {
      let variables = {
        error: `There is no user with the username ${username} that has recipes saved.`,
        homeWebpage: `<a href="/">HOME</a>`,
      };
      response.render("error", variables)
    } else {
      let variables = {
      recipeList: generateRecipeBook(foundUser),
      homeWebpage: `<a href="/">HOME</a>`,
      };
      response.render("recipebook", variables);
    }
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
    let getUserRecipes = cursor.recipeList;
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

async function lookUpOneEntry(client, databaseAndCollection, inputUser) {
  let filter = { username: inputUser };
  const cursor = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .findOne(filter);
  if (cursor) {
    return cursor;
  } else {
    return null;
  }
}

async function searchRecipes(recipeTerm) {
  recipeIds = []
  recipesWithInformation = []
  let query = String(recipeTerm)
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Host': 'spoonacular-recipe-food-nutrition-v1.p.rapidapi.com',
      'X-RapidAPI-Key': 'eee60225dfmsh483cdc041112e38p1614f2jsn1e3e3516465d'
    }
  };
  await fetch(`https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/complexSearch?query=${query}`, options)
    .then(response => response.json())
    .then(response => processids(response))
    .then(async function(response) {
      let end = 5
      let start = 0
      while (end < recipeIds.length && recipesWithInformation.length < 5) {
        for (let i = start; i < recipeIds.length && i < end; i++) {
          await getRecipeObjectById(recipeIds[i])
        }
        start = end
        end += 1
      }
    })
    .catch(err => console.error(err));
  
}

function processids(response) {
  let ids = []
  if (response !== undefined) {
      for(let i = 0; i < response["results"].length && i < 15; i++){
          let data = {}
          data["id"] = response["results"][i]["id"]
          ids.push(data)
      }
  }
  recipeIds = ids
}

async function getRecipeObjectById(id) {
  const options = {
      method: 'GET',
      headers: {
          'X-RapidAPI-Host': 'spoonacular-recipe-food-nutrition-v1.p.rapidapi.com',
          'X-RapidAPI-Key': 'eee60225dfmsh483cdc041112e38p1614f2jsn1e3e3516465d'
      }
  };
  if (id !== undefined && id !== null) {
      await fetch(`https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/${id["id"]}/information`, options)
      .then(response => response.json())
      .then(response => processRecipes(response))
      .catch(err => console.error(err));
  }
}

function processRecipes(response) {
  let data = {}
  if (response !== undefined) {
      data["title"] = response["title"]
      data["url"] = response["sourceUrl"]
      data["recipe"] = response["summary"]
  }
  let contains = false
  for(let i = 0; i < titles.length; i++) {
    if (titles[i] == data["title"]) {
      contains = true
    }
  }
  if (!contains) {
    recipesWithInformation.push(data)
    titles.push(data["title"])
  }
}


function generateRecipeChecklist(recipeList) {
  let checklistHTML = "";
  recipeList.forEach(
    (elem, index) =>
      (checklistHTML += `<li>${elem.title}<input type="checkbox" name="recipe1" value="${index}" class="recipe-results"/><br></li>`)
  );
  return checklistHTML;
}

function generateRecipeBook(foundUser) {
  let listHTML = "";
  foundUser.recipeList.forEach(
    (elem) => 
    (listHTML += `<li><a href="${elem.url}">${elem.title}</a></li>`)
    );
    return listHTML;
}
