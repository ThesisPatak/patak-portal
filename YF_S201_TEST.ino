// YF-S201 Water Flow Sensor TEST CODE
// Tests if the sensor is working without WiFi/networking
// Uses same pins as main code: GPIO14, SDA=21, SCL=22

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const uint8_t FLOW_PIN = 14;           // YF-S201 signal -> ESP32 GPIO14
volatile uint32_t pulseCount = 0;      // incremented in ISR

// Calibration value (from your main code)
double PULSES_PER_LITER = 388.8;

// I2C pins (explicit)
const uint8_t SDA_PIN = 21;
const uint8_t SCL_PIN = 22;

// LCD settings
uint8_t lcdAddress = 0x27;
const uint8_t LCD_COLS = 16;
const uint8_t LCD_ROWS = 4;
LiquidCrystal_I2C *lcd = nullptr;

// Counters
double totalLiters = 0.0;
unsigned long lastMillis = 0;
unsigned long pulsesSinceReset = 0;

void IRAM_ATTR pulseISR() {
  pulseCount++;
}

void scanI2C() {
  bool found = false;
  Serial.println("\n=== I2C SCAN ===");
  for (uint8_t addr = 1; addr < 127; ++addr) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Found device at 0x");
      Serial.println(addr, HEX);
      if (addr == 0x27 || addr == 0x3F) { 
        lcdAddress = addr; 
        found = true; 
        break; 
      }
      if (!found) { 
        lcdAddress = addr; 
        found = true; 
      }
    }
  }
  Serial.println("=== END SCAN ===\n");
}

void handleSerial() {
  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s.length() == 0) return;

    if (s.equalsIgnoreCase("r")) {
      // Reset pulse counter
      noInterrupts();
      pulseCount = 0;
      interrupts();
      pulsesSinceReset = 0;
      totalLiters = 0.0;
      Serial.println("✓ Reset: Pulses and totals cleared");
      
    } else if (s.equalsIgnoreCase("p")) {
      // Print current pulses
      Serial.print("Pulses since reset: ");
      Serial.println(pulsesSinceReset);
      Serial.print("Current interval pulses (ISR counter): ");
      Serial.println(pulseCount);
      
    } else if (s.equalsIgnoreCase("c")) {
      // Calibration value
      Serial.print("Current PULSES_PER_LITER: ");
      Serial.println(PULSES_PER_LITER, 6);
      Serial.print("Total Liters: ");
      Serial.println(totalLiters, 6);
      
    } else if (s.startsWith("cal ")) {
      // Set new calibration
      String val = s.substring(4);
      double newPPL = val.toDouble();
      if (newPPL > 0.0) {
        PULSES_PER_LITER = newPPL;
        Serial.print("✓ PULSES_PER_LITER set to: ");
        Serial.println(PULSES_PER_LITER, 6);
      } else {
        Serial.println("✗ Invalid value. Use: cal 388.8");
      }
      
    } else if (s.equalsIgnoreCase("status")) {
      Serial.println("\n=== SENSOR STATUS ===");
      Serial.print("GPIO14 connected: ");
      Serial.println("Yes (check with multimeter if unsure)");
      Serial.print("LCD connected: ");
      Serial.println(lcd ? "Yes" : "No");
      Serial.print("Pulses per second: ");
      Serial.println(pulseCount);
      Serial.print("Total pulses accumulated: ");
      Serial.println(pulsesSinceReset);
      Serial.print("Total liters: ");
      Serial.println(totalLiters, 6);
      Serial.println("=== END STATUS ===\n");
      
    } else if (s.equalsIgnoreCase("test")) {
      Serial.println("\n=== RESISTOR DIAGNOSIS ===");
      Serial.println("To check if you need a pull-up resistor:");
      Serial.println("");
      Serial.println("1. With multimeter set to DC voltage:");
      Serial.println("   - Measure GPIO14 to GND");
      Serial.println("   - Should be ~3.3V when no water flowing");
      Serial.println("   - Should pulse to ~0V when water flows");
      Serial.println("");
      Serial.println("2. If GPIO14 stays at 0V or doesn't change:");
      Serial.println("   - Add 10kΩ pull-up resistor:");
      Serial.println("     (+3.3V) ---|10kΩ|---+--- (GPIO14)");
      Serial.println("                         |");
      Serial.println("                      (sensor out)");
      Serial.println("");
      Serial.println("3. YF-S201 pin connections:");
      Serial.println("   Red   -> +5V");
      Serial.println("   Black -> GND");
      Serial.println("   Yellow -> GPIO14 (with pull-up resistor)");
      Serial.println("==============================\n");
      
    } else if (s.equalsIgnoreCase("help")) {
      printCommands();
    } else {
      Serial.println("Unknown command. Type 'help' for list.");
    }
  }
}

