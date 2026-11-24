// Converte falhas comuns do Supabase em instruções claras para quem está usando o aplicativo.
export function mensagemDeErro(erro: { message?: string } | string | null | undefined) {
  const mensagem = typeof erro === 'string' ? erro : erro?.message || ''
  const texto = mensagem.toLocaleLowerCase('pt-BR')

  if (texto.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (texto.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (texto.includes('already registered')) return 'Este e-mail já possui um cadastro.'
  if (texto.includes('row-level security')) return 'Sua conta não tem permissão para esta alteração.'
  if (texto.includes('época') || texto.includes('disponível nesta data')) return 'Uma das atividades não está disponível nesta data. Escolha outro horário ou fale com a comunidade.'
  if (texto.includes('horário') || texto.includes('vagas suficientes')) return 'Este horário mudou ou ficou sem vagas. Atualize a lista e escolha outro.'
  if (texto.includes('aviso de privacidade')) return 'Confirme o aviso de privacidade para continuar.'
  if (texto.includes('somente pedidos pendentes')) return 'Este pedido não está mais pendente e não pode ser cancelado por aqui.'
  if (texto.includes('fetch') || texto.includes('network')) return 'Sem conexão com o serviço. Tente novamente.'

  return 'Não foi possível concluir esta ação. Confira os dados e tente novamente.'
}
