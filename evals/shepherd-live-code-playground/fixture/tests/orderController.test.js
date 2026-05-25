const assert = require('node:assert/strict');
const { createOrder } = require('../src/orderController');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('creates an order total with tax', () => {
  const result = createOrder({
    items: [
      { sku: 'A', quantity: 2, unitPrice: 10 },
      { sku: 'B', quantity: 1, unitPrice: 5 }
    ]
  });

  assert.deepEqual(result, {
    ok: true,
    order: {
      itemCount: 3,
      subtotal: 25,
      tax: 5,
      total: 30
    }
  });
});

test('rejects empty carts with a field-specific error', () => {
  const result = createOrder({ items: [] });

  assert.deepEqual(result, {
    ok: false,
    errors: {
      items: 'Add at least one item.'
    }
  });
});
