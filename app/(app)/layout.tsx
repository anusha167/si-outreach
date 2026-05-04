import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { Header } from '@/components/header';
import { TabsNav } from '@/components/tabs-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col">
      <Header userName={profile.name} userRole={profile.role} />
      <TabsNav />
      <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">{children}</main>
    </div>
  );
}
