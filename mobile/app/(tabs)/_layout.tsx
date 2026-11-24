// As abas dão acesso às três áreas usadas pelo visitante: catálogo, pedidos e perfil.
import { Tabs } from 'expo-router'
import { Text, View, ActivityIndicator } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { theme } from '@/lib/theme'

const green = '#28523c'

export default function TabLayout() {
  const { profile, loading } = useAuth()

  // O app é exclusivo do visitante; operações de guia/admin continuam no site da comunidade.
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}><ActivityIndicator color={green} /></View>
  if (profile && profile.role !== 'visitor') return <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: theme.background }}><Text style={{ color: theme.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>RAPOSA I · GESTÃO COMUNITÁRIA</Text><Text style={{ color: theme.ink, fontSize: 25, fontWeight: '700', marginTop: 12 }}>Use o site da comunidade para organizar as visitas.</Text><Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>O aplicativo móvel é voltado a visitantes. Guias e administradores acessam calendário, solicitações e disponibilidade pelo painel web.</Text></View>
  if (profile && profile.role !== 'visitor') return <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: theme.background }}><Text style={{ color: theme.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>RAPOSA I · GESTÃO COMUNITÁRIA</Text><Text style={{ color: theme.ink, fontSize: 25, fontWeight: '700', marginTop: 12 }}>Use o site da comunidade para organizar as visitas.</Text><Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>O aplicativo móvel é voltado a visitantes. Guias e administradores acessam calendário, solicitações e disponibilidade pelo painel web.</Text></View>

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: green,
      tabBarInactiveTintColor: '#888a7e',
      tabBarStyle: { backgroundColor: '#fbfaf6', borderTopColor: '#e9e6dc', height: 62, paddingTop: 6, paddingBottom: 7 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Experiências', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 19 }}>✳</Text> }} />
      <Tabs.Screen name="reservas" options={{ title: 'Minhas visitas', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▦</Text> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Meu perfil', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text> }} />
    </Tabs>
  )
}
