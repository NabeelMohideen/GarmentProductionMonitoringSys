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

async function ensureLogsTableColumns() {
  const requiredColumns = [
    { name: "employee_id", definition: "INT NULL" },
    { name: "employee_name", definition: "VARCHAR(255) NULL" },
    { name: "rfid_uid", definition: "VARCHAR(100) NULL" }
  ];

  const [rows] = await pool.execute("SHOW COLUMNS FROM logs");
  const existingColumns = new Set(rows.map((row) => row.Field));

  for (const column of requiredColumns) {
    if (!existingColumns.has(column.name)) {
      console.log(`[DB] Adding missing logs column: ${column.name}`);
      await pool.execute(`ALTER TABLE logs ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
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

    await ensureLogsTableColumns();

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

app.post("/verify-rfid", async (req, res) => {
  const { rfid_uid } = req.body;

  console.log("[POST /verify-rfid] Incoming data:", req.body);

  if (!rfid_uid || typeof rfid_uid !== "string" || !rfid_uid.trim()) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: rfid_uid is required"
    });
  }

  try {
    const sql = "SELECT id, name FROM employees WHERE rfid_uid = ? AND status = 'active'";
    const [rows] = await pool.execute(sql, [rfid_uid.trim()]);

    console.log("[POST /verify-rfid] Query result count:", rows.length);

    if (!rows.length) {
      return res.json({
        success: false,
        message: "Employee not found"
      });
    }

    const employee = rows[0];

    return res.json({
      success: true,
      employee_id: employee.id,
      name: employee.name
    });
  } catch (error) {
    console.error("[POST /verify-rfid] Error verifying RFID:", error);
    return res.status(500).json({
      success: false,
      message: "Database query failed"
    });
  }
});

app.post("/machine-done", async (req, res) => {
  const { esp_id, employee_id, rfid_uid, column, machine } = req.body;

  console.log("[POST /machine-done] Incoming data:", req.body);

  if (!esp_id || typeof esp_id !== "string" || !esp_id.trim()) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: esp_id is required"
    });
  }

  if (!isValidNumber(employee_id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: employee_id must be a number"
    });
  }

  if (!rfid_uid || typeof rfid_uid !== "string" || !rfid_uid.trim()) {
    return res.status(400).json({
      success: false,
      message: "Invalid input: rfid_uid is required"
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
    const employeeSql = "SELECT name FROM employees WHERE id = ?";
    const [employeeRows] = await pool.execute(employeeSql, [employee_id]);

    console.log("[POST /machine-done] Employee lookup result count:", employeeRows.length);

    if (!employeeRows.length) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employeeName = employeeRows[0].name;

    const sql = "INSERT INTO logs (esp_id, employee_id, employee_name, rfid_uid, column_no, machine_no) VALUES (?, ?, ?, ?, ?, ?)";
    await pool.execute(sql, [esp_id.trim(), employee_id, employeeName, rfid_uid.trim(), column, machine]);

    console.log("[POST /machine-done] DB insert success:", {
      esp_id: esp_id.trim(),
      employee_id,
      employee_name: employeeName,
      rfid_uid: rfid_uid.trim(),
      column,
      machine
    });

    return res.json({
      success: true,
      message: "Log saved"
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
    const sql = "SELECT id, esp_id, employee_id, employee_name, rfid_uid, column_no, machine_no, time FROM logs ORDER BY time DESC, id DESC";
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
