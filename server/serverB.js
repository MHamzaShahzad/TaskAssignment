// serverB.js
const express = require("express");
const bodyParser = require("body-parser");
const Queue = require("bee-queue");
const axios = require("axios");
const { Client } = require("pg");

const app = express();
app.use(bodyParser.json());

require("dotenv").config();


const { PORT, REDIS_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT } =
  process.env;

// PostgreSQL configuration
const postgresConfig = {
  user: POSTGRES_USER,
  host: POSTGRES_HOST,
  database: POSTGRES_DB,
  password: POSTGRES_PASSWORD,
  port: POSTGRES_PORT,
};

// Set up bee-queue (Server B)
const registrationQueue = new Queue("registrationQueueServerB", {
  redis: {
    host: "redis_db",
    port: REDIS_PORT,
  },
  limiter: { max: 1000, duration: 1000 },
  maxRetriesPerRequest: 30, // Adjust this value based on your needs
});

// APR endpoint for receiving user data from Server A
app.post("/syncRegistrationOnServerB", async (req, res) => {
  try {
    const { name, username } = req.body;

    // Send user data to RegistrationQueue (Bee-Queue)
    await registrationQueue.createJob({ name, username }).save();
    res
      .status(200)
      .json({ message: "User data received for syncing into PostgresDB." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Endpoint to fetch all users
app.get("/users", async (req, res) => {
  // Connect to PostgreSQL
  const client = new Client(postgresConfig);
  await client.connect();

  try {
    // Query to fetch all users
    const query = "SELECT * FROM users";
    const result = await client.query(query);

    // Send the list of users as a JSON response
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ error: "Internal server error." });
  } finally {
    // Close the PostgreSQL connection
    await client.end();
  }
});

// Performing operation inside queue (Server B)
registrationQueue.process(async (job, done) => {
  const { name, username } = job.data;

  try {

    // Saving user data to PostgresDB
    await saveToPostgresDB(name, username);

    // Update registered_in_serverb flag on MongoDB via API call
    await updateServerAFlag(name, username);

    done(null, { success: true });
  } catch (error) {
    console.error("Error processing user data:", error.message);
    done(error, { success: false });
  }
});

// Example of handling completed jobs
registrationQueue.on("succeeded", (job, result) => {
  console.log(`Job succeeded for ${job.data.name} with result:`, result);
});

// Example of handling failed jobs
registrationQueue.on("failed", (job, err) => {
  console.error(`Job failed for ${job.data.name} with error:`, err.message);
});

app.listen(PORT, () => {
  console.log(`Server B is listening on port: ${PORT}`);
});

// Saves user data to PostgresDB
async function saveToPostgresDB(name, username) {
  const client = new Client(postgresConfig);
  await client.connect();

  // Create the 'users' table if it doesn't exists
  await createUsersTableIfNotExists(client);

  const query = "INSERT INTO users(name, username) VALUES($1, $2) RETURNING *";
  const values = [name, username];

  try {
    const result = await client.query(query, values);
    console.log("User data saved to PostgresDB:", result.rows[0]);
  } catch (error) {
    console.error(
      "Error saving user data to PostgresDB:",
      error.message
    );
  } finally {
    await client.end();
  }
}

// function to create 'users' table if it doesn't exist
async function createUsersTableIfNotExists(client) {
  const createTableQuery = `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(255), username VARCHAR(255));`;
  await client.query(createTableQuery);
}

// Function to update registered_in_serverb flag on MongoDB via API call (Server A)
async function updateServerAFlag(name, username) {
  try {
    // Simulate API call to Server A
    const response = await axios.post(`http://node_Server_a:${PORT}/updateFlag`, {
      name,
      username,
    });
    console.log("Flag updated on Server A:", response.data);
  } catch (error) {
    console.error("Error updating flag on Server A:", error.message);
  }
}
