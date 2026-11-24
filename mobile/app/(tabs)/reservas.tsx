// Área pessoal de visitas: busca somente pedidos do cliente conectado, conforme as regras do banco.
import { useCallback, useState } from 'react'
import { useFocusEffect, Link } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { catalog } from '@/lib/catalog'
import { theme } from '@/lib/theme'
import { mensagemDeErro } from '@/lib/mensagens'

type Booking = { id:string; experience_id:string; scheduled_for:string; participants:number; status:string; customer_note:string|null; accessibility_needs:string|null; dietary_restrictions:string|null; created_at:string; updated_at:string }
// Traduz os estados internos do banco para o que o cliente acompanha na lista de visitas.
const labels: Record<string,string> = { requested:'Aguardando confirmação', confirmed:'Confirmada pela comunidade', cancelled:'Cancelada', completed:'Concluída' }
// A lista atualiza ao abrir a aba para mostrar respostas recentes da comunidade.
export default function ReservationsScreen() {
  const { session, loading } = useAuth()
  const [rows,setRows]=useState<Booking[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  async function cancelBooking(bookingId:string) {
    if(!supabase)return
    setBusy(true);setMessage('')
    const {data,error}=await supabase.rpc('cancel_own_booking',{target_booking_id:bookingId})
    if(error)setMessage(mensagemDeErro(error))
    else setRows(current=>current.map(row=>row.id===bookingId?{...row,status:data.status,updated_at:data.updated_at}:row))
    setBusy(false)
  }
  function confirmCancellation(bookingId:string) {
    Alert.alert('Cancelar pedido?', 'As vagas serão liberadas para outros visitantes.', [
      {text:'Manter pedido',style:'cancel'},
      {text:'Cancelar pedido',style:'destructive',onPress:()=>{void cancelBooking(bookingId)}},
    ])
  }
  // O filtro pelo identificador da sessão impede que a aba peça reservas de outros clientes.
  useFocusEffect(useCallback(()=>{let active=true; async function load(){if(!session||!supabase)return;setBusy(true);const {data,error}=await supabase.from('bookings').select('id, experience_id, scheduled_for, participants, status, customer_note, accessibility_needs, dietary_restrictions, created_at, updated_at').eq('customer_id',session.user.id).order('scheduled_for',{ascending:false});if(active){setRows(data||[]);setMessage(error?mensagemDeErro(error):'');setBusy(false)}} load(); return()=>{active=false}},[session]))
  if(loading)return <View style={styles.center}><ActivityIndicator color={theme.green}/></View>
  if(!session)return <View style={styles.center}><Text style={styles.title}>Suas visitas, em um só lugar.</Text><Text style={styles.copy}>Entre com seu perfil para acompanhar pedidos e confirmações.</Text><Link href={'/login' as any} asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Entrar</Text></Pressable></Link></View>
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>ÁREA DO VISITANTE</Text><Text style={styles.title}>Minhas visitas</Text><Text style={styles.copy}>A comunidade confirma cada pedido. O preço é combinado no local.</Text>{busy&&<ActivityIndicator color={theme.green}/ >}{message?<Text style={styles.error}>{message}</Text>:null}{!busy&&!rows.length&&<View style={styles.empty}><Text style={styles.cardTitle}>Ainda não há pedidos.</Text><Text style={styles.copy}>Escolha uma experiência e envie uma consulta de data.</Text><Link href={'/(tabs)' as any} style={styles.link}>Ver experiências</Link></View>}{rows.map(row=>{const experience=catalog.find(item=>item.id===row.experience_id);return <View key={row.id} style={styles.card}><Text style={styles.kicker}>{experience?.category||'EXPERIÊNCIA'}</Text><Text style={styles.cardTitle}>{experience?.title||'Experiência'}</Text><Text style={styles.copy}>{new Date(row.scheduled_for).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'})} · {row.participants} {row.participants===1?'pessoa':'pessoas'}</Text><View style={styles.status}><Text style={styles.statusText}>{labels[row.status]||row.status}</Text></View><Text style={styles.note}>Solicitado em {new Date(row.created_at).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'})} · atualizado em {new Date(row.updated_at).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'})}</Text>{row.customer_note?<Text style={styles.note}>Observação: {row.customer_note}</Text>:null}{row.accessibility_needs?<Text style={styles.note}>Acessibilidade: {row.accessibility_needs}</Text>:null}{row.dietary_restrictions?<Text style={styles.note}>Alergias e restrições alimentares: {row.dietary_restrictions}</Text>:null}{row.status==='requested'?<Pressable disabled={busy} onPress={()=>confirmCancellation(row.id)} style={styles.cancel}><Text style={styles.cancelText}>Cancelar pedido pendente</Text></Pressable>:null}</View>})}</ScrollView>
}
const styles=StyleSheet.create({content:{padding:20,paddingBottom:40,backgroundColor:theme.background,flexGrow:1},center:{flex:1,justifyContent:'center',alignItems:'center',padding:28,backgroundColor:theme.background},kicker:{fontSize:9,letterSpacing:1.3,fontWeight:'800',color:theme.green},title:{fontSize:24,lineHeight:32,color:theme.ink,fontWeight:'700',marginTop:10},copy:{fontSize:12,lineHeight:19,color:theme.muted,marginTop:7},card:{marginTop:15,padding:16,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface},cardTitle:{fontSize:16,lineHeight:22,color:theme.ink,fontWeight:'700',marginTop:5},status:{alignSelf:'flex-start',marginTop:12,paddingHorizontal:10,paddingVertical:6,backgroundColor:'#e8eadf'},statusText:{fontSize:10,color:theme.green,fontWeight:'700'},note:{marginTop:12,color:theme.muted,fontSize:11},cancel:{alignSelf:'flex-start',marginTop:14,paddingVertical:9,paddingHorizontal:12,borderWidth:1,borderColor:theme.clay},cancelText:{color:theme.clay,fontSize:10,fontWeight:'700'},empty:{marginTop:26,padding:20,backgroundColor:theme.surface},button:{marginTop:18,backgroundColor:theme.green,padding:14},buttonText:{color:'#fff',fontWeight:'700'},link:{marginTop:12,color:theme.green,fontWeight:'700'},error:{marginTop:10,color:theme.clay}})
