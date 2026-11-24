// Serviço de servidor: somente a administração autenticada pode criar acessos de guia.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  // Responde à verificação do navegador e aceita apenas chamadas que criam acessos.
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'É necessário entrar com uma conta.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) return reply({ error: 'O serviço ainda não foi configurado.' }, 500)

  // A chave comum valida a sessão; a chave administrativa, guardada só no servidor, faz o cadastro.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return reply({ error: 'Sua sessão expirou. Entre novamente.' }, 401)

  // Confere o papel de quem chamou antes de permitir qualquer alteração administrativa.
  const { data: caller, error: callerError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (callerError || caller?.role !== 'community_admin') return reply({ error: 'Somente a administração da comunidade pode criar acessos de guia.' }, 403)

  // Lê e valida os dados recebidos antes de cadastrar uma conta ou atividade.
  let payload: { email?: string; password?: string; full_name?: string; phone?: string; experience_ids?: string[] }
  try {
    payload = await request.json()
  } catch {
    return reply({ error: 'Não foi possível ler os dados enviados.' }, 400)
  }

  const email = payload.email?.trim().toLowerCase()
  const fullName = payload.full_name?.trim()
  const password = payload.password ?? ''
  const experienceIds = [...new Set(payload.experience_ids ?? [])]
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Informe um e-mail válido.' }, 400)
  if (!fullName || fullName.length > 120) return reply({ error: 'Informe o nome do guia.' }, 400)
  if (password.length < 12) return reply({ error: 'A senha do guia precisa ter pelo menos 12 caracteres.' }, 400)
  if (experienceIds.length === 0 || experienceIds.length > 10) return reply({ error: 'Selecione ao menos uma atividade.' }, 400)

  // Confere no banco se todas as experiências selecionadas continuam disponíveis.
  const { data: experiences, error: experiencesError } = await adminClient
    .from('experiences')
    .select('id')
    .in('id', experienceIds)
    .eq('is_active', true)
  if (experiencesError || experiences?.length !== experienceIds.length) return reply({ error: 'Uma ou mais atividades não estão disponíveis.' }, 400)

  // O Auth protege a senha e o gatilho do banco cria o perfil de guia ligado à nova conta.
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'guide' },
    user_metadata: { full_name: fullName, phone: payload.phone?.trim() || null },
  })
  if (createError || !created.user) return reply({ error: 'Não foi possível criar a conta. Verifique se o e-mail já está cadastrado.' }, 400)

  // Grava as atividades escolhidas e desfaz a conta se a atribuição não puder ser concluída.
  const assignments = experienceIds.map((experience_id) => ({ guide_id: created.user!.id, experience_id }))
  const { error: assignmentError } = await adminClient.from('guide_experiences').insert(assignments)
  if (assignmentError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return reply({ error: 'Não foi possível atribuir as atividades. O acesso criado foi desfeito.' }, 500)
  }

  return reply({ guide: { id: created.user.id, email, full_name: fullName }, assigned_activities: experienceIds }, 201)
})

// Mantém o formato das respostas igual para que o painel mostre mensagens compreensíveis.
function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
