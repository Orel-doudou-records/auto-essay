import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AppShellProps {
  projectId?: string;
  children: React.ReactNode;
}

export function AppShell({ projectId, children }: AppShellProps) {
  const location = useLocation();

  const projectLinks = projectId
    ? [
        { to: `/projects/${projectId}`, label: "Projet" },
        { to: `/projects/${projectId}/sources`, label: "Sources" },
        { to: `/projects/${projectId}/editor`, label: "Éditeur" },
        { to: `/projects/${projectId}/atelier`, label: "Atelier" },
        { to: `/projects/${projectId}/chapitre`, label: "Chapitre" },
      ]
    : [];

  const topLinks = [
    { to: "/", label: "Projets" },
    { to: "/demo", label: "Démo" },
  ];

  const links = [...topLinks, ...projectLinks];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/40 p-4">
        <div className="mb-6 text-lg font-semibold">auto-essay</div>
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                location.pathname === link.to && "bg-accent text-accent-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
