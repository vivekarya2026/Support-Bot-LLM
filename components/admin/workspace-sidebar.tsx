"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronsUpDown,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_COLLAPSED_KEY = "sk:sidebar:collapsed";

type SidebarBot = {
  slug: string;
  name: string;
  primaryColor: string;
  newSupportCount?: number;
};

type CurrentBot = { slug: string; name: string; primaryColor: string };

const NAV = [
  { seg: "", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { seg: "/settings", label: "Bot Settings", icon: Settings },
  { seg: "/prompts", label: "Prompts", icon: ScrollText },
  { seg: "/docs", label: "Knowledge Base", icon: BookOpen },
  { seg: "/social", label: "Social Listening", icon: Radar },
  { seg: "/conversations", label: "Conversations", icon: MessagesSquare },
  { seg: "/support", label: "Support Requests", icon: LifeBuoy },
];

export function WorkspaceSidebar({
  bots,
  current,
}: {
  bots: SidebarBot[];
  current: CurrentBot;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <MobileNav bots={bots} current={current} />
      <aside
        className={cn(
          "hidden lg:flex shrink-0 border-r border-border bg-card/40 flex-col overflow-hidden",
          "transition-[width] duration-200 motion-reduce:transition-none",
          collapsed ? "w-14" : "w-60"
        )}
        data-collapsed={hydrated && collapsed ? "true" : "false"}
      >
        <SidebarContent
          bots={bots}
          current={current}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>
    </TooltipProvider>
  );
}

function MobileNav({
  bots,
  current,
}: {
  bots: SidebarBot[];
  current: CurrentBot;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="lg:hidden sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open navigation"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Menu className="size-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          <SidebarContent bots={bots} current={current} collapsed={false} />
        </SheetContent>
      </Sheet>
      <BotAvatar color={current.primaryColor} />
      <span className="truncate text-sm font-medium">{current.name}</span>
    </header>
  );
}

function BotAvatar({
  color,
  size = "sm",
}: {
  color: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "rounded-lg ring-1 flex items-center justify-center shrink-0",
        size === "sm" ? "size-8" : "size-9"
      )}
      style={{
        backgroundColor: `hsl(${color} / 0.15)`,
        color: `hsl(${color})`,
        borderColor: `hsl(${color} / 0.3)`,
      }}
    >
      <Bot className={size === "sm" ? "size-4" : "size-4.5"} />
    </div>
  );
}

function WorkspaceSwitcher({
  bots,
  current,
  collapsed,
  switchTarget,
}: {
  bots: SidebarBot[];
  current: CurrentBot;
  collapsed: boolean;
  switchTarget: (slug: string) => string;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch workspace"
          className={cn(
            "flex items-center rounded-lg border border-border bg-muted/20 text-sm font-medium text-foreground transition-colors",
            "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            collapsed
              ? "size-11 justify-center p-0"
              : "flex-1 min-w-0 min-h-11 gap-2 px-2 py-2"
          )}
        >
          <BotAvatar color={current.primaryColor} size={collapsed ? "sm" : "md"} />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{current.name}</span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed ? "start" : "start"}
        side={collapsed ? "right" : "bottom"}
        className="w-56"
      >
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {bots.map((b) => {
          const active = b.slug === current.slug;
          return (
            <DropdownMenuItem
              key={b.slug}
              onSelect={() => router.push(switchTarget(b.slug))}
              className={cn(
                "min-h-10 gap-2",
                active && "bg-primary/10 text-foreground"
              )}
            >
              <BotAvatar color={b.primaryColor} size="sm" />
              <span className="flex-1 truncate">{b.name}</span>
              {active && <Check className="size-4 shrink-0 text-primary" />}
              {!active && b.newSupportCount ? (
                <span className="ml-auto rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  {b.newSupportCount}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({
  bots,
  current,
  collapsed,
  onToggleCollapsed,
}: {
  bots: SidebarBot[];
  current: CurrentBot;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const base = `/admin/${current.slug}`;
  const subpath = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const switchTarget = (slug: string) => {
    const section = NAV.find((n) => n.seg && subpath.startsWith(n.seg))?.seg ?? "";
    return `/admin/${slug}${section}`;
  };

  const supportCount = bots.find((b) => b.slug === current.slug)?.newSupportCount;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("pt-3", collapsed ? "px-1.5" : "px-3", !onToggleCollapsed && "pr-12")}>
        <div
          className={cn(
            "flex items-center pb-2",
            collapsed ? "flex-col gap-1.5" : "gap-1"
          )}
        >
          <WorkspaceSwitcher
            bots={bots}
            current={current}
            collapsed={collapsed}
            switchTarget={switchTarget}
          />
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                collapsed ? "size-9" : "size-8"
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <Separator />

      <nav
        className={cn(
          "flex-1 space-y-0.5 overflow-y-auto",
          collapsed ? "p-1.5" : "p-2"
        )}
      >
        {NAV.map((item) => (
          <NavLink
            key={item.seg}
            base={base}
            collapsed={collapsed}
            badgeCount={item.seg === "/support" ? supportCount : undefined}
            {...item}
          />
        ))}
      </nav>

      <Separator />
      <div className={cn("space-y-0.5", collapsed ? "p-1.5" : "p-2")}>
        <FooterLink
          href={`/chat/${current.slug}`}
          target="_blank"
          label="View live"
          icon={ExternalLink}
          collapsed={collapsed}
        />
        <FooterLink
          href="/admin"
          label="All workspaces"
          icon={ArrowLeft}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
}

function NavLink({
  base,
  seg,
  label,
  icon: Icon,
  exact,
  collapsed,
  badgeCount,
}: {
  base: string;
  seg: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  collapsed: boolean;
  badgeCount?: number;
}) {
  const pathname = usePathname();
  const href = base + seg;
  const active = exact ? pathname === href : pathname.startsWith(href);

  const link = (
    <Link
      href={href}
      className={cn(
        "relative flex items-center rounded-md transition-colors",
        collapsed
          ? "size-11 justify-center"
          : "gap-2.5 px-3 py-2.5 min-h-11 text-sm",
        active
          ? "bg-primary/15 text-foreground ring-1 ring-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && badgeCount ? (
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function FooterLink({
  href,
  label,
  icon: Icon,
  collapsed,
  target,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  target?: string;
}) {
  const link = (
    <Link
      href={href}
      target={target}
      className={cn(
        "flex items-center rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted",
        collapsed ? "size-11 justify-center" : "gap-2.5 px-3 py-2.5 min-h-11"
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
