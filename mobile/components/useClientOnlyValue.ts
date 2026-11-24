// Na versão nativa, devolve diretamente o valor do aparelho porque não há renderização no servidor.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return client;
}
