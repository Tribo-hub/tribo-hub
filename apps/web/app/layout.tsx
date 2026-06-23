import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tribo Hub',
  description: 'Plataforma de cursos e área de membros',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('tribo_theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
