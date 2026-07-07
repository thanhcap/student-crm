import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
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

export const metadata = {
  title: 'Student CRM // Workspace',
  description: 'Premium administrative interface engineered for relationship pipelines.',
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the inline script below may add `.dark` to
    // <html> before React hydrates (prevents a light-mode flash for dark users).
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('crm_dark_mode')==='true')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full font-sans`}>
        {children}
      </body>
    </html>
  );
}