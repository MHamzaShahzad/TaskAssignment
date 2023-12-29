```markdown
# Node.js Microservices Example

This repository demonstrates a simple Node.js microservices architecture where two servers (Server A and Server B) communicate with each other using a message queue (Bee-Queue). Each server interacts with its respective database (MongoDB and PostgresDB).

## Features

- **Server A (node_server_a):**
  - Accepts user registration via API.
  - Uses Bee-Queue to queue registration requests.
  - Stores user data in MongoDB.
  - Updates a flag in MongoDB after successful registration on Server B.

- **Server B (node_server_b):**
  - Listens for registration sync requests from Server A.
  - Saves user data to PostgresDB.
  - Provides an API endpoint to fetch all users from PostgresDB.

## Prerequisites

Make sure you have Docker and Docker Compose installed on your machine.

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/MHamzaShahzad/TaskAssignment.git
   ```

2. Navigate to the project directory:

   ```bash
   cd TaskAssignment
   ```

3. Create a `.env` file in the project root with the following environment variables:

   ```env
   APP_ENV=development
   NODE_ENV=development
   PORT=8080 // Or might be any of your choice

   MONGO_USERNAME=
   MONGO_PASSWORD=
   MONGO_HOSTNAME=mongo_db
   MONGO_PORT=27017
   MONGO_DB=test

   POSTGRES_DB=postgres
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=admin
   POSTGRES_HOST=postgres_db
   POSTGRES_PORT=5432

   REDIS_PORT=6379
   ```

4. Run the application using Docker Compose:

   ```bash
   docker-compose up -d
   ```

   This will start Server A, Server B, MongoDB, PostgresDB, and Redis.

5. Access Server A at [http://localhost:8081](http://localhost:8081) and Server B at [http://localhost:8082](http://localhost:8082).

## API Endpoints

### Server A (node_server_a)

- **POST /register:**
  - Accepts user registration data.
  - Queues registration requests using Bee-Queue.

- **GET /users:**
  - Retrieves a list of all users from MongoDB.

### Server B (node_server_b)

- **POST /syncRegistrationOnServerB:**
  - Endpoint to sync user registration from Server A.
  - Queues registration sync requests using Bee-Queue.

- **GET /users:**
  - Retrieves a list of all users from PostgresDB.

## Authors

- Hamza Shahzad