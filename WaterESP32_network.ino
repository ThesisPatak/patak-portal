// REMOVED: Original ESP32 sketch archived here per project cleanup request.
// If you need the device firmware later, retrieve it from version control history or ask to restore it.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
// Networking
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
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
unsigned long lastTokenPollMillis = 0;  // For polling backend for pending tokens

// Device Authentication
String DEVICE_ID = "ESP32-001";  // Change per device or use MAC address
String DEVICE_TOKEN = "";  // Will be set via serial command or loaded from Preferences

// Backend URL for token claiming
const char* BACKEND_URL = "https://patak-portal-production.up.railway.app";
const unsigned long TOKEN_POLL_INTERVAL = 30000;  // Poll for token every 30 seconds

// Web Server for token reception
WebServer webServer(80);

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
  prefs.putString("deviceToken", DEVICE_TOKEN);  // Save device token
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
    } else if (s.startsWith("token ")) {
      String newToken = s.substring(6);
      DEVICE_TOKEN = newToken;
      prefs.begin("flow", false);
      prefs.putString("deviceToken", DEVICE_TOKEN);
      prefs.end();
      Serial.print("Device token set. Length: ");
      Serial.println(DEVICE_TOKEN.length());
      Serial.println("Token saved to Preferences. Device is now authenticated.");
    } else if (s.equalsIgnoreCase("status")) {
      Serial.print("Device ID: ");
      Serial.println(DEVICE_ID);
      Serial.print("Device Token: ");
      if (DEVICE_TOKEN.length() > 0) {
        Serial.println(DEVICE_TOKEN.substring(0, 16) + "...");
      } else {
        Serial.println("[NOT SET]");
      }
      Serial.print("Total Liters: ");
      Serial.println(totalLiters, 6);
      Serial.print("WiFi: ");
      Serial.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
    } else {
      Serial.println("Commands: r (reset), c <val> (calibrate), p (pulses), cal <liters> (calibrate),");
      Serial.println("send (send reading), token <device_token> (set auth token), status (show status)");
    }
  }
}

// ---- Networking helpers ----
// Configure these for your WiFi and server
const char* WIFI_SSID = "PLDTHOMEFIBRBsDd4"; // <-- set your SSID
const char* WIFI_PASS = "PLDTWIFITd5XU"; // <-- set your password
const char* SERVER_URL = "https://patak-portal-production.up.railway.app/api/readings"; // <-- cloud backend URL
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
    Serial.println("NTP requested - waiting for time sync...");
    
    // Wait for NTP time sync (max 30 seconds)
    time_t now = time(nullptr);
    int ntp_wait = 0;
    while (now < 24 * 3600 && ntp_wait < 60) {  // 24 hours = 86400 seconds
      delay(500);
      now = time(nullptr);
      ntp_wait++;
      if (ntp_wait % 4 == 0) Serial.print('.');
    }
    Serial.println();
    
    if (now > 24 * 3600) {
      Serial.print("✓ NTP synced! Current time: ");
      Serial.println(now);
    } else {
      Serial.println("⚠ NTP sync timeout - using epoch time, readings may show 1970-01-01");
    }
  } else {
    Serial.println("WiFi connect failed (timeout).");
  }
}

