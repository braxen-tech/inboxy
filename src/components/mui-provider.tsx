"use client";

import { useEffect } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, useColorScheme } from "@mui/material/styles";
import { useTheme as useNextTheme } from "next-themes";
import { muiTheme } from "@/theme/mui-theme";

// next-themes owns the light/dark choice and the html class; MUI just follows it.
function SyncColorScheme() {
  const { resolvedTheme } = useNextTheme();
  const { setMode } = useColorScheme();
  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") setMode(resolvedTheme);
  }, [resolvedTheme, setMode]);
  return null;
}

export function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={muiTheme} storageManager={null} defaultMode="light">
        <SyncColorScheme />
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
