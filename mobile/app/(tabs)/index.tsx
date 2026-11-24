// Catálogo inicial do app: combina os textos locais com a lista online quando há conexão.
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { activityImages, catalog, categories, type Experience } from '@/lib/catalog'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { getCommunityWhatsApp } from '@/lib/community-settings'
import { theme } from '@/lib/theme'

const hero = require('../../assets/activities/hero.jpg')

export default function ExperiencesScreen() {
  const [activities, setActivities] = useState<Experience[]>(catalog)
  const [category, setCategory] = useState('Todas')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [communityWhatsApp, setCommunityWhatsApp] = useState('559584262222')

  // Busca a versão ativa no Supabase e conserva os textos locais se o serviço estiver fora do ar.
  useEffect(() => {
    let active = true
    async function loadCatalog() {
      if (!supabase) return
      setLoading(true)
      const [{ data, error }, contactResult] = await Promise.all([
        supabase.from('experiences')
          .select('id, title, category, summary, duration, max_participants, image_key')
          .eq('is_active', true)
          .order('title'),
        getCommunityWhatsApp(supabase),
      ])
      if (!active) return
      if (error) setOffline(true)
      if (!contactResult.error && contactResult.data?.whatsapp_phone) setCommunityWhatsApp(contactResult.data.whatsapp_phone)
      if (data?.length) {
        const details = new Map(catalog.map((item) => [item.id, item]))
        setActivities(data.map((row) => ({ ...details.get(row.id), ...row, imageKey: row.image_key, maxParticipants: row.max_participants } as Experience)))
      }
      setLoading(false)
    }
    loadCatalog()
    return () => { active = false }
  }, [])

  // Busca e categorias filtram a lista sem alterar o catálogo que veio do banco ou do arquivo local.
  const filtered = useMemo(() => activities.filter((activity) => {
    const matchesCategory = category === 'Todas' || activity.category === category
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    const matchesQuery = !needle || `${activity.title} ${activity.summary} ${activity.category}`.toLocaleLowerCase('pt-BR').includes(needle)
    return matchesCategory && matchesQuery
  }), [activities, category, query])

  return <FlatList
    data={filtered}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.listContent}
    ListHeaderComponent={<>
      <Image source={hero} style={styles.hero} resizeMode="cover" />
      <View style={styles.pagePadding}>
        <View style={styles.eyebrowRow}><View style={styles.dot}/><Text style={styles.eyebrow}>RAPOSA I · NORMANDIA</Text><Text style={styles.season}>RORAIMA</Text></View>
        <Text style={styles.title}>Viva de perto.{"\n"}<Text style={styles.titleAccent}>No ritmo da comunidade.</Text></Text>
        <Text style={styles.intro}>Trilhas, sabores e saberes compartilhados por quem chama a Raposa I de casa.</Text>
        {!supabaseConfigured && <View style={styles.setupBanner}><Text style={styles.setupText}>Catálogo disponível. Para consultar e salvar visitas, conecte o banco de dados ao app.</Text></View>}
        {offline && <Text style={styles.offline}>Sem conexão com o catálogo online. Mostrando a versão salva no aplicativo.</Text>}
        <Pressable style={styles.whatsapp} onPress={() => Linking.openURL(`https://wa.me/${communityWhatsApp}`)} accessibilityRole="link"><Text style={styles.whatsappIcon}>◔</Text><View style={styles.whatsappCopy}><Text style={styles.whatsappTitle}>Fale com a comunidade</Text><Text style={styles.whatsappSubtitle}>Tire dúvidas sobre sua visita pelo WhatsApp</Text></View><Text style={styles.whatsappArrow}>↗</Text></Pressable>
        <View style={styles.search}><Text style={styles.searchGlyph}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Buscar vivência" placeholderTextColor="#888a7e" style={styles.searchInput}/></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text></Pressable>)}</ScrollView>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionKicker}>ESCOLHA SUA VIVÊNCIA</Text><Text style={styles.sectionTitle}>Experiências</Text></View><Text style={styles.count}>{filtered.length.toString().padStart(2, '0')}</Text></View>
        {loading && <View style={styles.loading}><ActivityIndicator color={theme.green}/><Text style={styles.loadingText}>Atualizando experiências…</Text></View>}
      </View>
    </>}
    renderItem={({ item }) => <ExperienceCard item={item}/>}
    ListEmptyComponent={<Text style={styles.empty}>Nenhuma experiência encontrada.</Text>}
    ListFooterComponent={<View style={[styles.pagePadding, styles.footer]}><Text style={styles.footerLabel}>TURISMO DE BASE COMUNITÁRIA</Text><Text style={styles.footerText}>A comunidade orienta as visitas e confirma cada pedido antes da viagem.</Text></View>}
  />
}

