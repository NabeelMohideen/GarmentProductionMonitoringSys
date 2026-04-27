# Garment Monitoring System Backend

Node.js + Express backend for an IoT garment production monitoring system. It receives machine button press data from ESP32 devices and stores logs in a MySQL database running on XAMPP.

## Tech Stack

- Node.js
- Express.js
- mysql2
- CORS
- dotenv
- MySQL on XAMPP

## Features

- Connects to MySQL using environment variables from `.env`
- Saves machine event logs into the `logs` table
- Returns all logs ordered by latest first
- Includes a `/test` endpoint for quick backend checks
- Includes JSON request parsing and CORS support
- Binds to `0.0.0.0` so ESP32 devices on the same network can reach it
- Logs incoming request data, successful inserts, and errors to the console

## Project Files

- `index.js` - Express server and API routes
- `database.sql` - Database and table creation script
- `.env` - Database credentials and server port
- `package.json` - Project dependencies and start script

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

Import or run the SQL script in `database.sql` using phpMyAdmin or the MySQL client in XAMPP.

This creates:

- Database: `garment_db`
- Table: `logs`

### 3. Configure environment variables

The `.env` file contains the local MySQL settings used by the backend:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Complex123
DB_NAME=garment-db
```

If your local setup is different, update those values in `.env`.

Important: make sure the database name in `.env` matches the database you created in MySQL. If you use `database.sql` as-is, the created database name is `garment_db`, so either update `.env` to `garment_db` or change the SQL file to match your preferred name.

### 4. Start the server

```bash
node index.js
```

The server will print:

- `MySQL Connected`
- `http://localhost:3000`
- `http://<your-local-ip>:3000`

Use the local IP address from another device on the same Wi-Fi network.

## Validation Checklist

1. Start XAMPP MySQL.
2. Run `node index.js`.
3. Confirm the console shows `MySQL Connected`.
4. Open `http://localhost:3000/test` in a browser.
5. Send a POST request to `/machine-done`.
6. Check the `logs` table in HeidiSQL or phpMyAdmin.
7. Open `http://localhost:3000/logs` to confirm records are returned.

## API Endpoints

### GET /test

Quick backend health check.

Response:

```json
{
  "status": "Backend working"
}
```

### POST /machine-done

Saves a machine log.

Request body:

```json
{
  "esp_id": "ESP32_1",
  "column": 1,
  "machine": 5
}
```

Response:

```json
{
  "success": true,
  "message": "Data inserted"
}
```

Validation errors return a `success: false` response with a clear message.

### GET /logs

Returns all logs ordered by latest first.

Example response:

```json
[
  {
    "id": 1,
    "esp_id": "ESP32_1",
    "column_no": 1,
    "machine_no": 5,
    "time": "2026-04-27T10:30:00.000Z"
  }
]
```

### GET /logs/:column

Returns logs for a specific column.

Example:

```bash
GET /logs/1
```

## Postman Test Examples

### Save a log

- Method: `POST`
- URL: `http://localhost:3000/machine-done`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "esp_id": "ESP32_1",
  "column": 1,
  "machine": 5
}
```

### Get all logs

- Method: `GET`
- URL: `http://localhost:3000/logs`

### Get logs for one column

- Method: `GET`
- URL: `http://localhost:3000/logs/1`

## curl Examples

### Test backend

```bash
curl http://localhost:3000/test
```

### Send machine data

```bash
curl -X POST http://localhost:3000/machine-done ^
  -H "Content-Type: application/json" ^
  -d "{\"esp_id\":\"ESP32_1\",\"column\":1,\"machine\":2}"
```

### Read logs

```bash
curl http://localhost:3000/logs
```

## ESP32 Integration Notes

- Send a JSON POST request to `/machine-done`
- Make sure the ESP32 uses the PC's local IP address, not `localhost`
- Keep the ESP32 and PC on the same network

## HeidiSQL Notes

- You do not need Insomnia if you already use HeidiSQL.
- Use HeidiSQL to verify the `logs` table and confirm rows are being inserted.
- Use Postman, curl, or a browser to test the API endpoints.

## Troubleshooting

- If the server cannot connect to MySQL, make sure XAMPP MySQL is running.
- If you see an access denied error, confirm the `.env` values match your local MySQL setup.
- If another device cannot reach the API, verify the firewall and that you are using the correct local IP address.
- If `/machine-done` returns a validation error, make sure `esp_id` is a non-empty string and `column` and `machine` are numbers.
