import { createTheme } from "@mui/material/styles";

const headingFont = "var(--font-bricolage), var(--font-geist-sans), sans-serif";

export const muiTheme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2340ff", contrastText: "#ffffff" },
        secondary: { main: "#ff5b3a", contrastText: "#ffffff" },
        error: { main: "#c8281c" },
        success: { main: "#0b6e4f" },
        warning: { main: "#9a6400" },
        background: { default: "#f2efea", paper: "#ffffff" },
        text: { primary: "#0e0e10", secondary: "#55524c" },
        divider: "#ddd8cf",
      },
    },
    dark: {
      palette: {
        primary: { main: "#8c9bff", contrastText: "#0e0e10" },
        secondary: { main: "#ff5b3a", contrastText: "#ffffff" },
        error: { main: "#ff7a6b" },
        success: { main: "#3ddc97" },
        warning: { main: "#ffb547" },
        background: { default: "#0e0e10", paper: "#18181b" },
        text: { primary: "#f2efea", secondary: "#a3a09a" },
        divider: "#2a2a2e",
      },
    },
  },
  breakpoints: { values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 } },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    h1: { fontFamily: headingFont, fontWeight: 700 },
    h2: { fontFamily: headingFont, fontWeight: 700 },
    h3: { fontFamily: headingFont, fontWeight: 700 },
    h4: { fontFamily: headingFont, fontWeight: 600 },
    h5: { fontFamily: headingFont, fontWeight: 600 },
    h6: { fontFamily: headingFont, fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
});
