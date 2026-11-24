// Cartão do catálogo: recebe a experiência e sua foto e pede à tela principal que abra o detalhe.
export default function ExperienceCard({ activity, image, index, onOpen }) {
  const backgroundImage = `linear-gradient(0deg, rgba(20,32,24,.28), transparent 60%), url("${image}")`

  return (
    <article className="experience-card" style={{ '--card-index': index }}>
      <button className="card-image-button" onClick={() => onOpen(activity)} aria-label={`Ver ${activity.title}`}>
        <div className={`card-image scene-${activity.scene}`} style={{ backgroundImage }}>
          <span className="card-category">{activity.category}</span>
          <span className="card-icon">{activity.icon}</span>
          <span className="card-play">◉ <small>FOTO DO CATÁLOGO 2023</small></span>
        </div>
      </button>
      <div className="card-body">
        <div className="card-meta"><span>RAPOSA I, NORMANDIA</span><span>{activity.duration}</span></div>
        <h3>{activity.title}</h3>
        <p>{activity.short}</p>
        <div className="card-bottom">
          <span>Valor combinado no local</span>
          <button onClick={() => onOpen(activity)}>Conhecer <span>↗</span></button>
        </div>
      </div>
    </article>
  )
}
