import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "ReachInbox Cold Email Scheduler",
  description: "Distributed Email Dispatch Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
