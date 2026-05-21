import "./globals.css";
import AuthProvider from '../components/AuthProvider';

export const metadata = {
  title: "ZTech — Operations Dashboard",
  description: "ZTech Operations Dashboard",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
