import type { SupabaseClient } from '@supabase/supabase-js'

// Mantém o contato público compartilhado com o site e atualizado pelo painel da comunidade.
export function getCommunityWhatsApp(client: SupabaseClient) {
  return client.from('community_settings').select('whatsapp_phone').eq('id', true).single()
}

