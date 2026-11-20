"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  ChevronDown,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Menu,
  CreditCard,
  Mail,
  Package,
  Palette,
  Plug,
  Settings,
  Store,
  Tag,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";
import { SignOutButton } from "@/components/sign-out-button";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const DRAWER_WIDTH = 256;

interface DashboardShellProps {
  orgSlug: string;
  orgName: string;
  chatwootActive: boolean;
  billingEnabled?: boolean;
  children: React.ReactNode;
}

type Icon = React.ComponentType<{ className?: string; size?: number }>;

type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  subItems?: Array<{ href: string; label: string; icon: Icon }>;
};

function buildNavGroups(t: ReturnType<typeof useTranslations<"nav">>) {
  return [
    {
      label: t("attendance"),
      items: [
        { href: "kb", label: t("knowledgeBase"), icon: BookOpen },
        { href: "agent", label: t("aiAgent"), icon: Bot },
      ],
    },
    {
      label: t("store"),
      items: [
        {
          href: "store",
          label: t("myStore"),
          icon: Store,
          subItems: [
            { href: "store/profile", label: t("profile"), icon: User },
            { href: "store/content", label: t("content"), icon: LayoutGrid },
            { href: "store/analytics", label: t("analytics"), icon: BarChart3 },
            { href: "store/theme", label: t("theme"), icon: Palette },
            { href: "store/discounts", label: t("discounts"), icon: Tag },
          ],
        },
        { href: "catalog", label: t("catalog"), icon: Tag },
        { href: "products", label: t("digitalProducts"), icon: Package },
        { href: "courses", label: t("courses"), icon: GraduationCap },
        { href: "mentoring", label: t("mentoring"), icon: Calendar },
        { href: "customers", label: t("customers"), icon: Users },
        { href: "broadcasts", label: t("broadcasts"), icon: Mail },
      ],
    },
    {
      label: t("settings"),
      items: [
        { href: "integrations", label: t("integrations"), icon: Plug },
        { href: "finances", label: t("finances"), icon: Wallet },
        { href: "billing", label: t("billing"), icon: CreditCard },
        { href: "settings", label: t("settings"), icon: Settings },
      ],
    },
  ] as { label: string; items: NavItem[] }[];
}

const COLLAPSED_GROUPS_STORAGE_KEY = "inboxy:collapsed-nav-groups";

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function isPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

// The sidebar stays dark in both themes, so it reads the sidebar tokens from globals.css.
const navItemSx: SystemStyleObject<Theme> = {
  borderRadius: 2,
  px: 1.5,
  py: 1,
  color: "color-mix(in srgb, var(--sidebar-foreground) 70%, transparent)",
  "&:hover": {
    bgcolor: "color-mix(in srgb, var(--sidebar-accent) 60%, transparent)",
    color: "var(--sidebar-accent-foreground)",
  },
  "&.Mui-selected, &.Mui-selected:hover": {
    bgcolor: "var(--sidebar-accent)",
    color: "var(--sidebar-accent-foreground)",
  },
  "& .MuiListItemIcon-root": { minWidth: 28, color: "inherit" },
};

function NavLinks({
  orgSlug,
  pathname,
  onNavigate,
  billingEnabled,
}: {
  orgSlug: string;
  pathname: string;
  onNavigate?: () => void;
  billingEnabled: boolean;
}) {
  const t = useTranslations("nav");
  const groups = buildNavGroups(t).map((group) => ({
    ...group,
    items: group.items.filter((item) => billingEnabled || item.href !== "billing"),
  }));

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    setCollapsed(loadCollapsedGroups());
  }, []);

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage unavailable — collapse state just won't persist
      }
      return next;
    });
  }

  return (
    <Box component="nav" sx={{ display: "flex", flexDirection: "column", gap: 2, px: 1.5, py: 1 }}>
      {groups.map((group) => {
        const groupHasActiveItem = group.items.some((item) =>
          isPathActive(pathname, `/${orgSlug}/${item.href}`),
        );
        const open = !collapsed.has(group.label) || groupHasActiveItem;

        return (
          <List key={group.label} disablePadding dense>
            <ListItemButton
              onClick={() => toggleGroup(group.label)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                color: "color-mix(in srgb, var(--sidebar-foreground) 40%, transparent)",
                "&:hover": {
                  bgcolor: "transparent",
                  color: "color-mix(in srgb, var(--sidebar-foreground) 70%, transparent)",
                },
              }}
            >
              <ListItemText
                primary={group.label}
                slotProps={{
                  primary: { sx: { fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" } },
                }}
              />
              <ChevronDown
                size={14}
                aria-hidden
                style={{ transition: "transform 150ms", transform: open ? "none" : "rotate(-90deg)" }}
              />
            </ListItemButton>

            <Collapse in={open} timeout="auto">
              {group.items.map(({ href, label, icon: Icon, subItems }) => {
                const path = `/${orgSlug}/${href}`;
                const active = isPathActive(pathname, path);
                return (
                  <Box key={href} sx={{ mt: 0.5 }}>
                    <ListItemButton component={Link} href={path} onClick={onNavigate} selected={active} sx={navItemSx}>
                      <ListItemIcon><Icon size={16} aria-hidden /></ListItemIcon>
                      <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
                    </ListItemButton>
                    {active && subItems?.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                      const subPath = `/${orgSlug}/${subHref}`;
                      const subActive = isPathActive(pathname, subPath);
                      return (
                        <ListItemButton
                          key={subHref}
                          component={Link}
                          href={subPath}
                          onClick={onNavigate}
                          sx={{
                            ...navItemSx,
                            pl: 4.5,
                            py: 0.75,
                            ...(subActive && { color: "var(--sidebar-accent-foreground)" }),
                          }}
                        >
                          <ListItemIcon><SubIcon size={14} aria-hidden /></ListItemIcon>
                          <ListItemText primary={subLabel} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
                        </ListItemButton>
                      );
                    })}
                  </Box>
                );
              })}
            </Collapse>
          </List>
        );
      })}
    </Box>
  );
}

