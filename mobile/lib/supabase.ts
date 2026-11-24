// Prepara o ambiente nativo para conexões web e persiste sessões usando o armazenamento do Expo.
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import authStorage from './auth-storage'

// Estas variáveis públicas identificam o projeto; nenhuma chave administrativa pode entrar aqui.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// Sem configuração o app ainda exibe o catálogo local, mas não envia cadastros ou pedidos.
export const supabaseConfigured = Boolean(url && publishableKey)
export const supabase = supabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null
