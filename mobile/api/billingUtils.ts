/**
 * Shared Billing Utilities
 * Used by: BillingTable.tsx, AdminDashboard.tsx, DashboardScreen.jsx, BillingHistoryScreen.js
 * 
 * This centralized utility prevents code duplication and ensures consistent
 * billing calculations across all platforms (web & mobile).
 */

// Tiered water billing calculation based on residential rates
// Tier 1 (0-10 m³): ₱255.00 minimum
// Tier 2 (11-20 m³): ₱33.00 per m³
// Tier 3 (21-30 m³): ₱40.50 per m³
// Tier 4 (31-40 m³): ₱48.00 per m³
// Tier 5 (41+ m³): ₱55.50 per m³

export function computeResidentialBill(usage: number | any): number {
  const MINIMUM = 255.0;
  
  // Always charge minimum even with zero usage
  if (!usage || usage <= 0) return MINIMUM;
  
  if (usage <= 10) return Number(MINIMUM.toFixed(2));
  
  let excess = usage - 10;
  let total = MINIMUM;
  
  if (excess > 0) {
    const m3 = Math.min(excess, 10);
    total += m3 * 33.0; // 11-20 m³
    excess -= m3;
  }
  
  if (excess > 0) {
    const m3 = Math.min(excess, 10);
    total += m3 * 40.5; // 21-30 m³
    excess -= m3;
  }
  
  if (excess > 0) {
    const m3 = Math.min(excess, 10);
    total += m3 * 48.0; // 31-40 m³
    excess -= m3;
  }
  
  if (excess > 0) {
    total += excess * 55.5; // 41+ m³
  }
  
  return Number(total.toFixed(2));
}

// Type definitions for billing periods
export interface BillingPeriod {
  month: string;
  consumption: string;
  totalConsumption: string;
  amountDue: string;
  billStatus: string;
  statusColor: string;
  statusIcon: string;
  dueDate: string;
  paymentDate?: string;
  paymentAmount?: string;
}

// Generate billing history with 31-day cycles
export function generateBillingHistory(
  readings: any[],
  createdAt: string,
  payments: any[] = []
): BillingPeriod[] {
  const history: BillingPeriod[] = [];

  // Get the latest meter reading (cumulative total)
  const allReadings = readings || [];
  let latestMeterReading = 0;
  let firstReadingDate: Date | null = null;
  
  if (allReadings.length > 0) {
    // Sort by date ascending to get first reading
    const sorted = allReadings.sort((a: any, b: any) => {
      const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
      const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });
    firstReadingDate = sorted[0].receivedAt ? new Date(sorted[0].receivedAt) : new Date(sorted[0].timestamp);
    
    // Get latest reading
    const sortedDesc = allReadings.sort((a: any, b: any) => {
      const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
      const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });
    latestMeterReading = sortedDesc[0].cubicMeters || 0;
  }

  // Generate two 31-day billing cycles starting from account creation date
  const billingBaseDate = new Date(createdAt);
  let previousPeriodLastReading = 0; // Track meter reading at end of previous PAID period

  // Generate current + next 31-day billing period (continuous billing cycle)
  // Limit to 2 cycles maximum
  const maxCycles = 2;
  for (let i = 0; i < maxCycles; i++) {
    const periodStartDate = new Date(billingBaseDate);
    periodStartDate.setDate(periodStartDate.getDate() + (i * 31));
    
    const periodEndDate = new Date(periodStartDate);
    periodEndDate.setDate(periodEndDate.getDate() + 31);

    // Get readings for this period
    const periodReadings = (readings || [])
      .filter((r) => {
        const readingDate = r.receivedAt ? new Date(r.receivedAt) : new Date(r.timestamp);
        return readingDate >= periodStartDate && readingDate < periodEndDate;
      })
      .sort((a, b) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
        const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
        return dateA.getTime() - dateB.getTime();
      });

    let consumption = 0;

    // Status will be determined after payment check
    let billStatus = 'Pending';
    let statusColor = '#ff9800';
    let statusIcon = '⏳';

    // Calculate billing month and year EARLY to check if this period was paid
    const billingMonth = periodStartDate.getMonth() + 1;
    const billingYear = periodStartDate.getFullYear();

    // Check if payment exists and is verified for this billing period
    const payment = payments.find(p => 
      p.billingMonth === billingMonth && 
      p.billingYear === billingYear && 
      (p.status === 'verified' || p.status === 'confirmed' || p.status === 'PAID')
    );

    // COMMONSENSE FIX: For PAID periods, use locked consumption OR calculated
    // For CURRENT period, use latest meter - previous paid baseline
    if (payment && payment.lockedConsumption !== undefined && payment.lockedConsumption !== null && payment.lockedConsumption > 0) {
      // Use locked consumption for paid period (this is what was actually paid)
      consumption = payment.lockedConsumption;
      if (periodReadings.length > 0) {
        previousPeriodLastReading = periodReadings[periodReadings.length - 1].cubicMeters;
      }
    } else if (periodReadings.length > 0) {
      // Calculate consumption as DIFFERENCE between period readings
      const firstReading = periodReadings[0];
      const lastReading = periodReadings[periodReadings.length - 1];
      consumption = Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
      previousPeriodLastReading = lastReading.cubicMeters;
    } else if (i > 0 && previousPeriodLastReading > 0) {
      // CRITICAL FIX: Current period has NO readings yet, but previous was paid
      // Use: Current meter reading - Previous paid baseline = Current consumption
      consumption = Math.max(0, latestMeterReading - previousPeriodLastReading);
    } else if (i === 0 && allReadings.length > 0) {
      // First period with readings but no period-specific readings yet - show current meter reading
      consumption = Math.max(0, latestMeterReading);
    }
    // Note: For periods with no readings at all, consumption stays 0
    // which will trigger minimum charge in computeResidentialBill()

    const monthStr = `${periodStartDate.toLocaleString('default',{month:'short', day:'numeric'})} – ${new Date(periodEndDate.getTime()-1).toLocaleString('default',{month:'short', day:'numeric', year:'numeric'})}`;
    const amountDue = computeResidentialBill(consumption);

    // Total consumption shows the cumulative meter reading
    // For upcoming periods with no consumption data yet, still apply minimum charge
    const totalConsumption = latestMeterReading.toFixed(6);

    // Update status to PAID if payment found
    let paymentDate = '';
    if (payment) {
      billStatus = 'Paid';
      statusColor = '#059669';
      statusIcon = '✅';
      const dateToUse = payment.paymentDate || payment.createdAt;
      if (dateToUse) {
        paymentDate = new Date(dateToUse).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } else if (i === 0) {
      billStatus = 'Current';
      statusColor = '#3b82f6';
      statusIcon = '📊';
    }

    const dueDate = new Date(firstReadingDate);
    dueDate.setMonth(dueDate.getMonth() + 1);

    history.push({
      month: monthStr,
      consumption: consumption.toFixed(6),
      totalConsumption: totalConsumption,
      amountDue: `₱${amountDue.toFixed(2)}`,
      billStatus: billStatus,
      statusColor: statusColor,
      statusIcon: statusIcon,
      dueDate: dueDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      paymentDate: paymentDate
    });
  }

  return history;
}

// Export all for compatibility
export default {
  computeResidentialBill,
  generateBillingHistory
};
