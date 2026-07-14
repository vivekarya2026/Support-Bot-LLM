/**
 * Root admin layout is a passthrough: /admin (workspace index) and
 * /admin/settings render their own chrome, while /admin/[botSlug]/* mounts
 * the workspace sidebar in its own nested layout.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
