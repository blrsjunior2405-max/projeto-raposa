// Perfil de visitante: edita os próprios dados e oferece uma saída segura da conta.
import { useState } from 'react'
import { Link, router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { mensagemDeErro } from '@/lib/mensagens'
import { theme } from '@/lib/theme'

export default function ProfileScreen() {
  const { session, profile, loading, signOut } = useAuth()
  const [fullName,setFullName]=useState(profile?.full_name||''); const [phone,setPhone]=useState(profile?.phone||''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false)
  // A política do banco permite que a pessoa atualize nome e telefone do próprio perfil.
  async function save(){if(!supabase||!session)return;setBusy(true);const {error}=await supabase.from('profiles').update({full_name:fullName.trim(),phone:phone.trim()||null}).eq('id',session.user.id);setMessage(error?mensagemDeErro(error):'Perfil atualizado.');setBusy(false)}
  // Encerra a sessão antes de voltar ao catálogo público do aplicativo.
  async function logout(){await signOut();router.replace('/(tabs)' as any)}
  if(loading)return <View style={styles.center}><Text style={styles.copy}>Carregando seu perfil…</Text></View>
  if(!session)return <View style={styles.center}><Text style={styles.kicker}>RAPOSA I</Text><Text style={styles.title}>Seu perfil de visitante</Text><Text style={styles.copy}>Crie uma conta para acompanhar consultas de data e receber as respostas da comunidade.</Text><Link href={'/login' as any} asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Entrar</Text></Pressable></Link><Link href={'/signup' as any} style={styles.link}>Criar perfil</Link><Text style={styles.small}>O acesso de guias fica no painel de gestão do site.</Text></View>
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>PERFIL DO VISITANTE</Text><Text style={styles.title}>Olá, {profile?.full_name||session.user.email}.</Text><><Text style={styles.label}>Nome</Text><TextInput value={fullName} onChangeText={setFullName} style={styles.input}/><Text style={styles.label}>Telefone</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input}/><Pressable onPress={save} disabled={busy} style={styles.button}><Text style={styles.buttonText}>{busy?'Salvando…':'Salvar perfil'}</Text></Pressable><Link href={'/(tabs)/reservas' as any} style={styles.link}>Acompanhar minhas visitas</Link></>{message?<Text style={styles.message}>{message}</Text>:null}<Text style={styles.small}>{session.user.email}</Text><Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Sair da conta</Text></Pressable></ScrollView>
}
const styles=StyleSheet.create({content:{padding:22,paddingBottom:44,backgroundColor:theme.background,flexGrow:1},center:{flex:1,justifyContent:'center',alignItems:'center',padding:28,backgroundColor:theme.background},kicker:{fontSize:9,letterSpacing:1.4,fontWeight:'800',color:theme.green},title:{fontSize:24,lineHeight:32,fontWeight:'700',color:theme.ink,marginTop:10},copy:{fontSize:12,lineHeight:19,color:theme.muted,marginTop:9},label:{fontSize:11,fontWeight:'700',color:theme.ink,marginTop:20,marginBottom:7},input:{height:46,paddingHorizontal:12,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,color:theme.ink},button:{height:46,marginTop:20,backgroundColor:theme.green,alignItems:'center',justifyContent:'center',paddingHorizontal:22},buttonText:{color:'#fff',fontWeight:'700'},link:{marginTop:18,color:theme.green,fontWeight:'700'},small:{marginTop:22,color:theme.muted,fontSize:10},logout:{marginTop:30,paddingVertical:14,borderTopWidth:1,borderColor:theme.border},logoutText:{color:theme.clay,fontWeight:'700'},message:{marginTop:12,color:theme.green}})
