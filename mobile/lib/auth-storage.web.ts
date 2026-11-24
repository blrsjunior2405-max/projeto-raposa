// O navegador Expo Web usa o armazenamento nativo da própria plataforma.
const authStorage = {
  getItem: (key: string) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: (key: string, value: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value) },
  removeItem: (key: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(key) },
}
export default authStorage
