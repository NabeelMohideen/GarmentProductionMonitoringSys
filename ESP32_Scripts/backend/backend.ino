#include <WiFi.h>
#include <HTTPClient.h>

// 🔴 HARD CODED WIFI
#define WIFI_SSID "SLT-Fiber-BHPf8-2.4G_EXT"
#define WIFI_PASSWORD "Bluetex@5724"

// 🔴 YOUR BACKEND API
#define API_URL "http://192.168.1.185:3000/machine-done"

// 🔴 DEVICE INFO
#define ESP_ID "ESP32_1"
#define COLUMN_NO 1
#define MACHINE_NO 1

int buttonPin = 4;
bool pressed = false;

void setup() {
  Serial.begin(115200);
  pinMode(buttonPin, INPUT_PULLUP);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected");
}

void sendData() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"esp_id\":\"" + String(ESP_ID) + "\",";
  json += "\"column\":" + String(COLUMN_NO) + ",";
  json += "\"machine\":" + String(MACHINE_NO);
  json += "}";

  int response = http.POST(json);

  Serial.println(json);
  Serial.print("Response: ");
  Serial.println(response);

  http.end();
}

void loop() {
  int state = digitalRead(buttonPin);

  if (state == LOW && pressed == false) {
    sendData();
    pressed = true;
  }

  if (state == HIGH) {
    pressed = false;
  }

  delay(50);
}