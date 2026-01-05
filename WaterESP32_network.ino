// REMOVED: Original ESP32 sketch archived here per project cleanup request.
// If you need the device firmware later, retrieve it from version control history or ask to restore it.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
// Networking
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

const uint8_t FLOW_PIN = 14;           // YF-S201 signal -> ESP32 GPIO14
volatile uint32_t pulseCount = 0;     // incremented in ISR

// UPDATED calibrated value
double PULSES_PER_LITER = 388.8; // use 6 decimals

const unsigned long INTERVAL_MS = 1000; // update interval in ms
const unsigned long SAVE_MS = 60000;    // save totals every 60s

// Noise / zero thresholds (tune to taste)
#define NOISE_PULSE_THRESHOLD 1       // treat <= this many pulses per interval as noise (set 0 to disable)
#define FLOW_ZERO_THRESHOLD_LPM 0.005 // if calculated L/min < this, show 0.0 (tune if needed)

// I2C pins (explicit)
const uint8_t SDA_PIN = 21;
const uint8_t SCL_PIN = 22;

// LCD settings
uint8_t lcdAddress = 0x27; // fallback, will scan
const uint8_t LCD_COLS = 16;
const uint8_t LCD_ROWS = 4;
LiquidCrystal_I2C *lcd = nullptr;

// Totals
double totalLiters = 0.0;
unsigned long long totalPulsesAccum = 0; // accumulated pulses across sessions (for calibration)
unsigned long lastMillis = 0;
unsigned long lastSaveMillis = 0;

Preferences prefs;

void IRAM_ATTR pulseISR() {
  pulseCount++;
}

void scanI2C() {
  bool found = false;
  for (uint8_t addr = 1; addr < 127; ++addr) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      if (addr == 0x27 || addr == 0x3F) { lcdAddress = addr; found = true; break; }
      if (!found) { lcdAddress = addr; found = true; }
    }
  }
}

void saveState() {
  prefs.begin("flow", false);
  prefs.putDouble("ppl", PULSES_PER_LITER);
  prefs.putDouble("totalL", totalLiters);
  prefs.putDouble("totalPp", (double)totalPulsesAccum);
  prefs.end();
  Serial.println("State saved to Preferences.");
  // Send reading to server when state is saved
  sendReading();
}

void handleSerial() {
  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s.length() == 0) return;

    if (s.equalsIgnoreCase("r")) {
      // Atomically clear the ISR counter to avoid spurious pulses after reset
      noInterrupts();
      pulseCount = 0;
      interrupts();

      totalLiters = 0.0;
      totalPulsesAccum = 0;
      saveState();
      Serial.println("Total liters, accumulated pulses, and ISR counter reset to 0 and saved.");
    } else if (s.startsWith("c ")) {
      String val = s.substring(2);
      double newPPL = val.toDouble();
      if (newPPL > 0.0) {
        PULSES_PER_LITER = newPPL;
        prefs.begin("flow", false);
        prefs.putDouble("ppl", PULSES_PER_LITER);
        prefs.end();
        Serial.print("PULSES_PER_LITER set to ");
        Serial.println(PULSES_PER_LITER, 6);
      } else {
        Serial.println("Invalid calibration value. Use: c 339.250358");
      }
    } else if (s.equalsIgnoreCase("p")) {
      Serial.print("Total pulses accumulated: ");
      Serial.println((unsigned long long)totalPulsesAccum);
    } else if (s.startsWith("cal ")) {
      String val = s.substring(4);
      double liters = val.toDouble();
      if (liters > 0.0 && totalPulsesAccum > 0) {
        double newPPL = (double)totalPulsesAccum / liters;
        PULSES_PER_LITER = newPPL;
        prefs.begin("flow", false);
        prefs.putDouble("ppl", PULSES_PER_LITER);
        prefs.end();
        Serial.print("CALIBRATION APPLIED. liters=");
        Serial.print(liters, 6);
        Serial.print("  totalPulses=");
        Serial.print((unsigned long long)totalPulsesAccum);
        Serial.print("  -> new PULSES_PER_LITER = ");
        Serial.println(PULSES_PER_LITER, 6);
      } else {
        Serial.println("Invalid cal command. Ensure total pulses > 0 and use: cal 20");
      }
    } else if (s.equalsIgnoreCase("send")) {
      Serial.println("Manual send requested.");
      sendReading();
    } else {
      Serial.println("Commands: r (reset total), c <value> (set pulses per liter), p (print pulses), cal <liters>");
    }
  }
}

