import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new MovaLab account.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
