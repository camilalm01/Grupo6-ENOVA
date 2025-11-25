import type { Metadata } from "next";
import { Nunito, Playfair_Display } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ENOVA - Plataforma de Acogida Femenina",
  description: "Espacio seguro de apoyo y empoderamiento para mujeres. Conecta, comparte y crece con nuestra comunidad.",
  keywords: ["comunidad femenina", "apoyo", "empoderamiento", "mujeres", "bienestar"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${nunito.variable} ${playfair.variable} antialiased`}
        style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
