import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pending Users',
};

export default function PendingUsersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
