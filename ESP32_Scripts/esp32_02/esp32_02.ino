#include <WiFi.h>
#include <HTTPClient.h>

#define WIFI_SSID "SLT-Fiber-BHPf8-2.4G_EXT"
#define WIFI_PASSWORD "Bluetex@5724"

#define API_URL "http://192.168.1.185:3000/machine-done"

#define ESP_ID "ESP32_2"
#define COLUMN_NO 2
#define MACHINE_NO 1

int buttonPin = 4;   // D4
int ledPin = 15;     // D15

bool pressed = false;
bool systemReady = false;

void setup() {
  Serial.begin(115200);

  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");

  // wait until button is released before system starts
  while (digitalRead(buttonPin) == LOW) {
    Serial.println("Release button...");
    delay(200);
  }

  delay(1000);
  systemReady = true;
  Serial.println("System Ready");
}

void blinkLED() {
  digitalWrite(ledPin, HIGH);
  delay(200);
  digitalWrite(ledPin, LOW);
}

void sendData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }

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
  Serial.print("HTTP Response: ");
  Serial.println(response);

  http.end();

  if (response > 0) {
    blinkLED();
  }
}

void loop() {
  if (!systemReady) return;

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