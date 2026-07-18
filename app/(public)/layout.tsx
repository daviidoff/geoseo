/**
 * Public layout - no authentication required
 * Used for review portal and other public-facing pages
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
