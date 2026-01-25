# PATAK Water Billing System - Consumption & Payment Logic Fix

## Current Issues

### 1. **Cumulative vs Period Consumption Confusion**
```javascript
// CURRENT (WRONG):
currentConsumption = latestMeterReading // e.g., 145.5 m³
// This is TOTAL ever used, not current period usage!

// CORRECT (NEEDED):
currentConsumption = latestReading - readingAtPeriodStart
// e.g., 145.5 - 135.2 = 10.3 m³ for this month
```

### 2. **No Period Start/End Readings Stored**
The system doesn't track:
- What the meter read when the billing period started
- What the meter read when the billing period ended
- So it can't calculate actual usage per period

### 3. **Previous Reading Not Saved**
When a user pays, there's no mechanism to:
- Save the current reading as "period end"
- Reset for next period with new "period start"
- Track historical meter values

---

## Correct Implementation

### **Database Schema Needed**
```json
// payments.json should include:
{
  "id": "payment-123",
  "userId": "user-1",
  "username": "house1",
  "amount": 310.50,
  "billingMonth": 2,
  "billingYear": 2026,
  "status": "verified",
  "createdAt": "2026-02-15T10:30:00Z",
  
  // IMPORTANT: Store readings at time of payment
  "meterReadingAtPayment": 135.2,  // <- ADD THIS
  "previousMeterReading": 125.0,   // <- ADD THIS (from last payment)
  "consumptionThisPeriod": 10.2,   // <- ADD THIS (meterAtPayment - previousMeterReading)
  
  "paymentMethod": "gcash",
  "paymentReference": "GC-123456789"
}
```

### **Reading Tracking Needed**
```json
// Each reading from ESP32 should have:
{
  "id": "reading-123",
  "deviceId": "ESP32-002",
  "house": "house2",
  "cubicMeters": 145.5,  // Always cumulative
  "totalLiters": 145500,
  "timestamp": "2026-02-10T08:15:00Z",
  "receivedAt": "2026-02-10T08:15:05Z",
  
  // IMPORTANT: Track if this reading closes a billing period
  "billingPeriodEndReading": false,
  "billingPeriodClosedAt": null,
  "belongsToBillingPeriod": "2026-02"
}
```

---

## How It Should Work (Business Logic)

### **Scenario: User registers Jan 25, pays monthly**

```
JANUARY (Jan 25 - Feb 24)
├─ Jan 25: User registers
├─ Jan 25: ESP32 starts sending readings (starts at 0 m³)
├─ Daily readings: Jan 26 (2.5), Jan 27 (5.1), Feb 1 (8.7), etc.
├─ Feb 24: End of period
│   └─ Meter reading: 11.2 m³
│   └─ Consumption: 11.2 - 0 = 11.2 m³
│   └─ Bill: ₱255 (minimum for ≤10m³) + ₱37.20 excess = ₱292.20
├─ Feb 15: USER PAYS ₱292.20
│   └─ Payment recorded with:
│       ├─ meterReadingAtPayment: 11.2
│       ├─ previousMeterReading: 0
│       ├─ consumptionThisPeriod: 11.2
│   └─ Billing period CLOSES
│   └─ Reading shown: 11.2 m³ (SAVED as previous period reading)

FEBRUARY (Feb 25 - Mar 24) [NEW PERIOD STARTS]
├─ Feb 25: New billing period starts
│   └─ lastPaymentMeterReading: 11.2 (this becomes the baseline)
├─ Daily readings: Feb 26 (12.5), Mar 1 (15.8), etc.
│   └─ These are all >= 11.2 (never reset the physical meter!)
├─ Mar 24: End of period
│   └─ Meter reading: 22.5 m³
│   └─ Consumption: 22.5 - 11.2 = 11.3 m³ (for FEB period)
│   └─ Bill: ₱292.50
└─ User pays → cycle repeats
```

---

## What Needs to Change

### **1. When Payment is Recorded:**
Instead of just saving payment, ALSO:
- Get the current meter reading from latest ESP32 reading
- Save it in the payment record as `meterReadingAtPayment`
- This reading becomes the baseline for next period

### **2. When Calculating Consumption:**
For any billing period:
```
startOfPeriodReading = lastPaymentMeterReading (or initial if first period)
endOfPeriodReading = latestMeterReading
consumptionThisPeriod = endOfPeriodReading - startOfPeriodReading
```

### **3. In Web Admin (BillingTable.tsx):**
Show:
- **Previous Reading:** Meter value when last payment was made
- **Current Reading:** Latest meter value from ESP32
- **Consumption:** Current - Previous (NOT just "current reading")

### **4. In Mobile App (BillingHistoryScreen.js):**
Show:
- **Period Consumption:** Calculated from stored readings
- **Bill Amount:** Based on consumption, not on latest meter reading

### **5. ESP32 Firmware:**
- NEVER reset meter reading on payment
- Always send cumulative total
- Continue reading indefinitely

---

## Implementation Checklist

- [ ] Modify `/api/payments/record` endpoint to capture meter reading at payment time
- [ ] Update `/api/paymongo/submit-payment` to capture meter reading
- [ ] Add `previousMeterReading` calculation when processing payments
- [ ] Update BillingTable.tsx to show period-based consumption
- [ ] Update BillingHistoryScreen.js to calculate consumption correctly
- [ ] Add migration to update old payments with meter readings
- [ ] Test scenario: Register → Add readings → Pay → Verify consumption resets for next period

