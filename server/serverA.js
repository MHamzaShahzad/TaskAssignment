// serverA.js
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Queue = require("bee-queue");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// Load environment variables
require("dotenv").config();

const { PORT, REDIS_PORT } = process.env;
// Mongoose connection string
const mongoURI = `mongodb://${process.env.MONGO_HOSTNAME}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});
db.on("disconnected", () => {
  console.log("Disconnected from MongoDB");
});

const UserSchema = new mongoose.Schema({
  name: String,
  username: {
    type: String,
    unique: true,
    required: true,
  },
  registered_in_serverb: { type: Boolean, default: false },
});

const UserModel = mongoose.model("User", UserSchema);

// Set up Bull queue (Server A)
const registrationQueue = new Queue("registrationQueueServerA", {
  redis: {
    host: "redis_db", // This should match the service name in docker-compose.yaml
    port: REDIS_PORT,
  },
  limiter: { max: 1000, duration: 1000 },
  maxRetriesPerRequest: 30, // Adjust this value based on your needs
});

// Signup API endpoint and it will save data through Queuing
app.post("/register", async (req, res) => {
  try {
    const { name, username } = req.body;

    await registrationQueue.createJob({ name, username }).save();

    res.status(200).json({ message: "User registration request received." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Update registered_in_serverb flag on Mongo
app.post("/updateFlag", (req, res) => {
  // Update registered_in_serverb flag in MongoDB
  // This is a simplified example; you may need to use Mongoose to update the document
  const { username } = req.body;
  UserModel.updateOne({ username }, { registered_in_serverb: true })
    .then((result) => {
      console.log("Flag updated on Server A:", result);
      res.status(200).json({ message: "Flag updated successfully." });
    })
    .catch((err) => {
      console.error("Error updating flag on Server A:", err.message);
      res.status(500).json({ error: "Internal server error." });
    });
});

// Get all users list created in Mongo
app.get("/users", (req, res) => {
  // Retrieve all users
  UserModel.find()
    .then((users) => {
      console.log("Mongo Users: " + JSON.stringify(users));
      res.status(200).json(users);
    })
    .catch((err) => {
      console.log("Mongo Users Error: " + err);
      res.status(500).json({ error: "Internal server error." });
    });
});

// Performing operation inside queue (Server A)
registrationQueue.process(async (job, done) => {
  const { name, username } = job.data;

  try {
    // Save user to MongoDB
    const user = new UserModel({ name, username });
    await user.save();

    // call an API to sync user on PostgresDB
    await syncRegistrationOnServerB(name, username);

    done(null, { success: true });
  } catch (error) {
    console.error("Error processing user data:", error.message);
    if (error && error.code === 11000)
      console.error('Username must be unique.');
    done(error, { success: false });
  }
});

registrationQueue.on("succeeded", (job, result) => {
  console.log(`Job succeeded for ${job.data.name} with result:`, result);
});

registrationQueue.on("failed", (job, err) => {
  console.error(`Job failed for ${job.data.name} with error:`, err.message);
});

app.listen(PORT, () => {
  console.log(`Server A is listening on port: ${PORT}`);
});

// Sync user on PostgresDB via API call (Server B)
async function syncRegistrationOnServerB(name, username) {
  try {
    // Simulate API call to Server A
    const response = await axios.post(
      `http://node_server_b:${PORT}/syncRegistrationOnServerB`,
      { name, username }
    );
    console.log("Request submitted to Server B:", response.data);
  } catch (error) {
    console.error("Error submitting request to Server B:", error.message);
  }
}
