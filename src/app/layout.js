import { Inter, Space_Grotesk, JetBrains_Mono, Urbanist } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono'
});

// V7 marketing site — Urbanist display font
const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-urbanist'
});

export const metadata = {
  title: 'Student CRM // Workspace',
  description: 'Premium administrative interface engineered for client pipelines.',
};

// Applied before first paint to avoid a light/dark flash (FOUC).
const themeScript = `
(function () {
  try {
    var dark = localStorage.getItem('crm_dark_mode') === 'true';
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${urbanist.variable} h-full font-sans`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
