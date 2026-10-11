import "./globals.css";
import "./styles/home-forms.css";
import "./styles/lobby-game.css";
import "./styles/chat.css";
import "./styles/modals.css";
import "./styles/offline.css";

export const metadata = {
  title: "BETWEEN — Truth or dare for your people",
  description: "A private truth or dare game for one to eight people.",
};

// Lets the page draw under phone browser bars (safe-area padding handles the
// rest) and makes the layout shrink — rather than scroll under — the keyboard.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#090808",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
