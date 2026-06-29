import { auth } from '@/auth';
import SubmitScoreForm from './SubmitScoreForm';

export default async function SubmitScorePage() {
  const session = await auth();
  return <SubmitScoreForm userName={session!.user.name ?? 'You'} />;
}
