import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Time Entries',
};

export default function TimeEntriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