// ---- Networking helpers ----
// Configure these for your WiFi and server
const char* WIFI_SSID = "PLDTHOMEFIBRBsDd4"; // <-- set your SSID
const char* WIFI_PASS = "PLDTWIFITd5XU"; // <-- set your password
const char* SERVER_URL = "https://patak-portal.onrender.com/api/readings"; // <-- cloud backend URL
const char* HOUSE_NAME = "house1"; // change per device

// Debug: if set to 1 the device will POST a reading every interval (high traffic)
// set to 0 for normal behaviour (saves only every SAVE_MS and manual 'send').
#define DEBUG_SEND 1
void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting to WiFi '"); Serial.print(WIFI_SSID); Serial.println("'...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(200);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP="); Serial.println(WiFi.localIP());
    // initialize NTP time so we can send ISO timestamps
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("NTP requested");
  } else {
    Serial.println("WiFi connect failed (timeout).");
  }
}

void sendReading() {
  // Must be non-blocking long; keep short and robust
  if (WiFi.status() != WL_CONNECTED) {
    ensureWiFi();
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping send: no WiFi.");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  double cubicMeters = totalLiters / 1000.0;
  // Build JSON body with ISO timestamp (use NTP time if available)
  char body[512];
  time_t now = time(nullptr);
  char iso[64] = "1970-01-01T00:00:00Z";
  if (now > 100000) {
    struct tm t;
    gmtime_r(&now, &t);
    strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);
  }
  snprintf(body, sizeof(body), "{\"house\":\"%s\",\"totalLiters\":%.6f,\"cubicMeters\":%.6f,\"timestamp\":\"%s\"}", HOUSE_NAME, totalLiters, cubicMeters, iso);

  // Debug: print body so we can confirm what's sent
  Serial.print("JSON body: "); Serial.println(body);

  int httpCode = http.POST(String(body));
  Serial.print("POST "); Serial.print(SERVER_URL); Serial.print(" -> "); Serial.println(httpCode);
  if (httpCode > 0) {
    String resp = http.getString();
    Serial.print("Response: "); Serial.println(resp);
  } else {
    Serial.print("HTTP error: "); Serial.println(httpCode);
  }
  http.end();
}

// Helper: print a null-terminated string and pad with spaces up to width
void lcdPrintPadded(int col, int row, const char *s, int width) {
  lcd->setCursor(col, row);
  lcd->print(s);
  int len = strlen(s);
  for (int i = len; i < width; ++i) lcd->print(' ');
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== ESP32 YF-S201 Water Flow Meter (no-blink + noise fix) ===");

  Wire.begin(SDA_PIN, SCL_PIN);

  Serial.println("Scanning I2C bus for LCD...");
  scanI2C();
  Serial.print("Using LCD I2C addr 0x");
  Serial.println(lcdAddress, HEX);

  lcd = new LiquidCrystal_I2C(lcdAddress, LCD_COLS, LCD_ROWS);
  lcd->init();
  lcd->backlight();
  lcd->clear();

  // Print static labels once (no clearing later)
  lcd->setCursor(0,0); lcd->print("Flow:");
  lcd->setCursor(13,0); lcd->print("L/m");

  lcd->setCursor(0,1); lcd->print("Pulses:");

  lcd->setCursor(0,2); lcd->print("Total L:");

  lcd->setCursor(0,3); lcd->print("Cubic m:");

  delay(700);

  // restore saved values (if any)
  prefs.begin("flow", false);
  PULSES_PER_LITER = prefs.getDouble("ppl", PULSES_PER_LITER);
  totalLiters = prefs.getDouble("totalL", 0.0);
  totalPulsesAccum = (unsigned long long)(prefs.getDouble("totalPp", 0.0));
  prefs.end();

  Serial.print("Loaded PULSES_PER_LITER = ");
  Serial.println(PULSES_PER_LITER, 6);
  Serial.print("Loaded totalLiters = ");
  Serial.println(totalLiters, 6);
  Serial.print("Loaded totalPulsesAccum = ");
  Serial.println((unsigned long long)totalPulsesAccum);

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseISR, RISING);

  lastMillis = millis();
  lastSaveMillis = lastMillis;
  Serial.println("Setup complete.\n");

  Serial.println("Serial commands:");
  Serial.println("  r            -> reset totals (and save) [also clears ISR counter]");
  Serial.println("  c <value>    -> set pulses-per-liter, e.g. 'c 339.250358' (saves)");
  Serial.println("  p            -> print total accumulated pulses");
  Serial.println("  cal <liters> -> compute PPL = totalPulsesAccum / <liters>, apply & save");
  Serial.println();
}

