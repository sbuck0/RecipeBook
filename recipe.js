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

app.get("/createUser", (request, response) => {
  let variables = {
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("addUser", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/processUserCreation", async (request, response) => {
  let { username, queryTerm } = request.body;
    globalUsername = username;
//   This is an array that is returned by API when we search for a recipe
  recipeQueries = searchRecipes(queryTerm);

  let variables = {
    username: username,
    email: email,
    gpa: Number(gpa),
    backgroundInfo: backgroundInfo,
    dateCreated: new Date(),
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };

  const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });

  try {
    await client.connect();
    await insertCamper(client, databaseAndCollection, variables);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }

  response.render("applicantsData", variables);
});

app.get("/reviewApplication", async (request, response) => {
  let variables = {
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("reviewApplication", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/processReviewApplication", async (request, response) => {
  let { email } = request.body;
  const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  let camper;
  try {
    await client.connect();
    camper = await lookUpOneEntry(client, databaseAndCollection, email);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
  if (camper === null) {
    let variables = {
      name: "NONE",
      email: "NONE",
      gpa: "NONE",
      backgroundInfo: "NONE",
      dateCreated: "Camper was not found",
      homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
    };
    response.render("applicantsData", variables);
  } else {
    let variables = {
      name: camper.name,
      email: camper.email,
      gpa: Number(camper.gpa),
      backgroundInfo: camper.backgroundInfo,
      dateCreated: camper.dateCreated,
      homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
    };
    response.render("applicantsData", variables);
  }
});

app.get("/adminGFA", async (request, response) => {
  let variables = {
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("gpaQuery", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post(`/processAdminGFA/${username}`, async (request, response) => {
  let { gpa } = request.body;
  const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  let tableHTML = "";
  try {
    await client.connect();
    let arr = await lookUpMany(client, databaseAndCollection, Number(gpa));
    tableHTML += '<table border="1"><tr><th>Name</th><th>GPA</th></tr>';
    arr.forEach(
      (elem) =>
        (tableHTML += `<tr><td>${elem.name}</td><td>${elem.gpa}</td></tr>`)
    );
    tableHTML += "</table>";
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
  let variables = {
    campersTable: tableHTML,
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("displayGPA", variables);
});

app.get("/adminRemove", async (request, response) => {
  let variables = {
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("removeApplicants", variables);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/processAdminRemove", async (request, response) => {
  const uri = `mongodb+srv://${userName}:${password}@cluster0.dlpe5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  let numEntries = 0;
  try {
    await client.connect();
    let filter = {};
    const cursor = client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .find(filter);

    const result1 = await cursor.toArray();
    numEntries = result1.length;

    const result = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .deleteMany({});
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
  let variables = {
    numRemoved: numEntries,
    homeWebpage: `<a href="http://localhost:${portNumber}">HOME</a>`,
  };
  response.render("removeConfirmation", variables);
});

async function insertCamper(client, databaseAndCollection, newCamper) {
  const result = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .insertOne(newCamper);
}

async function lookUpOneEntry(client, databaseAndCollection, camperEmail) {
  let filter = { email: camperEmail };
  const result = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .findOne(filter);

  if (result) {
    return result;
  } else {
    return null;
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
    /* Return array of five or so recipe names */
}

function generateRecipeChecklist(recipeList) {
    let tableHTML = "<table border=\"1\"><tr><th>Item</th><th>Cost</th></tr>";
    items.forEach(elem => tableHTML += `<tr><td>${elem}</td><td>${JSON_obj.itemsList.find((x) => x.name === elem).cost.toFixed(2)}</td></tr>`);
    tableHTML += `<tr><td>Total Cost:</td><td>${items.reduce((acc, elem) => acc + JSON_obj.itemsList.find((x) => x.name === elem).cost, 0)}</td></tr>`
    tableHTML += "</table>";
    return tableHTML;
}