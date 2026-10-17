import { redirect } from 'next/navigation';

/** Pricing page removed — schools call for a quote. */
export default function PricingRedirectPage() {
  redirect('/contact#book-demo');
}
