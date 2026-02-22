import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Touille",
  description: "Extract recipes from TikTok videos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Varela+Round&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "'Varela Round', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
