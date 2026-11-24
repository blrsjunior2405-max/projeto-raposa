// Formato comum que as telas usam para apresentar uma vivência, venha ela do arquivo ou do banco.
export type Experience = {
  id: string
  title: string
  category: string
  summary: string
  description: string
  duration: string
  people: string
  imageKey: string
  advice: string
  includes: string
  maxParticipants: number | null
}

// Catálogo de reserva local: mantém as descrições completas mesmo se não houver internet.
export const catalog: Experience[] = [
  { id: 'cachoeira', category: 'Natureza', title: 'Trilha cultural da Cachoeira da Raposa', summary: 'Caminhada com condutores locais, histórias da comunidade e banho de cachoeira.', description: 'Depois das instruções dos condutores, o grupo segue até a trilha e conhece a história da cachoeira e sua relação com a comunidade. A caminhada dura cerca de 20 a 30 minutos, com paradas para apreciar a paisagem. No local, há tempo para banho e fotografias. Peça licença e siga a orientação dos condutores antes de entrar.', duration: '2h30', people: '1–20 pessoas', imageKey: 'cachoeira', advice: 'Leve água, protetor solar, repelente, chapéu, óculos escuros, câmera e roupa e calçados adequados para caminhada.', includes: 'Acompanhamento de condutor local.', maxParticipants: 20 },
  { id: 'arcoiris', category: 'Natureza', title: 'Caminhada na Serra do Arco-Íris', summary: 'Subida curta com vista para as serras, a paisagem e a vila da Raposa I.', description: 'A caminhada começa no barracão da comunidade e passa por casas locais. Uma subida de aproximadamente 15 metros leva ao topo da serra em cerca de cinco minutos. Os condutores compartilham histórias sobre a serra e a comunidade enquanto o grupo observa a paisagem.', duration: '1h30', people: '1–15 pessoas', imageKey: 'serra', advice: 'Leve água, protetor solar e repelente. Use chapéu, óculos escuros e roupa e calçados próprios para caminhada.', includes: 'Acompanhamento de condutor local.', maxParticipants: 15 },
  { id: 'panela', category: 'Saberes', title: 'Panela de barro: a alma do povo Macuxi', summary: 'Conheça as paneleiras e modele uma peça com barro e saberes locais.', description: 'As anfitriãs apresentam a preparação do barro, a modelagem e as etapas seguintes de polimento e queima. O processo completo atravessa mais de um dia; confirme com a comunidade quais fases estarão disponíveis na data.', duration: 'Etapas em mais de um dia', people: '1–12 pessoas', imageKey: 'barro', advice: 'Leve água, use roupa adequada para ficar próximo ao forno e siga atentamente as instruções das artesãs.', includes: 'Insumos, equipamentos e a peça feita na oficina. Envio pelo correio não incluído.', maxParticipants: 12 },
  { id: 'beiju', category: 'Gastronomia', title: 'Produção Macuxi de beiju e farinha', summary: 'Acompanhe o preparo da mandioca, do beiju e da farinha e prove as iguarias.', description: 'As anfitriãs apresentam ingredientes e utensílios. O grupo conhece o processamento da mandioca, participa do preparo do beiju no tacho e prova o resultado. Farinha e derivados podem ser comprados à parte, conforme disponibilidade.', duration: '2–3h', people: '1–10 pessoas', imageKey: 'beiju', advice: 'Há etapas com mandioca em processamento e tacho aquecido. Siga as orientações das anfitriãs e avise sobre restrições alimentares.', includes: 'Apresentação, demonstração do preparo e degustação.', maxParticipants: 10 },
  { id: 'caxiri', category: 'Gastronomia', title: 'Caxiri: conheça e deguste', summary: 'Conheça a bebida fermentada Macuxi, seu preparo e presença comunitária.', description: 'A anfitriã apresenta o caxiri, bebida fermentada que na Raposa I costuma ser preparada com milho. A conversa aborda sua importância na alimentação e nas histórias das famílias, seguida de degustação.', duration: '2h30', people: '1–10 pessoas', imageKey: 'caxiri', advice: 'O preparo acontece perto de local aquecido. Siga as instruções e avise sobre restrições alimentares.', includes: 'Equipamentos, insumos e degustação.', maxParticipants: 10 },
  { id: 'lago', category: 'Natureza', title: 'Passeio e pesca no Lago da Barragem', summary: 'Passeio de barco e pesca artesanal acompanhada por anfitriões locais.', description: 'O encontro é no Malocão. O anfitrião compartilha a história do lago e sua importância para o povo Macuxi. O grupo segue de barco até o ponto de pesca artesanal com vara e retorna pelo mesmo caminho.', duration: '4h', people: '1–4 pessoas', imageKey: 'lago', advice: 'Leve água, protetor solar, repelente, chapéu e roupa adequada para caminhada e banho. Há um único barco, então o grupo pode precisar se dividir.', includes: 'Barco, instrumentos de pesca, iscas e acompanhamento dos condutores.', maxParticipants: 4 },
  { id: 'parixara', category: 'Saberes', title: 'A tradição milenar da dança Parixara', summary: 'Conheça preparativos, cantos e significado do Parixara com anfitriãs.', description: 'As anfitriãs apresentam a preparação das saias de palha e tintas para pintura. Em seguida, os membros da comunidade demonstram o ritual com cantos próprios e convidam os visitantes a participar, conforme orientação local.', duration: '1h', people: '1–5 pessoas', imageKey: 'parixara', advice: 'Use roupa adequada para dança e leve repelente e protetor solar. Pergunte antes de fotografar ou filmar e respeite as orientações locais.', includes: 'Explicação e apresentação. Indumentária e alimentos para degustação não incluídos.', maxParticipants: 5 },
  { id: 'arco', category: 'Saberes', title: 'Tradição milenar do arco e flecha', summary: 'História, materiais e demonstração de prática transmitida entre gerações.', description: 'O anfitrião conta a história do arco e flecha e apresenta materiais e instrumentos. Explica as diferenças entre as pontas e, conforme instrução, os visitantes podem praticar tiro ao alvo.', duration: '2h', people: 'Capacidade a confirmar', imageKey: 'arco', advice: 'Leve água, protetor solar e repelente. Manuseie objetos cortantes ou pontiagudos somente sob instrução do anfitrião.', includes: 'História e oficina. Arco e flecha não incluídos; podem ser adquiridos à parte.', maxParticipants: null },
  { id: 'damurida', category: 'Gastronomia', title: 'Damurida: gastronomia indígena', summary: 'Participe do preparo deste prato Macuxi à base de pimenta.', description: 'As anfitriãs apresentam os ingredientes da damurida — pimenta, folhas, tucupi e peixe — e convidam os visitantes a participar do preparo e compartilhar uma refeição. O catálogo informa que uma versão com banana pode ser solicitada previamente.', duration: '2h', people: '1–10 pessoas', imageKey: 'damurida', advice: 'A receita tradicional leva pimenta e não é recomendada a pessoas alérgicas. Avise sobre alergias e restrições antes da visita.', includes: 'Ingredientes, degustação e acompanhamento das anfitriãs.', maxParticipants: 10 },
  { id: 'trancados', category: 'Saberes', title: 'Mundo dos trançados Macuxi', summary: 'Veja fibras e palhas se transformarem em cestos, tipitis e peneiras.', description: 'Os anfitriões apresentam fios de darruana e palha e demonstram as técnicas de trançado e acabamento. As peças podem ser compradas à parte, conforme disponibilidade.', duration: '1–2h', people: '1–10 pessoas', imageKey: 'trancados', advice: 'Leve água, protetor solar, repelente e equipamento de fotografia. Consulte sobre disponibilidade de peças para compra.', includes: 'Demonstração do processo; peças não incluídas.', maxParticipants: 10 },
]

// Categorias usadas pelos filtros da tela inicial.
export const categories = ['Todas', 'Natureza', 'Saberes', 'Gastronomia']

// Relaciona a chave imageKey de cada vivência ao arquivo de foto incluído no aplicativo.
export const activityImages: Record<string, number> = {
  cachoeira: require('../assets/activities/cachoeira.jpg'),
  serra: require('../assets/activities/serra.jpg'),
  barro: require('../assets/activities/barro.jpg'),
  beiju: require('../assets/activities/beiju.jpg'),
  caxiri: require('../assets/activities/caxiri.jpg'),
  lago: require('../assets/activities/lago.jpg'),
  parixara: require('../assets/activities/parixara.jpg'),
  arco: require('../assets/activities/arco.jpg'),
  damurida: require('../assets/activities/damurida.jpg'),
  trancados: require('../assets/activities/trancados.jpg'),
}
