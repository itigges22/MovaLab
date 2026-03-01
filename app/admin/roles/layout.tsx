import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Role Management',
};

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
