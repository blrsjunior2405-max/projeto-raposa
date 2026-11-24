// Compartilha a sessão do Supabase entre as telas e carrega somente o perfil da pessoa conectada.
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'
import { mensagemDeErro } from './mensagens'

type Profile = { id: string; role: 'visitor' | 'guide' | 'community_admin'; full_name: string; phone: string | null }
type AuthValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (details: { email: string; password: string; full_name: string; phone: string }) => Promise<string | null>
  signOut: () => Promise<void>
}

// O contexto evita repetir o fluxo de login e perfil em cada tela do aplicativo.
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Restaura uma sessão salva no aparelho e escuta entradas ou saídas de conta.
  useEffect(() => {
    if (!supabase) { setLoading(false); return undefined }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Busca nome e papel de acesso depois que a sessão está disponível.
  useEffect(() => {
    let active = true
    async function loadProfile() {
      if (!supabase || !session?.user) { setProfile(null); setProfileLoading(false); return }
      setProfileLoading(true)
      const { data } = await supabase.from('profiles').select('id, role, full_name, phone').eq('id', session.user.id).maybeSingle()
      if (active) { setProfile(data as Profile | null); setProfileLoading(false) }
    }
    loadProfile()
    return () => { active = false }
  }, [session])

  // A autenticação valida as credenciais; o perfil correspondente é carregado pelo efeito acima.
  async function signIn(email: string, password: string) {
    if (!supabase) return 'O aplicativo ainda não está conectado ao banco de dados.'
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error ? mensagemDeErro(error) : null
  }

  // O cadastro público cria um visitante; ninguém escolhe ser guia ou administrador pelo app.
  async function signUp(details: { email: string; password: string; full_name: string; phone: string }) {
    if (!supabase) return 'O aplicativo ainda não está conectado ao banco de dados.'
    const { error } = await supabase.auth.signUp({
      email: details.email.trim(),
      password: details.password,
      options: { data: { full_name: details.full_name.trim(), phone: details.phone.trim() || null } },
    })
    return error ? mensagemDeErro(error) : null
  }

  // Ao sair, o Supabase encerra a sessão e o efeito de perfil limpa os dados em memória.
  async function signOut() { await supabase?.auth.signOut() }

  return <AuthContext.Provider value={{ session, profile, loading, profileLoading, configured: supabaseConfigured, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}

// Função auxiliar usada pelas telas para ler a sessão, o perfil e as ações de acesso.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('A função useAuth precisa ser usada dentro do provedor de autenticação.')
  return context
}
