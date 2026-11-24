// A configuração pública da comunidade fica em uma linha única identificada por id=true.
export function getCommunityWhatsApp(client) {
  return client.from('community_settings').select('whatsapp_phone').eq('id', true).single()
}

export function updateCommunityWhatsApp(client, phone) {
  return client.from('community_settings').update({ whatsapp_phone: phone }).eq('id', true)
}
