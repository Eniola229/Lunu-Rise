import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

export default async function handler(req, res) {
  const { planId, userEmail, amount_usd } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Plan ${planId}` },
          unit_amount: amount_usd * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?canceled=true`,
    billing_address_collection: 'auto', // prevents manual country selection if possible
  });

  res.status(200).json({ url: session.url, sessionId: session.id });
}