void loop() {
  unsigned long now = millis();
  if (now - lastMillis >= INTERVAL_MS) {
    unsigned long elapsed = now - lastMillis;
    lastMillis = now;

    // copy and clear pulse count atomically
    noInterrupts();
    uint32_t pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    // Simple noise filter: treat tiny number of pulses as noise
    if (pulses <= NOISE_PULSE_THRESHOLD) {
      pulses = 0;
    }

    // accumulate pulses for calibration use
    totalPulsesAccum += (unsigned long long)pulses;

    double elapsedSec = elapsed / 1000.0;
    double litersThisInterval = pulses / PULSES_PER_LITER;
    double flowLPerMin = 0.0;
    if (elapsedSec > 0.0) {
      flowLPerMin = (litersThisInterval / elapsedSec) * 60.0;
    }

    // Force very small flows to zero (avoid 0.0002 etc.)
    if (flowLPerMin < FLOW_ZERO_THRESHOLD_LPM) {
      flowLPerMin = 0.0;
    }

    totalLiters += litersThisInterval;
    double cubicMeters = totalLiters / 1000.0;

    // Serial (precise formatting)
    char buf[64];
    dtostrf(flowLPerMin, 0, 3, buf);
    Serial.print("Flow: "); Serial.print(buf); Serial.println(" L/min");
    Serial.print("Pulses: "); Serial.println(pulses);
    dtostrf(totalLiters, 0, 3, buf);
    Serial.print("Total L: "); Serial.println(buf);
    dtostrf(cubicMeters, 0, 6, buf);
    Serial.print("Cubic meters:  "); Serial.println(buf);
    Serial.println();

    // --- LCD updates WITHOUT clearing whole screen ---
    // Row 0: Flow value at col 6, reserve width 7 (e.g. "123.456")
    char flowBuf[12];
    dtostrf(flowLPerMin, 7, 3, flowBuf); // width 7, 3 decimals (pads left)
    lcdPrintPadded(6, 0, flowBuf, 7);

    // Row 0 has "L/m" at col13 already

    // Row 1: Pulses at col 8, reserve width 7
    char pulsesBuf[12];
    snprintf(pulsesBuf, sizeof(pulsesBuf), "%7lu", (unsigned long)pulses);
    lcdPrintPadded(8, 1, pulsesBuf, 7);

    // Row 2: Total L at col 8, reserve width 7 (3 decimals)
    char totalBuf[12];
    dtostrf(totalLiters, 7, 3, totalBuf);
    lcdPrintPadded(8, 2, totalBuf, 7);

    // Row 3: Cubic meters at col 8, reserve width 8 (6 decimals)
    char cubicBuf[16];
    dtostrf(cubicMeters, 8, 6, cubicBuf); // width 8, 6 decimals
    lcdPrintPadded(8, 3, cubicBuf, 8);
    
  #if DEBUG_SEND
    // Debug mode: push this interval's reading to the server immediately
    sendReading();
  #endif
  }

  // periodic save
  if (millis() - lastSaveMillis >= SAVE_MS) {
    lastSaveMillis = millis();
    saveState();
  }

  handleSerial();
}