// Smart Parking — ESP32 sensor node (works with the Smart Parking web app)
//
//   D34 = entrance IR sensor      (a car arriving at the lot entrance)
//   D35 = spot IR sensor          (is the parking spot taken?)
//   D26 = LED strip data (DIN)    (GREEN = spot OPEN, RED = spot TAKEN)
//
// The board streams one JSON line per sample over USB serial, e.g.
//   {"entrance":12.3,"spot":80.0}
// The web app (Chrome/Edge -> "Connect Arduino") reads these lines and does the
// routing and turn-by-turn directions. The LEDs work on their own, so the spot
// shows OPEN / TAKEN even when the board is not connected to the app.
//
// Needs the "Adafruit NeoPixel" library: Arduino IDE -> Sketch -> Include Library
// -> Manage Libraries -> search "Adafruit NeoPixel" -> Install.
//
// Baud rate: 115200. Close the Arduino IDE Serial Monitor before connecting the
// web app: only one program can use the serial port at a time.

#include <Adafruit_NeoPixel.h>

const int ENTRANCE_SENSOR_PIN = 34; // D34 (input-only ADC pin)
const int SPOT_SENSOR_PIN = 35;     // D35 (input-only ADC pin)

const int LED_PIN = 26;             // D26 -> (330 ohm resistor) -> strip DIN
const int LED_COUNT = 4;            // number of LEDs in your strip
const int LED_BRIGHTNESS = 40;      // 0-255, kept low so USB power is plenty
// If green/red show up swapped, change NEO_GRB to NEO_RGB.
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// Something closer than this counts as a car in the spot.
// Keep it equal to the "Spot trigger" slider in the web app (default 15 cm).
const float SPOT_TAKEN_CM = 15.0;
const float HYSTERESIS_CM = 2.0;    // stops the LEDs flickering near the threshold
const int SAMPLES_TO_SWITCH = 3;    // consecutive samples needed to change state
const unsigned long SAMPLE_PERIOD_MS = 50; // pause between samples

bool spotTaken = false;
int switchStreak = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // ESP32 default 12-bit (0 - 4095)

  strip.begin();
  strip.setBrightness(LED_BRIGHTNESS);

  // Power-on LED test: blue for a moment, so you know the wiring works.
  strip.fill(strip.Color(0, 0, 255));
  strip.show();
  delay(600);
  showSpotLeds();
}

void loop() {
  float entranceCm = readDistanceCM(ENTRANCE_SENSOR_PIN);
  float spotCm = readDistanceCM(SPOT_SENSOR_PIN);

  bool wasTaken = spotTaken;
  updateSpotState(spotCm);
  if (spotTaken != wasTaken) {
    showSpotLeds();
  }

  Serial.print("{\"entrance\":");
  Serial.print(entranceCm, 1);
  Serial.print(",\"spot\":");
  Serial.print(spotCm, 1);
  Serial.println("}");

  delay(SAMPLE_PERIOD_MS);
}

// Debounced "is the spot taken?" with a small hysteresis band.
void updateSpotState(float spotCm) {
  bool wantTaken = spotTaken ? (spotCm < SPOT_TAKEN_CM + HYSTERESIS_CM) : (spotCm < SPOT_TAKEN_CM);
  if (wantTaken == spotTaken) {
    switchStreak = 0;
    return;
  }
  switchStreak++;
  if (switchStreak >= SAMPLES_TO_SWITCH) {
    spotTaken = wantTaken;
    switchStreak = 0;
  }
}

// RED = taken, GREEN = open. Every LED in the strip shows the same state.
void showSpotLeds() {
  strip.fill(spotTaken ? strip.Color(255, 0, 0) : strip.Color(0, 255, 0));
  strip.show();
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
