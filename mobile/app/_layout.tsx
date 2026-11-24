// O layout raiz carrega a fonte, mantém a sessão disponível e organiza a navegação do aplicativo.
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { AuthProvider } from '@/lib/auth-context';

export {
  // Encaminha erros de tela para a página de erro do Expo Router.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  return <RootLayoutNav />;
}

// Registra as rotas, aplica a aparência e disponibiliza a sessão para todas as telas.
function RootLayoutNav() {
  return (
    <AuthProvider>
        <Stack screenOptions={{ headerTintColor: '#294d39', headerTitleStyle: { fontWeight: '600' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="experience/[id]" options={{ title: 'A experiência', headerBackTitle: 'Voltar' }} />
          <Stack.Screen name="book/[id]" options={{ title: 'Consultar data', headerBackTitle: 'Voltar' }} />
          <Stack.Screen name="login" options={{ title: 'Entrar', headerBackTitle: 'Voltar' }} />
          <Stack.Screen name="signup" options={{ title: 'Criar perfil', headerBackTitle: 'Voltar' }} />
          <Stack.Screen name="gestao-mobile" options={{ title: 'Acesso da comunidade', headerBackTitle: 'Voltar' }} />
        </Stack>
    </AuthProvider>
  );
}
