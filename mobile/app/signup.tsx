// Cadastro de visitantes; o banco define o papel inicial e protege o acesso aos próprios dados.
import { useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { theme } from '@/lib/theme'

export default function SignupScreen() {
  const { signUp, configured } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // Valida a senha e envia os dados ao Supabase Auth para criar uma conta de visitante.
  async function submit() {
    if (password.length < 8) { setMessage('Use uma senha com ao menos 8 caracteres.'); return }
    setBusy(true); setMessage('')
    const error = await signUp({ full_name: fullName, phone, email, password })
    setBusy(false)
    if (error) setMessage(error)
    else { setMessage('Cadastro iniciado. Verifique seu e-mail para confirmar a conta, se solicitado.'); setTimeout(() => router.replace('/login' as any), 1400) }
  }
  return <ScrollView contentContainerStyle={styles.screen}><Text style={styles.kicker}>PERFIL DO VISITANTE</Text><Text style={styles.title}>Crie sua conta.</Text><Text style={styles.copy}>Seus dados e pedidos ficam privados. Só a equipe da comunidade e o guia atribuído à experiência recebem as informações necessárias para organizar a visita.</Text>
    <Field label="Nome completo" value={fullName} onChangeText={setFullName} /><Field label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Field label="Senha (mínimo 8 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <Pressable disabled={busy || !configured || !fullName.trim() || !email.trim()} onPress={submit} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Criando…' : 'Criar perfil de visitante'}</Text></Pressable>
  </ScrollView>
}
// Campo reutilizável mantém rótulo e aparência consistentes no formulário de cadastro.
function Field(props: { label: string; [key: string]: any }) { const { label, ...inputProps } = props; return <><Text style={styles.label}>{label}</Text><TextInput {...inputProps} style={styles.input} placeholderTextColor={theme.muted} /></> }
const styles = StyleSheet.create({screen:{padding:24,paddingBottom:44,backgroundColor:theme.background},kicker:{marginTop:16,fontSize:9,letterSpacing:1.4,fontWeight:'800',color:theme.green},title:{fontSize:26,lineHeight:34,fontWeight:'700',color:theme.ink,marginTop:12},copy:{fontSize:13,lineHeight:20,color:theme.muted,marginTop:10,marginBottom:22},label:{fontSize:11,fontWeight:'700',color:theme.ink,marginTop:14,marginBottom:7},input:{height:48,paddingHorizontal:13,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,color:theme.ink},primary:{height:48,marginTop:24,backgroundColor:theme.green,alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontWeight:'700'},message:{marginTop:14,color:theme.clay,fontSize:12,lineHeight:18}})
