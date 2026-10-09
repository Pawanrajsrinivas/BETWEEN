import "./globals.css";

export const metadata = {
  title: "BETWEEN — A game for two",
  description: "A private truth or dare experience for two people."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}