import { MuiProvider } from "@/components/mui-provider";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <MuiProvider>{children}</MuiProvider>;
}
