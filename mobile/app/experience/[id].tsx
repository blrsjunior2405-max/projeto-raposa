// Esta tela recebe o identificador da experiência e junta descrição local com metadados do banco.
import { useEffect, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { activityImages, catalog, type Experience } from '@/lib/catalog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { theme } from '@/lib/theme'

export default function ExperienceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activity, setActivity] = useState<Experience | null>(catalog.find((item) => item.id === id) || null)
  const { profile } = useAuth()

  // Atualiza título, categoria e capacidade se a comunidade editar o cadastro no painel.
  useEffect(() => {
    let active = true
    async function loadActivity() {
      if (!supabase || !id) return
      const { data } = await supabase.from('experiences').select('title, category, summary, duration, max_participants, image_key').eq('id', id).maybeSingle()
      if (!active || !data) return
      const details = catalog.find((item) => item.id === id)
      if (details) setActivity({ ...details, ...data, imageKey: data.image_key, maxParticipants: data.max_participants })
    }
    loadActivity()
    return () => { active = false }
  }, [id])

  // O botão de consulta aparece apenas para visitantes; guias usam o painel restrito no site.
  if (!activity) return <View style={styles.notFound}><Text>Experiência não encontrada.</Text></View>
  const visitorCanBook = !profile || profile.role === 'visitor'

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Image source={activityImages[activity.imageKey]} style={styles.cover}/>
    <View style={styles.body}>
      <Text style={styles.kicker}>{activity.category.toUpperCase()} · COMUNIDADE RAPOSA I</Text>
      <Text style={styles.title}>{activity.title}</Text>
      <Text style={styles.summary}>{activity.summary}</Text>
      <View style={styles.metaRow}><Info label="DURAÇÃO" value={activity.duration}/><Info label="GRUPO" value={activity.people}/></View>
      <Section title="Sobre a vivência"><Text style={styles.paragraph}>{activity.description}</Text></Section>
      <Section title="Recomendações e atenção"><Text style={styles.paragraph}>{activity.advice}</Text></Section>
      <Section title="O que está incluído"><Text style={styles.paragraph}>{activity.includes}</Text></Section>
      <View style={styles.priceNote}><Text style={styles.priceTitle}>PREÇO INFORMADO PELA COMUNIDADE</Text><Text style={styles.priceCopy}>A solicitação de data não confirma a visita. Após o pedido, a comunidade entrará em contato para compartilhar o preço e confirmar a disponibilidade.</Text></View>
      {visitorCanBook ? <Link href={{ pathname: '/book/[id]', params: { id: activity.id } }} asChild><Text style={styles.bookButton}>Consultar uma data <Text style={styles.buttonArrow}>↗</Text></Text></Link> : <Text style={styles.guideNote}>O acesso de guia é feito pelo painel web da comunidade.</Text>}
      <Text style={styles.source}>Fotografia e informações resumidas do Catálogo de Experiências da Comunidade Indígena Raposa I (2023). Imagens de rituais devem ser apreciadas conforme as orientações da comunidade.</Text>
    </View>
  </ScrollView>
}

// Pequenos componentes reutilizados organizam os dados técnicos e as seções descritivas.
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View> }
function Section({ title, children }: PropsWithChildren<{ title: string }>) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View> }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 32 },
  cover: { width: '100%', height: 270 },
  body: { padding: 20 },
  kicker: { marginTop: 7, color: theme.green, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 11, fontFamily: 'SpaceMono', fontSize: 27, lineHeight: 35, color: theme.ink, fontWeight: '700' },
  summary: { marginTop: 8, fontSize: 13, lineHeight: 20, color: theme.muted },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border, paddingVertical: 14 },
  info: { flex: 1, gap: 5 },
  infoLabel: { fontSize: 8, letterSpacing: 1, color: theme.muted, fontWeight: '700' },
  infoValue: { fontSize: 12, color: theme.ink, fontWeight: '600' },
  section: { marginTop: 22 },
  sectionTitle: { fontFamily: 'SpaceMono', fontWeight: '700', fontSize: 15, color: theme.ink, marginBottom: 7 },
  paragraph: { fontSize: 12, lineHeight: 20, color: '#5e6157' },
  priceNote: { marginTop: 24, padding: 14, backgroundColor: '#eeeee5', borderLeftWidth: 3, borderLeftColor: theme.ochre },
  priceTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: theme.green },
  priceCopy: { marginTop: 6, fontSize: 10, lineHeight: 16, color: theme.muted },
  bookButton: { marginTop: 14, backgroundColor: theme.green, padding: 15, textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: 12 },
  buttonArrow: { color: '#edc875' },
  guideNote: { marginTop: 15, padding: 12, backgroundColor: theme.sage, color: theme.green, fontSize: 10, lineHeight: 16 },
  source: { marginTop: 18, fontSize: 9, lineHeight: 15, color: '#89897f' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
})
