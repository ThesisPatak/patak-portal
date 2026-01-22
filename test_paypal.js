#!/usr/bin/env node
/**
 * PayPal Payment System Test
 * Tests: Create order → Capture order → Verify payment recording
 * 
 * Usage:
 * node test_paypal.js <token> <amount> <billingMonth> <billingYear>
 * 
 * Example:
 * node test_paypal.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... 500 1 2026
 */

const API_URL = 'https://patak-portal-production.up.railway.app';

async function testPayPalPayment(token, amount, billingMonth, billingYear) {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║          PayPal Payment System Test                   ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Create Order
    console.log('📋 STEP 1: Creating PayPal Order');
    console.log(`   Amount: ₱${amount}, Billing: ${billingMonth}/${billingYear}`);
    
    const createResponse = await fetch(`${API_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: String(amount),
        description: `Test Payment - ${billingMonth}/${billingYear}`,
        billingMonth: billingMonth,
        billingYear: billingYear,
      }),
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error('❌ Failed to create order:');
      console.error(JSON.stringify(createData, null, 2));
      return;
    }

    if (!createData.ok || !createData.orderId) {
      console.error('❌ Invalid response format:');
      console.error(JSON.stringify(createData, null, 2));
      return;
    }

    const orderId = createData.orderId;
    const approvalUrl = createData.approvalUrl;

    console.log(`✅ Order created successfully!`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Amount: ${createData.amountDisplay}`);
    console.log(`\n🔗 Approval URL (open in browser):`);
    console.log(`   ${approvalUrl}`);
    console.log(`\n⏳ After you approve payment in PayPal, the system will capture it automatically.`);
    console.log(`   Or run: node test_paypal_capture.js <token> ${orderId} ${billingMonth} ${billingYear}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  console.log('Usage: node test_paypal.js <token> <amount> <billingMonth> <billingYear>');
  console.log('\nExample:');
  console.log('node test_paypal.js eyJhbGc... 500 1 2026');
  process.exit(1);
}

const [token, amount, billingMonth, billingYear] = args;
testPayPalPayment(token, parseInt(amount), parseInt(billingMonth), parseInt(billingYear));
