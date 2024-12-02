import assert from 'node:assert/strict' // Para realizar asserções nos testes
import test from 'node:test' // Framework nativo para testes

import { Low, Memory } from 'lowdb' // Banco de dados em memória

import { Data, Item, PaginatedItems, Service } from './service.js' // Serviço e tipos usados

// Configuração inicial do banco de dados e instâncias
const defaultData = { posts: [], comments: [], object: {} }
const adapter = new Memory<Data>()
const db = new Low<Data>(adapter, defaultData)
const service = new Service(db) // Instância do serviço

// Constantes para recursos e entidades de teste
const POSTS = 'posts'
const COMMENTS = 'comments'
const OBJECT = 'object'
const UNKNOWN_RESOURCE = 'xxx'
const UNKNOWN_ID = 'xxx'

// Dados de teste
const post1 = { id: '1', title: 'a', views: 100, published: true, author: { name: 'foo' }, tags: ['foo', 'bar'] }
const post2 = { id: '2', title: 'b', views: 200, published: false, author: { name: 'bar' }, tags: ['bar'] }
const post3 = { id: '3', title: 'c', views: 300, published: false, author: { name: 'baz' }, tags: ['foo'] }
const comment1 = { id: '1', title: 'a', postId: '1' }
const obj = { f1: 'foo' }

// Restaura o banco de dados para o estado inicial
function reset() {
  db.data = structuredClone({
    posts: [post1, post2, post3],
    comments: [comment1],
    object: obj,
  })
}

// Teste do construtor: valida que os IDs são corretamente inicializados
await test('constructor', () => {
  const defaultData = { posts: [{ id: '1' }, {}], object: {} } satisfies Data
  const db = new Low<Data>(adapter, defaultData)
  new Service(db) // Cria a instância do serviço

  if (Array.isArray(db.data['posts'])) {
    const id0 = db.data['posts']?.at(0)?.['id']
    const id1 = db.data['posts']?.at(1)?.['id']
    assert.ok(typeof id1 === 'string' && id1.length > 0, `id should be a non-empty string but was: ${String(id1)}`)
    assert.ok(typeof id0 === 'string' && id0 === '1', `id should not change if already set but was: ${String(id0)}`)
  }
})

// Teste da função findById
await test('findById', () => {
  reset()
  if (!Array.isArray(db.data?.[POSTS])) throw new Error('posts should be an array')

  assert.deepEqual(service.findById(POSTS, '1', {}), db.data?.[POSTS]?.[0]) // Busca item existente
  assert.equal(service.findById(POSTS, UNKNOWN_ID, {}), undefined) // Busca item inexistente

  // Testa relação de entidades
  assert.deepEqual(service.findById(POSTS, '1', { _embed: ['comments'] }), { ...post1, comments: [comment1] })
  assert.deepEqual(service.findById(COMMENTS, '1', { _embed: ['post'] }), { ...comment1, post: post1 })

  // Busca em recurso inexistente
  assert.equal(service.findById(UNKNOWN_RESOURCE, '1', {}), undefined)
})

// Teste da função find com múltiplos casos
await test('find', async (t) => {
  const testCases = [
    { name: POSTS, res: [post1, post2, post3] }, // Lista todos os posts
    { name: POSTS, params: { id: post1.id }, res: [post1] }, // Filtra por ID
    { name: POSTS, params: { views_lt: post3.views.toString() }, res: [post1, post2] }, // Filtra por views
    { name: POSTS, params: { _sort: 'views' }, res: [post1, post2, post3] }, // Ordena por views
    { name: POSTS, params: { _page: 1, _per_page: 2 }, res: { first: 1, last: 2, prev: null, next: 2, pages: 2, items: 3, data: [post1, post2] } }, // Paginação
    { name: POSTS, params: { _embed: ['comments'] }, res: [{ ...post1, comments: [comment1] }, { ...post2, comments: [] }, { ...post3, comments: [] }] }, // Insere relações
    { name: UNKNOWN_RESOURCE, res: undefined }, // Recurso desconhecido
    { name: OBJECT, res: obj }, // Retorna objeto
  ]

  for (const tc of testCases) {
    await t.test(`${tc.name} ${JSON.stringify(tc.params)}`, () => {
      if (tc.data) db.data = tc.data
      else reset()

      assert.deepEqual(service.find(tc.name, tc.params), tc.res)
    })
  }
})

// Testa criação de itens
await test('create', async () => {
  reset()
  const post = { title: 'new post' }
  const res = await service.create(POSTS, post)
  assert.equal(res?.['title'], post.title)
  assert.equal(typeof res?.['id'], 'string', 'id should be a string')
  assert.equal(await service.create(UNKNOWN_RESOURCE, post), undefined) // Criação em recurso inexistente
})

// Testa atualização de objetos
await test('update', async () => {
  reset()
  const obj = { f1: 'bar' }
  const res = await service.update(OBJECT, obj)
  assert.equal(res, obj) // Atualiza corretamente o objeto
  assert.equal(await service.update(UNKNOWN_RESOURCE, obj), undefined) // Recurso inexistente
})

// Testa atualização por ID
await test('updateById', async () => {
  reset()
  const post = { id: 'xxx', title: 'updated post' }
  const res = await service.updateById(POSTS, post1.id, post)
  assert.equal(res?.['id'], post1.id, 'id should not change') // ID não deve mudar
  assert.equal(res?.['title'], post.title)
})

// Testa remoção de itens
await test('destroy', async () => {
  reset()
  const prevLength = db.data?.[POSTS]?.length || 0
  await service.destroyById(POSTS, post1.id) // Remove post
  assert.equal(db.data?.[POSTS]?.length, prevLength - 1)
  assert.deepEqual(db.data?.[COMMENTS], [{ ...comment1, postId: null }]) // Remove dependentes
})
