# Orientações para o aplicativo móvel

Este projeto usa Expo e React Native. Priorize uma experiência pensada primeiro para celulares, bom desempenho e compatibilidade entre plataformas.

## Consulte a documentação da versão instalada

O Expo muda recursos entre versões do SDK. Antes de alterar APIs do Expo, EAS ou React Native:

1. Confira a versão principal de `expo` em `package.json`.
2. Consulte a documentação correspondente: `https://docs.expo.dev/versions/v<versão>.0.0/`.
3. Para outros assuntos, consulte o índice oficial `https://docs.expo.dev/llms.txt` e siga os links para a documentação específica.

## Comandos

Se o projeto tiver `bun.lock`, use `bunx` no lugar de `npx`.

```bash
npx expo install <pacote>  # escolhe uma versão compatível com o SDK instalado
npx expo start             # inicia o servidor de desenvolvimento
npx expo lint              # verifica o estilo e possíveis problemas no código
npx tsc --noEmit           # verifica os tipos do TypeScript
npx expo-doctor            # verifica a configuração e as dependências
npx expo install --fix      # corrige versões incompatíveis com o SDK
```

Antes de concluir mudanças no app, execute as verificações de estilo e de tipos.

## Navegação e rotas

- Use Expo Router para a navegação. Cada arquivo em `app/` representa uma rota; `_layout.tsx` organiza os navegadores.
- Mantenha componentes, funções auxiliares e serviços em pastas fora de `app/`.
- Importe `Link`, `router` e `useLocalSearchParams` de `expo-router`.
- Consulte `https://docs.expo.dev/router/introduction.md`.

## Compilação e publicação com EAS

Use EAS para compilar, assinar, enviar e publicar atualizações na nuvem: `eas build`, `eas submit` e `eas update`. Em projetos com Bun, execute `bunx eas-cli <comando>`; nos demais, use `npx eas-cli@latest <comando>`.

Documentação: `https://docs.expo.dev/eas/index.md`.

## Regras do projeto

- Se as pastas `ios/` e `android/` não existirem, elas são geradas pelo Expo. Não as crie ou edite manualmente; configure recursos nativos em `app.json` ou em plugins.
- O Expo Go contém apenas os módulos nativos previstos por ele. Ao adicionar uma biblioteca nativa, use uma compilação de desenvolvimento: `npx expo run:ios`, `npx expo run:android` ou `eas build --profile development`.
- Prefira módulos recomendados pelo Expo e verifique a documentação antes de incluir dependências.
