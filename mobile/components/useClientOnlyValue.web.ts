import { useEffect, useState } from 'react';

// No servidor o efeito ainda não executou; ao abrir no navegador, o estado troca
// do valor inicial pelo valor que só existe no dispositivo do visitante.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  const [value, setValue] = useState<S | C>(server);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setValue(client));
    return () => cancelAnimationFrame(frame);
  }, [client]);

  return value;
}
