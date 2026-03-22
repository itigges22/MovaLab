import { NotFoundContent } from '@/components/not-found-content'

export default function NotFound() {
  return (
    <NotFoundContent
      backLink="/dashboard"
      backLabel="Back to Dashboard"
    />
  )
}
