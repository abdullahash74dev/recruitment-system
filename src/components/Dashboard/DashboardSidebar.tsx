import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import SiteLogo from "@/components/SiteLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DashboardNavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export interface DashboardNavGroup {
  id: string;
  title: string;
  items: DashboardNavItem[];
}

interface DashboardSidebarProps {
  groups: DashboardNavGroup[];
  activeTab: string;
  onChange: (value: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  dir: "rtl" | "ltr";
  title: string;
  collapseLabel: string;
  expandLabel: string;
}

const NavButton = ({
  item, active, collapsed, tooltipSide, onClick,
}: {
  item: DashboardNavItem; active: boolean; collapsed: boolean; tooltipSide: "left" | "right"; onClick: () => void;
}) => {
  const Icon = item.icon;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span className="absolute inset-y-1 start-0 w-1 rounded-full bg-sidebar-primary" />}
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-start">{item.label}</span>}
      {!collapsed && !!item.badge && (
        <span className="min-w-[18px] rounded-full bg-sidebar-primary/20 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-sidebar-primary">
          {item.badge}
        </span>
      )}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        {item.label}
        {!!item.badge && ` (${item.badge})`}
      </TooltipContent>
    </Tooltip>
  );
};

const DashboardSidebar = ({
  groups, activeTab, onChange, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, dir, title, collapseLabel, expandLabel,
}: DashboardSidebarProps) => {
  const tooltipSide: "left" | "right" = dir === "rtl" ? "left" : "right";

  const renderNav = (forceExpanded: boolean, onSelect: (value: string) => void) => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
      {groups.map((group, idx) => (
        <div key={group.id}>
          {idx > 0 && collapsed && !forceExpanded && <div className="mx-2 mb-2 h-px bg-sidebar-border/60" />}
          {(!collapsed || forceExpanded) && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.title}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavButton
                key={item.value}
                item={item}
                active={activeTab === item.value}
                collapsed={collapsed && !forceExpanded}
                tooltipSide={tooltipSide}
                onClick={() => onSelect(item.value)}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
          <Link to="/" className="shrink-0">
            <SiteLogo heightOverride={32} />
          </Link>
          {!collapsed && <span className="truncate text-sm font-bold text-sidebar-foreground/90">{title}</span>}
        </div>
        {renderNav(false, onChange)}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-sidebar-border text-xs font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span>{collapseLabel}</span>}
        </button>
        <span className="sr-only">{expandLabel}</span>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in-0" onClick={onCloseMobile} />
          <aside
            className={cn(
              "relative z-10 flex h-full w-72 flex-col border-e border-sidebar-border bg-sidebar animate-in duration-200",
              dir === "rtl" ? "slide-in-from-right" : "slide-in-from-left",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <SiteLogo heightOverride={32} />
                <span className="truncate text-sm font-bold text-sidebar-foreground/90">{title}</span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNav(true, (value) => { onChange(value); onCloseMobile(); })}
          </aside>
        </div>
      )}
    </>
  );
};

export default DashboardSidebar;