void printCommands() {
  Serial.println("\n=== YF-S201 TEST COMMANDS ===");
  Serial.println("r              -> Reset counters");
  Serial.println("p              -> Print pulse count");
  Serial.println("c              -> Show calibration & total liters");
  Serial.println("cal <value>    -> Set new PULSES_PER_LITER (e.g., cal 388.8)");
  Serial.println("status         -> Full sensor status");
  Serial.println("test           -> Pin voltage test (requires multimeter)");
  Serial.println("help           -> Show this menu");
  Serial.println("==============================\n");
}

void lcdPrintPadded(int col, int row, const char *s, int width) {
  lcd->setCursor(col, row);
  lcd->print(s);
  int len = strlen(s);
  for (int i = len; i < width; ++i) lcd->print(' ');
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║  YF-S201 WATER FLOW SENSOR TEST CODE   ║");
  Serial.println("║  Testing GPIO14 sensor on ESP32        ║");
  Serial.println("╚════════════════════════════════════════╝\n");

  // Initialize I2C and LCD
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(200);
  
  scanI2C();
  
  if (lcdAddress != 0) {
    lcd = new LiquidCrystal_I2C(lcdAddress, LCD_COLS, LCD_ROWS);
    lcd->init();
    lcd->backlight();
    lcd->clear();
    
    lcd->setCursor(2, 0);
    lcd->print("SENSOR TEST");
    
    lcd->setCursor(0, 1);
    lcd->print("Flow: ");
    
    lcd->setCursor(0, 2);
    lcd->print("PPL: ");
    
    lcd->setCursor(0, 3);
    lcd->print("Total L: ");
    
    Serial.println("✓ LCD initialized at 0x" + String(lcdAddress, HEX));
  } else {
    Serial.println("✗ LCD NOT FOUND - continuing without display");
  }

  // Setup sensor pin
  // Try INPUT_PULLUP first - works if internal pull-up is strong enough
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseISR, RISING);
  Serial.println("✓ GPIO14 interrupt configured (INPUT_PULLUP mode)\n");
  
  Serial.println("⚠ RESISTOR TROUBLESHOOTING:");
  Serial.println("   If no pulses detected:");
  Serial.println("   1. Add 10kΩ external pull-up resistor between GPIO14 and +3.3V");
  Serial.println("   2. Or use 'alt' command to try different pin modes");
  Serial.println("");
  
  lastMillis = millis();
  
  Serial.println("Ready! Water flowing through YF-S201 should show pulses.");
  Serial.println("Type 'help' for commands.\n");
  printCommands();
}

void loop() {
  unsigned long now = millis();
  
  // Every 1 second, calculate flow
  if (now - lastMillis >= 1000) {
    unsigned long elapsed = now - lastMillis;
    lastMillis = now;

    // Get pulse count atomically
    noInterrupts();
    uint32_t pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    pulsesSinceReset += pulses;
    
    // Calculate flow rate
    double litersThisSecond = pulses / PULSES_PER_LITER;
    double flowLPerMin = litersThisSecond * 60.0;
    totalLiters += litersThisSecond;

    // Print to Serial
    Serial.print("[");
    Serial.print(millis() / 1000);
    Serial.print("s] ");
    Serial.print("Pulses: ");
    Serial.print(pulses);
    Serial.print("  Flow: ");
    Serial.print(flowLPerMin, 2);
    Serial.print(" L/min  Total: ");
    Serial.print(totalLiters, 3);
    Serial.println(" L");

    // Update LCD if available
    if (lcd) {
      char buf[16];
      
      // Flow rate
      dtostrf(flowLPerMin, 7, 2, buf);
      lcdPrintPadded(6, 1, buf, 9);
      
      // PPL
      dtostrf(PULSES_PER_LITER, 5, 1, buf);
      lcdPrintPadded(5, 2, buf, 10);
      
      // Total liters
      dtostrf(totalLiters, 6, 2, buf);
      lcdPrintPadded(9, 3, buf, 6);
    }

    // If no flow for 5 seconds, show warning
    if (pulses == 0) {
      static int noFlowCount = 0;
      noFlowCount++;
      if (noFlowCount >= 5) {
        Serial.println("⚠ WARNING: No pulses detected for 5 seconds");
        Serial.println("  - Check if water is flowing through sensor");
        Serial.println("  - Check GPIO14 pin connection");
        Serial.println("  - Check sensor power (5V)");
        noFlowCount = 0;
      }
    } else {
      // Reset no-flow warning counter
      static int noFlowCount = 0;
      noFlowCount = 0;
    }
  }

  handleSerial();
}
