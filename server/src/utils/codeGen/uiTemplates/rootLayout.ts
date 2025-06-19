export const ROOT_LAYOUT_TSX = `
import "./globals.css";
import { WalletConnectionProvider } from "../src/context/WalletConnectionProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <WalletConnectionProvider>
          {children}
        </WalletConnectionProvider>
      </body>
    </html>
  );
}`;
