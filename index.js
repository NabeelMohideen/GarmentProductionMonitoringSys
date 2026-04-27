const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const mysqlCore = require("mysql2");
const os = require("os");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "garment_db"
};

let pool;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "127.0.0.1";
}

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getEscapedDatabaseName(name) {
  return mysqlCore.escapeId(name);
}

async function initializeDatabase() {
  try {
    const adminPool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const dbName = dbConfig.database;
    const escapedDbName = getEscapedDatabaseName(dbName);

    await adminPool.execute(`CREATE DATABASE IF NOT EXISTS ${escapedDbName}`);

    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    await pool.execute(
      `CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        esp_id VARCHAR(50) NOT NULL,
        column_no INT NOT NULL,
        machine_no INT NOT NULL,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    console.log("MySQL Connected");
  } catch (error) {
    console.error("[DB] Failed to initialize MySQL:", error.message);
    process.exit(1);
  }
}

app.get("/test", (_req, res) => {
  res.json({
    status: "Backend working"
  });
});

app.post("/machine-done", async (req, res) => {
  const { esp_id, column, machine } = req.body;

  console.log("[POST /machine-done] Incoming data:", req.body);

  if (!esp_id || typeof esp_id !== "string" || !esp_id.trim()) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: esp_id is required"
    });
  }

  if (!isValidNumber(column)) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: column must be a number"
    });
  }

  if (!isValidNumber(machine)) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: machine must be a number"
    });
  }

  try {
    const sql = "INSERT INTO logs (esp_id, column_no, machine_no) VALUES (?, ?, ?)";
    await pool.execute(sql, [esp_id.trim(), column, machine]);

    console.log("[POST /machine-done] DB insert success:", {
      esp_id: esp_id.trim(),
      column,
      machine
    });

    return res.json({
      success: true,
      message: "Data inserted"
    });
  } catch (error) {
    console.error("[POST /machine-done] Error inserting log:", error);
    return res.status(500).json({
      success: false,
      message: "Database insert failed"
    });
  }
});

app.get("/logs", async (_req, res) => {
  try {
    const sql = "SELECT id, esp_id, column_no, machine_no, time FROM logs ORDER BY time DESC, id DESC";
    const [rows] = await pool.execute(sql);

    return res.json(rows);
  } catch (error) {
    console.error("[GET /logs] Error fetching logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

async function startServer() {
  await initializeDatabase();

  app.listen(3000, "0.0.0.0", () => {
    const localIp = getLocalIpAddress();
    console.log(`Server running at: http://localhost:3000`);
    console.log(`Server running on local network: http://${localIp}:3000`);
  });
}

startServer();
