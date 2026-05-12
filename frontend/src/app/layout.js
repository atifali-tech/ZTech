import "./globals.css";

export const metadata = {
  title: "ZingParks — Operations Dashboard",
  description: "ZingParks Ops Console",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
