interface Order {
  id: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  paymentIntentId: string;
  amountCents: number;
}

/**
 * cancelOrder — marks an order cancelled and issues a refund for the captured payment.
 *
 * This repo has no CONTEXT.md / CONTEXT-MAP.md — there is no recorded domain glossary.
 */
export async function cancelOrder(order: Order): Promise<Order> {
  if (order.status === 'fulfilled') {
    throw new Error('Cannot cancel an order that has already been fulfilled');
  }

  await issueRefund(order.paymentIntentId, order.amountCents);

  return { ...order, status: 'cancelled' };
}

async function issueRefund(paymentIntentId: string, amountCents: number): Promise<void> {
  // Stub: returns money to the customer via the payment provider for fixture purposes.
  console.log(`refunding ${amountCents} cents for payment intent ${paymentIntentId}`);
}
