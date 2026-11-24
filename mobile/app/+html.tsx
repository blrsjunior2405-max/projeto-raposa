// Ajusta o HTML da versão web do app sem interferir nas telas nativas de iOS e Android.
import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// Este arquivo configura o HTML inicial da versão web durante a renderização no servidor.
// Por isso, esta função não acessa o DOM nem APIs que só existem no navegador.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Ajusta a rolagem da página web para que as listas do React Native funcionem como no celular. */}
        <ScrollViewStyleReset />

        {/* Define o fundo durante o carregamento para evitar flashes entre temas. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Metadados adicionais compartilhados por todas as páginas web podem ser incluídos aqui. */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #f7f6f0;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #f7f6f0;
  }
}`;