void checkForServerCommands() {
  // Check if server has any commands for this device (e.g., reset)
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  http.begin("https://patak-portal-production.up.railway.app/devices/check-commands");
  http.addHeader("Content-Type", "application/json");
  
  char body[256];
  snprintf(body, sizeof(body), "{\"deviceId\":\"%s\"}", DEVICE_ID.c_str());
  
  int httpCode = http.POST(String(body));
  if (httpCode == 200) {
    String resp = http.getString();
    if (resp.indexOf("\"reset\"") != -1) {
      Serial.println("[SERVER COMMAND] Reset requested by admin");
      // Reset the meter
      noInterrupts();
      pulseCount = 0;
      interrupts();
      totalLiters = 0.0;
      totalPulsesAccum = 0;
      saveState();
      Serial.println("Device reset to 0 liters per server command");
    }
  }
  http.end();
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
  
  // Add device token authentication if available
  if (DEVICE_TOKEN.length() > 0) {
    String authHeader = "Bearer " + DEVICE_TOKEN;
    http.addHeader("Authorization", authHeader);
    Serial.println("Sending with device token authentication");
  } else {
    Serial.println("[WARNING] No device token set. Data may be rejected.");
  }

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

// Poll backend for pending token (cloud-based device linking)
void pollForToken() {
  if (DEVICE_TOKEN.length() > 0) {
    // Already have token, no need to poll
    return;
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    // No internet, can't poll
    return;
  }
  
  unsigned long now = millis();
  if (now - lastTokenPollMillis < TOKEN_POLL_INTERVAL) {
    // Not time to poll yet
    return;
  }
  
  lastTokenPollMillis = now;
  Serial.println("[TOKEN-POLL] Checking backend for pending token...");
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/devices/claim-token";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  String jsonPayload = "{\"deviceId\":\"" + DEVICE_ID + "\"}";
  int httpCode = http.POST(jsonPayload);
  
  if (httpCode == 200) {
    // Token available
    String response = http.getString();
    Serial.println("[TOKEN-POLL] ✓ Received token!");
    
    // Parse JSON response to extract token
    int tokenStart = response.indexOf("\"token\":\"") + 9;
    int tokenEnd = response.indexOf("\"", tokenStart);
    
    if (tokenStart > 8 && tokenEnd > tokenStart) {
      DEVICE_TOKEN = response.substring(tokenStart, tokenEnd);
      
      // Save to Preferences
      prefs.begin("flow", false);
      prefs.putString("deviceToken", DEVICE_TOKEN);
      prefs.end();
      
      Serial.println("[TOKEN-POLL] ✓ Token saved to flash storage!");
      Serial.println("[TOKEN-POLL] Device is now linked. Ready to send readings!");
    }
  } else if (httpCode == 202) {
    // No token pending yet
    Serial.println("[TOKEN-POLL] ℹ No pending token yet. User hasn't clicked LINK.");
  } else {
    Serial.println("[TOKEN-POLL] ✗ Error: " + String(httpCode));
  }
  
  http.end();
}

// Web Server Endpoints for token reception
void setupWebServer() {
  // Endpoint to receive device token from mobile app
  webServer.on("/api/token", HTTP_POST, []() {
    if (webServer.hasArg("plain")) {
      String body = webServer.arg("plain");
      // Parse JSON: {"token": "TOKEN_VALUE"}
      int tokenStart = body.indexOf("\"token\":\"") + 9;
      int tokenEnd = body.indexOf("\"", tokenStart);
      if (tokenStart > 8 && tokenEnd > tokenStart) {
        String newToken = body.substring(tokenStart, tokenEnd);
        DEVICE_TOKEN = newToken;
        prefs.begin("flow", false);
        prefs.putString("deviceToken", DEVICE_TOKEN);
        prefs.end();
        Serial.println("[WEB] ✓ Device token received and saved!");
        webServer.send(200, "application/json", "{\"ok\":true,\"message\":\"Token saved\"}");
        return;
      }
    }
    webServer.send(400, "application/json", "{\"error\":\"Invalid token\"}");
  });

  // Simple status page
  webServer.on("/", HTTP_GET, []() {
    String html = "<html><body style='font-family:Arial;'>";
    html += "<h1>ESP32 Water Meter</h1>";
    html += "<p><b>Device ID:</b> " + DEVICE_ID + "</p>";
    html += "<p><b>Token Status:</b> " + String(DEVICE_TOKEN.length() > 0 ? "✓ Connected" : "✗ Not linked") + "</p>";
    html += "<p><b>WiFi:</b> " + String(WiFi.status() == WL_CONNECTED ? "✓ Connected" : "✗ Disconnected") + "</p>";
    html += "<p><b>Total Liters:</b> " + String(totalLiters, 2) + "</p>";
    html += "</body></html>";
    webServer.send(200, "text/html", html);
  });

  webServer.begin();
  Serial.println("[WEB] Web server started on http://" + WiFi.localIP().toString());
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
  DEVICE_TOKEN = prefs.getString("deviceToken", "");  // Load device token
  prefs.end();

  Serial.print("Loaded PULSES_PER_LITER = ");
  Serial.println(PULSES_PER_LITER, 6);
  
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  if (DEVICE_TOKEN.length() > 0) {
    Serial.println("Device token loaded from Preferences (authenticated)");
  } else {
    Serial.println("[!] No device token found. Register device in mobile app or use web interface.");
  }
  Serial.print("Loaded totalLiters = ");
  Serial.println(totalLiters, 6);
  Serial.print("Loaded totalPulsesAccum = ");
  Serial.println((unsigned long long)totalPulsesAccum);

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseISR, RISING);

  lastMillis = millis();
  lastSaveMillis = lastMillis;
  
  // Initialize WiFi and web server
  Serial.println("Starting WiFi connection...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    // Initialize mDNS for auto-discovery
    String mdnsHostname = DEVICE_ID;
    mdnsHostname.toLowerCase();
    mdnsHostname.replace("_", "-");
    
    if (MDNS.begin(mdnsHostname.c_str())) {
      Serial.print("✓ mDNS started as: ");
      Serial.print(mdnsHostname);
      Serial.println(".local");
      MDNS.addService("http", "tcp", 80);
    } else {
      Serial.println("✗ mDNS failed");
    }
    
    setupWebServer();  // Start web server for token reception
  } else {
    Serial.println("\n✗ WiFi connection failed");
  }
  
  Serial.println("Setup complete.\n");

  Serial.println("Serial commands:");
  Serial.println("  r            -> reset totals (and save) [also clears ISR counter]");
  Serial.println("  c <value>    -> set pulses-per-liter, e.g. 'c 339.250358' (saves)");
  Serial.println("  p            -> print total accumulated pulses");
  Serial.println("  cal <liters> -> compute PPL = totalPulsesAccum / <liters>, apply & save");
  Serial.println();
}

// Check for reset commands from server
void checkForResetCommand() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/device/" + DEVICE_ID + "/pending-commands";
  http.begin(url);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    Serial.print("[RESET-CHECK] Response: ");
    Serial.println(response);
    
    if (response.indexOf("\"hasPendingCommands\":true") != -1 && 
        response.indexOf("\"RESET_METER\"") != -1) {
      Serial.println("[RESET-CHECK] ✓ Reset command received from server!");
      
      // Execute reset
      noInterrupts();
      pulseCount = 0;
      interrupts();
      
      totalLiters = 0.0;
      totalPulsesAccum = 0;
      saveState();
      
      Serial.println("[RESET-CHECK] ✓ Meter reset to 0 by admin command");
      Serial.println("[RESET-CHECK] Next reading will show 0.0 m³");
    }
  } else if (httpCode > 0) {
    Serial.print("[RESET-CHECK] HTTP error: ");
    Serial.println(httpCode);
  }
  http.end();
}

void loop() {
  unsigned long now = millis();
  
  // Handle web server requests
  webServer.handleClient();
  
  // Poll backend for pending token (cloud-based linking)
  pollForToken();
  
  // Check for reset commands from admin dashboard (every 5 seconds)
  static unsigned long lastCmdCheck = 0;
  if (now - lastCmdCheck >= 5000) {
    lastCmdCheck = now;
    checkForResetCommand();
  }
  
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

  // Check for server commands every 30 seconds
  static unsigned long lastCommandCheck = 0;
  if (millis() - lastCommandCheck >= 30000) {
    lastCommandCheck = millis();
    checkForServerCommands();
  }

  handleSerial();
}