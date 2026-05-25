import { auth } from '@/auth';
import ContactForm from './ContactForm';

export default async function ContactPage() {
  const session = await auth();
  const isLoggedIn = !!session;

  return <ContactForm isLoggedIn={isLoggedIn} />;
}