// Cada cartão abre a tela de detalhe e reaproveita a imagem associada à experiência no catálogo.
function ExperienceCard({ item }: { item: Experience }) {
  return <Pressable style={styles.card} onPress={() => router.push({ pathname: '/experience/[id]', params: { id: item.id } })}>
    <Image source={activityImages[item.imageKey]} style={styles.cardImage} resizeMode="cover"/>
    <View style={styles.cardContent}>
      <View style={styles.cardMeta}><Text style={styles.cardCategory}>{item.category.toUpperCase()}</Text><Text style={styles.duration}>{item.duration}</Text></View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSummary} numberOfLines={3}>{item.summary}</Text>
      <View style={styles.cardBottom}><Text style={styles.price}>Valor combinado no local</Text><Text style={styles.cardArrow}>Conhecer ↗</Text></View>
    </View>
  </Pressable>
}

// Estilos pensados primeiro para celular no cabeçalho, busca, filtros, cartões e rodapé do catálogo.
const styles = StyleSheet.create({
  listContent: { paddingBottom: 30, backgroundColor: theme.background },
  pagePadding: { paddingHorizontal: 20 },
  hero: { width: '100%', height: 235 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 23 },
  dot: { width: 7, height: 7, borderRadius: 8, backgroundColor: theme.ochre },
  eyebrow: { color: theme.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  season: { marginLeft: 'auto', fontSize: 9, letterSpacing: 1, color: theme.muted },
  title: { marginTop: 15, color: theme.ink, fontFamily: 'SpaceMono', fontSize: 29, lineHeight: 36, fontWeight: '700' },
  titleAccent: { color: theme.green },
  intro: { marginTop: 10, color: theme.muted, fontSize: 12, lineHeight: 19, maxWidth: 330 },
  setupBanner: { marginTop: 14, backgroundColor: '#eeeee3', borderLeftWidth: 2, borderLeftColor: theme.ochre, padding: 10 },
  setupText: { fontSize: 10, lineHeight: 15, color: '#64665c' },
  offline: { color: theme.clay, marginTop: 10, fontSize: 10 },
  whatsapp: { minHeight: 58, marginTop: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e9efe8', borderWidth: 1, borderColor: '#dce6da' },
  whatsappIcon: { color: theme.green, fontSize: 22 },
  whatsappCopy: { flex: 1 },
  whatsappTitle: { color: theme.green, fontSize: 11, fontWeight: '700' },
  whatsappSubtitle: { marginTop: 3, color: theme.muted, fontSize: 9 },
  whatsappArrow: { color: theme.green, fontSize: 14, fontWeight: '700' },
  search: { height: 44, marginTop: 21, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  searchGlyph: { fontSize: 22, marginRight: 9, color: theme.muted },
  searchInput: { flex: 1, fontSize: 12, color: theme.ink },
  categories: { gap: 7, paddingVertical: 13 },
  category: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 20, backgroundColor: 'transparent' },
  categoryActive: { backgroundColor: theme.green, borderColor: theme.green },
  categoryText: { color: '#63655a', fontSize: 10, fontWeight: '600' },
  categoryTextActive: { color: '#fff' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  sectionKicker: { fontSize: 8, fontWeight: '800', letterSpacing: 1.3, color: theme.muted },
  sectionTitle: { marginTop: 4, fontSize: 23, color: theme.ink, fontFamily: 'SpaceMono', fontWeight: '700' },
  count: { color: theme.clay, fontFamily: 'SpaceMono', fontSize: 22 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9 },
  loadingText: { fontSize: 10, color: theme.muted },
  card: { marginHorizontal: 20, marginBottom: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: '#edeae1' },
  cardImage: { width: '100%', height: 190 },
  cardContent: { padding: 14 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { fontSize: 8, color: theme.green, fontWeight: '800', letterSpacing: 1 },
  duration: { fontSize: 9, color: theme.muted },
  cardTitle: { marginTop: 9, fontSize: 17, lineHeight: 22, color: theme.ink, fontFamily: 'SpaceMono', fontWeight: '700' },
  cardSummary: { marginTop: 7, fontSize: 11, lineHeight: 17, color: theme.muted },
  cardBottom: { borderTopWidth: 1, borderTopColor: '#eeece5', marginTop: 12, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between' },
  price: { fontSize: 9, color: theme.muted },
  cardArrow: { fontSize: 9, fontWeight: '700', color: theme.green },
  empty: { textAlign: 'center', color: theme.muted, padding: 28, fontSize: 12 },
  footer: { paddingTop: 18, paddingBottom: 10 },
  footerLabel: { color: theme.green, fontSize: 8, letterSpacing: 1.1, fontWeight: '800' },
  footerText: { marginTop: 6, fontSize: 10, lineHeight: 16, color: theme.muted },
})
