import './globals.css';

export const metadata = {
  title: 'Student CRM',
  description: 'Manage your clients securely',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] m-0 p-0">
        {children}
      </body>
    </html>
  );
}