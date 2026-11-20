import { MuiProvider } from "@/components/mui-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <MuiProvider>{children}</MuiProvider>;
}
