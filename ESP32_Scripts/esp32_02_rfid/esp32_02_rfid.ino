#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

#define WIFI_SSID "SLT-Fiber-BHPf8-2.4G_EXT"
#define WIFI_PASSWORD "Bluetex@5724"

#define VERIFY_URL "http://192.168.1.185:3000/verify-rfid"
#define LOG_URL "http://192.168.1.185:3000/machine-done"

#define ESP_ID "ESP32_2"
#define COLUMN_NO 2
#define MACHINE_NO 1

#define SS_PIN 5
#define RST_PIN 22

int buttonPin = 4;   // D4 button
int ledPin = 12;     // D12 green LED
int buzzerPin = 13;  // D13 buzzer

MFRC522 rfid(SS_PIN, RST_PIN);

bool pressed = false;
bool employeeVerified = false;

int employeeId = 0;
String employeeName = "";
String currentUID = "";

void setup() {
  Serial.begin(115200);

  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);

  digitalWrite(ledPin, LOW);
  digitalWrite(buzzerPin, LOW);

  SPI.begin(18, 19, 23, SS_PIN);
  rfid.PCD_Init();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  Serial.println("Scan RFID card...");
}

void beep() {
  digitalWrite(buzzerPin, HIGH);
  delay(150);
  digitalWrite(buzzerPin, LOW);
}

String readRFID() {
  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += " ";
  }

  uid.toUpperCase();
  return uid;
}

void verifyRFID(String uid) {
  HTTPClient http;
  http.begin(VERIFY_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{\"rfid_uid\":\"" + uid + "\"}";

  int response = http.POST(json);
  String payload = http.getString();

  Serial.println("RFID UID: " + uid);
  Serial.println("Verify response: " + payload);

  if (response == 200) {
    DynamicJsonDocument doc(512);
    deserializeJson(doc, payload);

    if (doc["success"] == true) {
      employeeId = doc["employee_id"];
      employeeName = doc["name"].as<String>();
      currentUID = uid;
      employeeVerified = true;

      digitalWrite(ledPin, HIGH);
      beep();

      Serial.println("Employee verified: " + employeeName);
    } else {
      employeeVerified = false;
      digitalWrite(ledPin, LOW);
      Serial.println("Employee not found");
    }
  }

  http.end();
}

void sendMachineLog() {
  if (!employeeVerified) {
    Serial.println("Scan RFID first!");
    return;
  }

  HTTPClient http;
  http.begin(LOG_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"esp_id\":\"" + String(ESP_ID) + "\",";
  json += "\"employee_id\":" + String(employeeId) + ",";
  json += "\"rfid_uid\":\"" + currentUID + "\",";
  json += "\"column\":" + String(COLUMN_NO) + ",";
  json += "\"machine\":" + String(MACHINE_NO);
  json += "}";

  int response = http.POST(json);

  Serial.println(json);
  Serial.print("Log response: ");
  Serial.println(response);

  http.end();

  if (response > 0) {
    beep();
    digitalWrite(ledPin, LOW);

    employeeVerified = false;
    employeeId = 0;
    employeeName = "";
    currentUID = "";

    Serial.println("Log saved. Scan next employee.");
  }
}

void loop() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = readRFID();
    verifyRFID(uid);

    rfid.PICC_HaltA();
    delay(500);
  }

  int state = digitalRead(buttonPin);

  if (state == LOW && pressed == false) {
    sendMachineLog();
    pressed = true;
  }

  if (state == HIGH) {
    pressed = false;
  }

  delay(50);
}