// Tela de entrada de visitantes: recebe credenciais e delega a validação ao contexto de autenticação.
import { useEffect, useState } from 'react'
import { Link, router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { theme } from '@/lib/theme'

export default function LoginScreen() {
  const { signIn, configured, profile, profileLoading, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Só decide a rota depois que a conta e o papel já foram lidos pelo contexto.
  useEffect(() => {
    if (!session || profileLoading) return
    router.replace(profile && profile.role !== 'visitor' ? '/gestao-mobile' as any : '/(tabs)/perfil' as any)
  }, [profile, profileLoading, session])
  // Depois do login, leva a pessoa ao perfil para conferir sua área de visitante.
  async function submit() {
    setBusy(true); setError('')
    const message = await signIn(email, password)
    setBusy(false)
    if (message) setError(message)
    else setBusy(true)
  }
  if (session && profileLoading) return <View style={styles.screen}><ActivityIndicator color={theme.green}/><Text style={styles.copy}>Carregando seu perfil…</Text></View>
  return <View style={styles.screen}><Text style={styles.kicker}>RAPOSA I · ÁREA DO VISITANTE</Text><Text style={styles.title}>Acompanhe seus pedidos.</Text><Text style={styles.copy}>Entre para consultar suas visitas e receber a confirmação da comunidade.</Text>
    {!configured && <Text style={styles.notice}>O aplicativo está em modo de apresentação. Para autenticar, configure o Supabase seguindo o README.</Text>}
    <Text style={styles.label}>E-mail</Text><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="voce@email.com" />
    <Text style={styles.label}>Senha</Text><TextInput secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholder="Sua senha" />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable disabled={busy || !configured} onPress={submit} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Entrando…' : 'Entrar'}</Text></Pressable>
    <Link href={'/signup' as any} style={styles.link}>Criar perfil de visitante</Link>
  </View>
}
const styles = StyleSheet.create({ screen:{flex:1,padding:24,justifyContent:'center',backgroundColor:theme.background},kicker:{fontSize:9,letterSpacing:1.4,fontWeight:'800',color:theme.green},title:{fontSize:26,lineHeight:34,fontWeight:'700',color:theme.ink,marginTop:12},copy:{fontSize:13,lineHeight:20,color:theme.muted,marginTop:10,marginBottom:24},label:{fontSize:11,fontWeight:'700',color:theme.ink,marginTop:14,marginBottom:7},input:{height:48,paddingHorizontal:13,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,color:theme.ink},primary:{height:48,marginTop:22,backgroundColor:theme.green,alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontWeight:'700'},link:{marginTop:16,color:theme.green,textAlign:'center'},error:{marginTop:12,color:theme.clay},notice:{padding:12,backgroundColor:'#eeeee5',color:theme.muted,fontSize:12,lineHeight:18} })
