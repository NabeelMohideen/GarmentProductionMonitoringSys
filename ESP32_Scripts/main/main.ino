#include <WiFi.h>
#include <HTTPClient.h>

#define WIFI_SSID "SLT-Fiber-BHPf8-2.4G_EXT"
#define WIFI_PASSWORD "Bluetex@5724"

// Firebase URLs
#define FIREBASE_ARM "https://bluetex-production-iot-default-rtdb.asia-southeast1.firebasedatabase.app/garment/arm.json"
#define FIREBASE_COLLAR "https://bluetex-production-iot-default-rtdb.asia-southeast1.firebasedatabase.app/garment/collar.json"

// Pins
int buttonArm = 4;
int buttonCollar = 5;
int ledPin = 2;
int buzzerPin = 15;

// Counters
int countArm = 0;
int countCollar = 0;

// States
bool pressedArm = false;
bool pressedCollar = false;

void setup() {
  Serial.begin(115200);

  pinMode(buttonArm, INPUT_PULLUP);
  pinMode(buttonCollar, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected");
}

// 🔥 send function
void sendToFirebase(String url, int value) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    int response = http.PUT(String(value));

    Serial.print("Response: ");
    Serial.println(response);

    http.end();
  }
}

// 🔊 feedback
void feedback() {
  digitalWrite(ledPin, HIGH);
  digitalWrite(buzzerPin, HIGH);
  delay(150);
  digitalWrite(ledPin, LOW);
  digitalWrite(buzzerPin, LOW);
}

void loop() {
  int stateArm = digitalRead(buttonArm);
  int stateCollar = digitalRead(buttonCollar);

  // ✅ ARM BUTTON (PIN 4)
  if (stateArm == LOW && pressedArm == false) {
    countArm++;

    Serial.print("ARM Count: ");
    Serial.println(countArm);

    feedback();
    sendToFirebase(FIREBASE_ARM, countArm);

    pressedArm = true;
  }

  if (stateArm == HIGH) {
    pressedArm = false;
  }

  // ✅ COLLAR BUTTON (PIN 5)
  if (stateCollar == LOW && pressedCollar == false) {
    countCollar++;

    Serial.print("COLLAR Count: ");
    Serial.println(countCollar);

    feedback();
    sendToFirebase(FIREBASE_COLLAR, countCollar);

    pressedCollar = true;
  }

  if (stateCollar == HIGH) {
    pressedCollar = false;
  }

  delay(50);
}