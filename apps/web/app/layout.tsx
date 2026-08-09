import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '../components/Toaster';

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
            __html: `try{if(localStorage.getItem('tribo_theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}try{var m=localStorage.getItem('tribo_marca:'+location.hostname);if(m){var c=JSON.parse(m).corPrimaria;if(c)document.documentElement.style.setProperty('--cor-primaria',c);}}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
