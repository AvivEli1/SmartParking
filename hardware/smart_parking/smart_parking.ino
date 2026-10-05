// Smart Parking — ESP32 sensor node
//
// Two analog IR distance sensors:
//   D34 = entrance sensor  (a car arriving at the lot entrance)
//   D35 = spot sensor      (is the parking spot taken?)
//
// The board only MEASURES. It streams one JSON line per sample over USB serial:
//   {"entrance":12.3,"spot":80.0}
// The web app (Chrome/Edge, "Connect Arduino" button) reads these lines and does
// the detecting, routing and turn-by-turn directions. Thresholds live in the app,
// so you can tune them without re-flashing.
//
// Baud rate: 115200. Close the Arduino IDE Serial Monitor before connecting the
// web app — only one program can use the serial port at a time.

const int ENTRANCE_SENSOR_PIN = 34; // D34
const int SPOT_SENSOR_PIN = 35;     // D35
const unsigned long SAMPLE_PERIOD_MS = 100; // pause between samples

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // ESP32 default 12-bit (0 - 4095)
}

void loop() {
  float entranceCm = readDistanceCM(ENTRANCE_SENSOR_PIN);
  float spotCm = readDistanceCM(SPOT_SENSOR_PIN);

  Serial.print("{\"entrance\":");
  Serial.print(entranceCm, 1);
  Serial.print(",\"spot\":");
  Serial.print(spotCm, 1);
  Serial.println("}");

  delay(SAMPLE_PERIOD_MS);
}

// Averages 25 IR readings from `pin` and converts them to a distance in cm.
float readDistanceCM(int pin) {
  long sum = 0;
  for (int i = 0; i < 25; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  float avgRaw = sum / 25.0;

  // Convert raw value to Volts (3.3V reference)
  float voltage = (avgRaw / 4095.0) * 3.3;

  // Lab formula: d = 29.988 * V^(-1.173)
  if (voltage <= 0.4) {
    return 80.0; // Target beyond sensor range
  }
  return 29.988 * pow(voltage, -1.173);
}
