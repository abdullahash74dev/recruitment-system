import { ChevronsLeft, ChevronsRight, X, Sparkles } from "lucide-react";
import AINetworkBackground from "@/components/AINetworkBackground";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardNavGroup, DashboardNavItem } from "./DashboardSidebar";

interface DashboardSidebarFuturisticProps {
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
  item, active, collapsed, tooltipSide, onClick, delay,
}: {
  item: DashboardNavItem; active: boolean; collapsed: boolean; tooltipSide: "left" | "right"; onClick: () => void; delay: number;
}) => {
  const Icon = item.icon;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "animate-fade-in-up group relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-all duration-300 ease-out",
        "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-white/5",
        active && "text-sidebar-foreground bg-gradient-to-r from-sidebar-accent/90 via-sidebar-accent/40 to-transparent shadow-glow",
        collapsed && "justify-center px-0",
      )}
    >
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
          active
            ? "gradient-accent text-accent-foreground shadow-glow scale-105"
            : "bg-sidebar-accent/30 text-sidebar-foreground/80 group-hover:scale-105 group-hover:bg-sidebar-accent/50 group-hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {active && (
          <span className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-sidebar-background animate-pulse" />
        )}
      </span>
      {!collapsed && <span className="flex-1 truncate text-start">{item.label}</span>}
      {!collapsed && !!item.badge && (
        <span className="min-w-[20px] rounded-full gradient-accent px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight text-accent-foreground shadow-glow">
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

const DashboardSidebarFuturistic = ({
  groups, activeTab, onChange, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, dir, title, collapseLabel, expandLabel,
}: DashboardSidebarFuturisticProps) => {
  const tooltipSide: "left" | "right" = dir === "rtl" ? "left" : "right";

  const renderNav = (forceExpanded: boolean, onSelect: (value: string) => void) => {
    let itemIndex = 0;
    return (
      <nav className="relative z-10 flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group, idx) => (
          <div key={group.id}>
            {idx > 0 && collapsed && !forceExpanded && (
              <div className="mx-3 mb-2 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
            )}
            {(!collapsed || forceExpanded) && (
              <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                <span className="h-1 w-1 rounded-full gradient-accent shadow-glow" />
                <span className="text-gradient">{group.title}</span>
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const delay = itemIndex * 40;
                itemIndex += 1;
                return (
                  <NavButton
                    key={item.value}
                    item={item}
                    active={activeTab === item.value}
                    collapsed={collapsed && !forceExpanded}
                    tooltipSide={tooltipSide}
                    onClick={() => onSelect(item.value)}
                    delay={delay}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  };

  return (
    <>
      {/* Desktop floating glass sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen shrink-0 p-3 transition-[width] duration-300 ease-in-out md:flex",
          collapsed ? "w-[88px]" : "w-72",
        )}
      >
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-sidebar/85 shadow-elevated backdrop-blur-2xl">
          <AINetworkBackground className="opacity-20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sidebar-primary/10 via-transparent to-accent/10" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

          {/* Header */}
          <div className="relative z-10 flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
            {!collapsed ? (
              <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
                <span className="truncate text-sm font-bold text-sidebar-foreground">{title}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent shadow-glow">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  AI
                </span>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Sparkles className="h-5 w-5 text-accent animate-pulse" />
              </div>
            )}
          </div>

          {renderNav(false, onChange)}

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="relative z-10 m-3 flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-sidebar-foreground/80 transition-all duration-300 hover:border-accent/40 hover:bg-accent/10 hover:text-sidebar-foreground hover:shadow-glow"
          >
            {dir === "rtl"
              ? (collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />)
              : (collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />)}
            {!collapsed && <span>{collapseLabel}</span>}
          </button>
          <span className="sr-only">{expandLabel}</span>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" onClick={onCloseMobile} />
          <div
            className={cn(
              "relative z-10 m-3 flex h-[calc(100%-1.5rem)] w-80 flex-col overflow-hidden rounded-3xl border border-white/10 bg-sidebar/90 shadow-elevated backdrop-blur-2xl animate-in duration-200",
              dir === "rtl" ? "slide-in-from-right" : "slide-in-from-left",
            )}
          >
            <AINetworkBackground className="opacity-20" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sidebar-primary/10 via-transparent to-accent/10" />

            <div className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4">
              <span className="truncate text-sm font-bold text-sidebar-foreground">{title}</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-xl p-1.5 text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav(true, (value) => { onChange(value); onCloseMobile(); })}
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardSidebarFuturistic;