function SidebarContent({
  orgSlug,
  orgName,
  pathname,
  onNavigate,
  onClose,
  billingEnabled,
}: {
  orgSlug: string;
  orgName: string;
  pathname: string;
  onNavigate?: () => void;
  onClose?: () => void;
  billingEnabled: boolean;
}) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <Box sx={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          height: 56,
          alignItems: "center",
          gap: 1,
          px: 2,
          borderBottom: "1px solid var(--sidebar-border)",
        }}
      >
        <Box
          component={Link}
          href="/"
          onClick={onNavigate}
          sx={{ display: "flex", minWidth: 0, flex: 1, alignItems: "center", gap: 1, color: "inherit", textDecoration: "none" }}
        >
          <Box
            sx={{
              display: "flex",
              width: 32,
              height: 32,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px 10px 10px 3px",
              bgcolor: "#2340ff",
              color: "#fff",
              fontFamily: "var(--font-bricolage)",
              fontWeight: 800,
            }}
          >
            <span aria-hidden>i</span>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 600, fontSize: 15 }}>Inboxy</Typography>
            <Typography noWrap sx={{ fontSize: 12, opacity: 0.6 }}>{orgName}</Typography>
          </Box>
        </Box>
        {onClose && (
          <IconButton aria-label={tNav("closeMenu")} onClick={onClose} size="small" sx={{ color: "inherit", opacity: 0.7 }}>
            <X size={20} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", pt: 1.5 }}>
        <NavLinks orgSlug={orgSlug} pathname={pathname} onNavigate={onNavigate} billingEnabled={billingEnabled} />
      </Box>

      <Box sx={{ flexShrink: 0, borderTop: "1px solid var(--sidebar-border)", p: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <SignOutButton
            variant="ghost"
            className="flex-1 justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            {tCommon("sair")}
          </SignOutButton>
          <LanguageToggle />
          <ThemeToggle />
        </Box>
      </Box>
    </Box>
  );
}

const drawerPaperSx: SystemStyleObject<Theme> = {
  width: DRAWER_WIDTH,
  boxSizing: "border-box",
  bgcolor: "var(--sidebar)",
  color: "var(--sidebar-foreground)",
  borderRight: "1px solid var(--sidebar-border)",
  backgroundImage: "none",
};

export function DashboardShell({
  orgSlug,
  orgName,
  chatwootActive,
  billingEnabled = true,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tNav = useTranslations("nav");
  const tDash = useTranslations("dashboard");

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: { lg: "flex" } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", lg: "none" }, "& .MuiDrawer-paper": drawerPaperSx }}
      >
        <SidebarContent
          orgSlug={orgSlug}
          orgName={orgName}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)}
          billingEnabled={billingEnabled}
        />
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", lg: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { ...drawerPaperSx, position: "sticky", top: 0, height: "100vh" },
        }}
      >
        <SidebarContent orgSlug={orgSlug} orgName={orgName} pathname={pathname} billingEnabled={billingEnabled} />
      </Drawer>

      <Box sx={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            display: { lg: "none" },
            bgcolor: "background.default",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ minHeight: 56, gap: 1.5, px: 2 }} disableGutters>
            <IconButton aria-label={tNav("openMenu")} onClick={() => setMobileOpen(true)} edge="start">
              <Menu size={20} />
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontWeight: 600 }}>Inboxy</Typography>
              <Typography noWrap variant="caption" color="text.secondary" component="p">{orgName}</Typography>
            </Box>
            <Chip
              size="small"
              color={chatwootActive ? "success" : "warning"}
              variant="outlined"
              label={chatwootActive ? tDash("statusActive") : tDash("statusPending")}
            />
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, overflow: "auto" }}>
          <Box sx={{ mx: "auto", width: "100%", maxWidth: 1024, px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 } }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
