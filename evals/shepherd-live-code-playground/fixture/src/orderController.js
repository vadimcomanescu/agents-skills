function money(value) {
  return Math.round(value * 100) / 100;
}

function createOrder(input) {
  const errors = {};

  if (!input || !Array.isArray(input.items) || input.items.length === 0) {
    errors.items = 'Add at least one item.';
  }

  const items = Array.isArray(input && input.items) ? input.items : [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.sku) {
      errors[`items.${index}.sku`] = 'SKU is required.';
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      errors[`items.${index}.quantity`] = 'Quantity must be a positive integer.';
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      errors[`items.${index}.unitPrice`] = 'Unit price must be zero or greater.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  let subtotal = 0;
  for (const item of items) {
    subtotal += item.quantity * item.unitPrice;
  }

  const tax = money(subtotal * 0.2);
  const total = money(subtotal + tax);

  return {
    ok: true,
    order: {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: money(subtotal),
      tax,
      total
    }
  };
}

module.exports = { createOrder };
