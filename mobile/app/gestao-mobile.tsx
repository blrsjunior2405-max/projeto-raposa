// Orienta contas operacionais para o site, mantendo o aplicativo móvel voltado ao visitante.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { theme } from '@/lib/theme'

export default function CommunityAccessScreen() {
  return <View style={styles.screen}>
    <Text style={styles.kicker}>RAPOSA I · ACESSO DA COMUNIDADE</Text>
    <Text style={styles.title}>A gestão acontece no site.</Text>
    <Text style={styles.copy}>Calendário, pedidos, guias e disponibilidade ficam no painel web da comunidade, pensado para organizar o trabalho coletivo.</Text>
    <Link href="/" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Abrir endereço do site no navegador</Text></Pressable></Link>
    <Text style={styles.note}>Use a URL do site compartilhada pela comunidade. Este aplicativo permanece dedicado à experiência do visitante.</Text>
  </View>
}

const styles = StyleSheet.create({ screen:{flex:1,justifyContent:'center',padding:26,backgroundColor:theme.background},kicker:{fontSize:9,letterSpacing:1.4,fontWeight:'800',color:theme.green},title:{fontSize:26,lineHeight:34,fontWeight:'700',color:theme.ink,marginTop:13},copy:{fontSize:13,lineHeight:20,color:theme.muted,marginTop:10,marginBottom:22},button:{minHeight:48,alignItems:'center',justifyContent:'center',padding:12,backgroundColor:theme.green},buttonText:{color:'#fff',fontWeight:'700',fontSize:12},note:{fontSize:11,lineHeight:17,color:theme.muted,marginTop:16} })
