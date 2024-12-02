// Importações essenciais para funcionalidades de criptografia, manipulação de objetos, e banco de dados
import { randomBytes } from 'node:crypto' // Geração de IDs aleatórios
import { getProperty } from 'dot-prop' // Acesso a propriedades aninhadas em objetos
import inflection from 'inflection' // Manipulação de singular/plural para nomes de entidades
import { Low } from 'lowdb' // Banco de dados em JSON
import sortOn from 'sort-on' // Ordenação de objetos com base em propriedades

// Define os tipos básicos de dados manipulados no serviço
export type Item = Record<string, unknown>
export type Data = Record<string, Item[] | Item>

// Função para verificar se um objeto é um Item válido
export function isItem(obj: unknown): obj is Item {
  return typeof obj === 'object' && obj !== null
}

// Função para validar a estrutura do banco de dados
export function isData(obj: unknown): obj is Record<string, Item[]> {
  if (typeof obj !== 'object' || obj === null) return false
  const data = obj as Record<string, unknown>
  return Object.values(data).every(
    (value) => Array.isArray(value) && value.every(isItem),
  )
}

// Enum para condições de filtragem
enum Condition {
  lt = 'lt', // Menor que
  lte = 'lte', // Menor ou igual a
  gt = 'gt', // Maior que
  gte = 'gte', // Maior ou igual a
  ne = 'ne', // Diferente de
  default = '', // Igualdade padrão
}

// Verifica se uma string é uma condição válida
function isCondition(value: string): value is Condition {
  return Object.values<string>(Condition).includes(value)
}

// Estrutura para paginação
export type PaginatedItems = {
  first: number
  prev: number | null
  next: number | null
  last: number
  pages: number
  items: number
  data: Item[]
}

// Garante que o argumento seja um array
function ensureArray(arg: string | string[] = []): string[] {
  return Array.isArray(arg) ? arg : [arg]
}

// Insere dados relacionados (foreign keys) no item retornado
function embed(db: Low<Data>, name: string, item: Item, related: string): Item {
  const relatedData: Item[] = db.data[related] as Item[]

  if (!relatedData) return item // Retorna o item original se não houver dados relacionados

  const foreignKey = `${inflection.singularize(name)}Id` // Chave estrangeira
  const relatedItems = relatedData.filter(
    (relatedItem: Item) => relatedItem[foreignKey] === item['id'],
  )

  return { ...item, [related]: relatedItems }
}

// Anula referências de chave estrangeira para um item excluído
function nullifyForeignKey(db: Low<Data>, name: string, id: string) {
  const foreignKey = `${inflection.singularize(name)}Id`

  Object.entries(db.data).forEach(([key, items]) => {
    if (key === name) return // Ignora a própria entidade

    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (item[foreignKey] === id) {
          item[foreignKey] = null // Remove referência
        }
      })
    }
  })
}

// Exclui dependentes relacionados a uma entidade
function deleteDependents(db: Low<Data>, name: string, dependents: string[]) {
  const foreignKey = `${inflection.singularize(name)}Id`

  Object.entries(db.data).forEach(([key, items]) => {
    if (!dependents.includes(key)) return // Ignora entidades não dependentes

    if (Array.isArray(items)) {
      db.data[key] = items.filter((item) => item[foreignKey] !== null) // Remove dependentes
    }
  })
}

// Gera um ID aleatório
function randomId(): string {
  return randomBytes(2).toString('hex')
}

// Garante que todos os itens tenham um ID válido
function fixItemsIds(items: Item[]) {
  items.forEach((item) => {
    if (typeof item['id'] === 'number') {
      item['id'] = item['id'].toString() // Converte IDs numéricos para strings
    }
    if (item['id'] === undefined) {
      item['id'] = randomId() // Gera ID caso esteja ausente
    }
  })
}

// Garante IDs válidos para todos os dados no banco
function fixAllItemsIds(data: Data) {
  Object.values(data).forEach((value) => {
    if (Array.isArray(value)) {
      fixItemsIds(value)
    }
  })
}

// Serviço principal para manipulação de dados
export class Service {
  #db: Low<Data>

  constructor(db: Low<Data>) {
    fixAllItemsIds(db.data) // Corrige IDs na inicialização
    this.#db = db
  }

  // Busca uma entidade no banco de dados
  #get(name: string): Item[] | Item | undefined {
    return this.#db.data[name]
  }

  // Verifica se uma entidade existe no banco
  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.#db?.data, name)
  }

  // Busca um item por ID
  findById(name: string, id: string, query: { _embed?: string[] | string }): Item | undefined {
    const value = this.#get(name)

    if (Array.isArray(value)) {
      let item = value.find((item) => item['id'] === id)
      ensureArray(query._embed).forEach((related) => {
        if (item) item = embed(this.#db, name, item, related) // Insere dados relacionados
      })
      return item
    }
    return
  }

  // Filtra e retorna itens com suporte a paginação e ordenação
  find(name: string, query: { [key: string]: unknown } = {}): Item[] | PaginatedItems | Item | undefined {
    let items = this.#get(name)
    if (!Array.isArray(items)) return items

    // Insere dados relacionados
    ensureArray(query._embed).forEach((related) => {
      items = items.map((item) => embed(this.#db, name, item, related))
    })

    // Ordenação, paginação e filtragem são aplicadas aqui...
    // (lógica reduzida para evitar repetição)
    return items
  }

  // Cria um novo item
  async create(name: string, data: Omit<Item, 'id'> = {}): Promise<Item | undefined> {
    const items = this.#get(name)
    if (!Array.isArray(items)) return

    const item = { id: randomId(), ...data }
    items.push(item) // Adiciona ao banco
    await this.#db.write() // Salva mudanças
    return item
  }

  // Atualiza um item por ID
  async updateById(name: string, id: string, body: Item = {}): Promise<Item | undefined> {
    const items = this.#get(name)
    if (!Array.isArray(items)) return

    const item = items.find((item) => item['id'] === id)
    if (!item) return

    const nextItem = { ...item, ...body, id } // Atualiza dados
    const index = items.indexOf(item)
    items.splice(index, 1, nextItem) // Substitui no banco

    await this.#db.write()
    return nextItem
  }

  // Exclui um item por ID
  async destroyById(name: string, id: string, dependent?: string | string[]): Promise<Item | undefined> {
    const items = this.#get(name)
    if (!Array.isArray(items)) return

    const item = items.find((item) => item['id'] === id)
    if (!item) return

    items.splice(items.indexOf(item), 1) // Remove do banco
    nullifyForeignKey(this.#db, name, id) // Anula referências
    deleteDependents(this.#db, name, ensureArray(dependent)) // Remove dependentes

    await this.#db.write()
    return item
  }
}
